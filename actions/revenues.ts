"use server";

/** إيرادات المدرسة = دفعات الطلاب (جدول payments) + السجلات هنا (جدول revenues). الملخص في v_financial_summary. */

import { revalidatePath } from "next/cache";
import { resolveSchoolId } from "@/lib/auth/resolve-school-id";
import { createClient } from "@/lib/supabase/server";

type ActionResult =
  | { success: true; message: string }
  | { success: false; message: string };

type AuthContext =
  | { ok: true; userId: string; schoolId: string }
  | { ok: false; message: string };

type RevenueRow = {
  id: string;
  school_id: string;
  title: string;
  amount: number | string;
  revenue_date: string;
  created_at: string;
};

export type CreateRevenueInput = {
  title: string;
  amount: number;
  revenueDate?: string;
};

export type UpdateRevenueInput = {
  id: string;
  title?: string;
  amount?: number;
  revenueDate?: string;
};

export type DeleteRevenueInput = {
  id: string;
};

export type RevenueListItem = {
  id: string;
  title: string;
  amount: number;
  revenueDate: string;
  createdAt: string;
};

/** سجل الإيرادات المعروض: يدوي من `revenues` أو دفعة قسط من `payments`. */
export type RevenueLedgerSource = "manual" | "tuition_payment";

export type RevenueLedgerItem = {
  /** مفتاح فريد للواجهة */
  ledgerKey: string;
  source: RevenueLedgerSource;
  id: string;
  title: string;
  amount: number;
  revenueDate: string;
  createdAt: string;
  canEdit: boolean;
};

export type ListRevenuesFilters = {
  from?: string;
  to?: string;
  limit?: number;
};

export type ListRevenuesResult =
  | {
      success: true;
      revenues: RevenueListItem[];
      total: number;
      message: string;
    }
  | {
      success: false;
      revenues: [];
      total: 0;
      message: string;
    };

export type ListRevenueLedgerResult =
  | {
      success: true;
      items: RevenueLedgerItem[];
      /** إجمالي السجلات بعد الدمج (قبل اقتطاع العرض). */
      total: number;
      hasMore: boolean;
      message: string;
    }
  | {
      success: false;
      items: [];
      total: 0;
      hasMore: false;
      message: string;
    };

export type TotalRevenuesResult =
  | { success: true; total: number }
  | { success: false; total: 0; message: string };

function normalizeTitle(value: string): string {
  return value.trim();
}

function toStrictlyPositiveAmount(value: number | undefined): number {
  if (value === undefined) return -1;
  if (!Number.isFinite(value) || value <= 0) return -1;
  return Number(value.toFixed(2));
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseDateOnly(dateText: string | undefined): string | null {
  const value = dateText?.trim();
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return value;
}

async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: "يجب تسجيل الدخول أولًا." };
  }

  const schoolId = await resolveSchoolId(supabase, user.id, user.email);
  if (!schoolId) {
    return { ok: false, message: "لم يتم العثور على مدرسة مرتبطة بحسابك." };
  }

  return { ok: true, userId: user.id, schoolId };
}

function revalidateRevenueViews() {
  revalidatePath("/staff/revenues");
  revalidatePath("/staff/expenses");
  revalidatePath("/admin");
}

function mapRow(row: RevenueRow): RevenueListItem {
  return {
    id: row.id,
    title: row.title,
    amount: toNumber(row.amount),
    revenueDate: row.revenue_date,
    createdAt: row.created_at,
  };
}

export async function listRevenues(filters?: ListRevenuesFilters): Promise<ListRevenuesResult> {
  const auth = await getAuthContext();
  if (!auth.ok) {
    return { success: false, revenues: [], total: 0, message: auth.message };
  }

  const supabase = await createClient();
  let query = supabase
    .from("revenues")
    .select("*", { count: "exact" })
    .eq("school_id", auth.schoolId)
    .order("revenue_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters?.from) {
    const from = parseDateOnly(filters.from);
    if (from) query = query.gte("revenue_date", from);
  }
  if (filters?.to) {
    const to = parseDateOnly(filters.to);
    if (to) query = query.lte("revenue_date", to);
  }

  const limit = filters?.limit ?? 200;
  query = query.limit(Math.min(Math.max(limit, 1), 500));

  const { data, error, count } = await query;

  if (error) {
    return {
      success: false,
      revenues: [],
      total: 0,
      message: error.message ?? "فشل جلب الإيرادات.",
    };
  }

  const rows = (data ?? []) as RevenueRow[];
  return {
    success: true,
    revenues: rows.map(mapRow),
    total: count ?? rows.length,
    message: "تم جلب الإيرادات.",
  };
}

type PaymentLedgerRow = {
  id: string;
  amount: number | string;
  paid_at: string;
  student_id: string;
  installment_id: string | null;
  students: { full_name: string } | { full_name: string }[] | null;
};

/**
 * سجل إيرادات موحّد: الإيرادات اليدوية + دفعات أقساط الطلاب (جدول payments).
 * لا يُنشئ صفوفاً في `revenues` حتى لا يُحسب المبلغ مرتين في v_financial_summary.
 */
export async function listRevenueLedger(filters?: ListRevenuesFilters): Promise<ListRevenueLedgerResult> {
  const auth = await getAuthContext();
  if (!auth.ok) {
    return { success: false, items: [], total: 0, hasMore: false, message: auth.message };
  }

  const maxEach = 400;
  const supabase = await createClient();

  let revQuery = supabase
    .from("revenues")
    .select("*")
    .eq("school_id", auth.schoolId)
    .order("revenue_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(maxEach);

  if (filters?.from) {
    const from = parseDateOnly(filters.from);
    if (from) revQuery = revQuery.gte("revenue_date", from);
  }
  if (filters?.to) {
    const to = parseDateOnly(filters.to);
    if (to) revQuery = revQuery.lte("revenue_date", to);
  }

  let payQuery = supabase
    .from("payments")
    .select(
      "id,amount,paid_at,student_id,installment_id,students!payments_student_school_fk(full_name)",
    )
    .eq("school_id", auth.schoolId)
    .order("paid_at", { ascending: false })
    .limit(maxEach);

  if (filters?.from) {
    const from = parseDateOnly(filters.from);
    if (from) payQuery = payQuery.gte("paid_at", `${from}T00:00:00.000Z`);
  }
  if (filters?.to) {
    const to = parseDateOnly(filters.to);
    if (to) payQuery = payQuery.lte("paid_at", `${to}T23:59:59.999Z`);
  }

  const [{ data: revData, error: revError }, { data: payData, error: payError }] = await Promise.all([
    revQuery,
    payQuery,
  ]);

  if (revError) {
    return {
      success: false,
      items: [],
      total: 0,
      hasMore: false,
      message: revError.message ?? "فشل جلب الإيرادات اليدوية.",
    };
  }

  const manualItems: RevenueLedgerItem[] = ((revData ?? []) as RevenueRow[]).map((row) => {
    const m = mapRow(row);
    return {
      ledgerKey: `m-${m.id}`,
      source: "manual",
      id: m.id,
      title: m.title,
      amount: m.amount,
      revenueDate: m.revenueDate.slice(0, 10),
      createdAt: m.createdAt,
      canEdit: true,
    };
  });

  let tuitionItems: RevenueLedgerItem[] = [];
  if (payError) {
    const msg = payError.message?.toLowerCase() ?? "";
    if (!msg.includes("does not exist") && !msg.includes("schema cache")) {
      return {
        success: false,
        items: [],
        total: 0,
        hasMore: false,
        message: payError.message ?? "فشل جلب دفعات الطلاب.",
      };
    }
  } else {
    tuitionItems = ((payData ?? []) as PaymentLedgerRow[]).map((p) => {
      const st = Array.isArray(p.students) ? p.students[0] : p.students;
      const name = st?.full_name?.trim() || "طالب";
      const hasInst = p.installment_id != null && String(p.installment_id).length > 0;
      const title = hasInst ? `دفعة قسط — ${name}` : `دفعة — ${name}`;
      const paidAt = p.paid_at ?? "";
      return {
        ledgerKey: `p-${p.id}`,
        source: "tuition_payment" as const,
        id: p.id,
        title,
        amount: toNumber(p.amount),
        revenueDate: paidAt.slice(0, 10),
        createdAt: paidAt,
        canEdit: false,
      };
    });
  }

  const merged = [...manualItems, ...tuitionItems].sort((a, b) => {
    const da = a.revenueDate.localeCompare(b.revenueDate);
    if (da !== 0) return -da;
    return b.createdAt.localeCompare(a.createdAt);
  });

  const cap = Math.min(Math.max(filters?.limit ?? 250, 1), 500);
  const sliced = merged.slice(0, cap);

  return {
    success: true,
    items: sliced,
    total: merged.length,
    hasMore: merged.length > sliced.length,
    message: "تم جلب سجل الإيرادات.",
  };
}

export async function getTotalRevenuesAmount(): Promise<TotalRevenuesResult> {
  const auth = await getAuthContext();
  if (!auth.ok) {
    return { success: false, total: 0, message: auth.message };
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("revenues").select("amount").eq("school_id", auth.schoolId);

  if (error) {
    return {
      success: false,
      total: 0,
      message: error.message ?? "فشل حساب إجمالي الإيرادات المسجّلة.",
    };
  }

  let sum = 0;
  for (const row of rows ?? []) {
    sum += toNumber((row as { amount?: string | number | null }).amount);
  }
  return { success: true, total: Number(sum.toFixed(2)) };
}

export async function createRevenue(input: CreateRevenueInput): Promise<ActionResult> {
  const title = normalizeTitle(input.title);
  const amount = toStrictlyPositiveAmount(input.amount);
  const revenueDate = parseDateOnly(input.revenueDate) ?? new Date().toISOString().slice(0, 10);

  if (!title) {
    return { success: false, message: "عنوان الإيراد مطلوب." };
  }
  if (amount <= 0) {
    return { success: false, message: "المبلغ يجب أن يكون أكبر من صفر." };
  }

  const auth = await getAuthContext();
  if (!auth.ok) return { success: false, message: auth.message };

  const supabase = await createClient();
  const { error } = await supabase.from("revenues").insert({
    school_id: auth.schoolId,
    title,
    amount,
    revenue_date: revenueDate,
  });

  if (error) {
    return { success: false, message: error.message ?? "فشل تسجيل الإيراد." };
  }

  revalidateRevenueViews();
  return { success: true, message: "تم تسجيل الإيراد بنجاح." };
}

export async function updateRevenue(input: UpdateRevenueInput): Promise<ActionResult> {
  const id = input.id?.trim();
  if (!id) {
    return { success: false, message: "معرّف الإيراد مطلوب." };
  }

  const updates: Record<string, unknown> = {};

  if (input.title !== undefined) {
    const title = normalizeTitle(input.title);
    if (!title) return { success: false, message: "عنوان الإيراد غير صالح." };
    updates.title = title;
  }

  if (input.amount !== undefined) {
    const amount = toStrictlyPositiveAmount(input.amount);
    if (amount <= 0) {
      return { success: false, message: "المبلغ يجب أن يكون أكبر من صفر." };
    }
    updates.amount = amount;
  }

  if (input.revenueDate !== undefined) {
    const d = parseDateOnly(input.revenueDate);
    if (!d) return { success: false, message: "تاريخ الإيراد غير صالح." };
    updates.revenue_date = d;
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, message: "لا يوجد أي حقل لتعديله." };
  }

  const auth = await getAuthContext();
  if (!auth.ok) return { success: false, message: auth.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("revenues")
    .update(updates)
    .eq("id", id)
    .eq("school_id", auth.schoolId);

  if (error) {
    return { success: false, message: error.message ?? "فشل تعديل الإيراد." };
  }

  revalidateRevenueViews();
  return { success: true, message: "تم تعديل الإيراد بنجاح." };
}

export async function deleteRevenue(input: DeleteRevenueInput): Promise<ActionResult> {
  const id = input.id?.trim();
  if (!id) {
    return { success: false, message: "معرّف الإيراد مطلوب." };
  }

  const auth = await getAuthContext();
  if (!auth.ok) return { success: false, message: auth.message };

  const supabase = await createClient();
  const { error } = await supabase.from("revenues").delete().eq("id", id).eq("school_id", auth.schoolId);

  if (error) {
    return { success: false, message: error.message ?? "فشل حذف الإيراد." };
  }

  revalidateRevenueViews();
  return { success: true, message: "تم حذف الإيراد." };
}
