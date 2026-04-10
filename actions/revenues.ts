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
