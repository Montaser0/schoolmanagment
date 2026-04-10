"use server";

import { resolveSchoolId } from "@/lib/auth/resolve-school-id";
import { createClient } from "@/lib/supabase/server";

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** بداية الأسبوع الحالي: الإثنين 00:00 UTC */
function startOfWeekMondayUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const utcDow = d.getUTCDay();
  const daysFromMonday = (utcDow + 6) % 7;
  const start = new Date(Date.UTC(y, m, day - daysFromMonday, 0, 0, 0, 0));
  return start.toISOString();
}

function startOfMonthUtc(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString();
}

export type LateTuitionStudentRow = {
  studentId: string;
  fullName: string;
  className: string | null;
  installmentId: string;
  dueDate: string;
  remaining: number;
};

export type NewStudentRow = {
  id: string;
  fullName: string;
  className: string | null;
  createdAt: string;
};

export type TeacherPaidRow = {
  teacherId: string;
  fullName: string;
  paymentsCount: number;
  totalPaid: number;
  lastPaidAt: string;
};

export type ClassStudentCount = {
  classId: string;
  className: string;
  count: number;
};

export type StaffDashboardResult =
  | {
      success: true;
      lateTuitionStudents: LateTuitionStudentRow[];
      newStudentsThisWeek: NewStudentRow[];
      teachersPaidThisMonth: TeacherPaidRow[];
      teachersPaidThisMonthCount: number;
      totalStudentsActive: number;
      totalTeachers: number;
      studentsPerClass: ClassStudentCount[];
      unassignedClassCount: number;
      weekStartedAt: string;
      monthStartedAt: string;
      warnings: string[];
    }
  | { success: false; message: string };

const LIST_LIMIT = 12;

export async function getStaffDashboardStats(): Promise<StaffDashboardResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, message: "يجب تسجيل الدخول أولًا." };
  }

  const schoolId = await resolveSchoolId(supabase, user.id, user.email);
  if (!schoolId) {
    return { success: false, message: "لم يتم العثور على مدرسة مرتبطة بحسابك." };
  }

  const weekStart = startOfWeekMondayUtc();
  const monthStart = startOfMonthUtc();
  const warnings: string[] = [];

  const [
    lateRes,
    newStudentsRes,
    studentsCountRes,
    teachersCountRes,
    studentsForClassRes,
    classesRes,
    teacherPayRes,
  ] = await Promise.all([
    supabase
      .from("v_late_students")
      .select("student_id,full_name,class_name,installment_id,due_date,remaining")
      .eq("school_id", schoolId)
      .order("due_date", { ascending: true })
      .limit(LIST_LIMIT),
    supabase
      .from("students")
      .select("id,full_name,created_at,class_id,classes!students_class_school_fk(name)")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .gte("created_at", weekStart)
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT),
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "active"),
    supabase.from("teachers").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    supabase.from("students").select("class_id").eq("school_id", schoolId).eq("status", "active"),
    supabase.from("classes").select("id,name").eq("school_id", schoolId).order("name", { ascending: true }),
    supabase
      .from("teacher_payments")
      .select("id,teacher_id,amount,paid_at,teachers!teacher_payments_teacher_school_fk(full_name)")
      .eq("school_id", schoolId)
      .gte("paid_at", monthStart)
      .order("paid_at", { ascending: false }),
  ]);

  let lateTuitionStudents: LateTuitionStudentRow[] = [];
  if (lateRes.error) {
    const m = lateRes.error.message?.toLowerCase() ?? "";
    if (m.includes("does not exist") || m.includes("schema cache")) {
      warnings.push("منظر الطلاب المتأخرين غير متاح؛ تأكد من إنشاء v_late_students في قاعدة البيانات.");
    } else {
      warnings.push(`تعذّر تحميل المتأخرين عن القسط: ${lateRes.error.message}`);
    }
  } else {
    lateTuitionStudents = ((lateRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      studentId: String(r.student_id ?? ""),
      fullName: String(r.full_name ?? "—"),
      className: r.class_name != null ? String(r.class_name) : null,
      installmentId: String(r.installment_id ?? ""),
      dueDate: String(r.due_date ?? "").slice(0, 10),
      remaining: toNumber(r.remaining as number | string),
    }));
  }

  type StMeta = {
    id: string;
    full_name: string;
    created_at: string;
    class_id: string | null;
    classes: { name: string } | { name: string }[] | null;
  };

  let newStudentsThisWeek: NewStudentRow[] = [];
  if (newStudentsRes.error) {
    warnings.push(`تعذّر تحميل الطلاب الجدد: ${newStudentsRes.error.message}`);
  } else {
    newStudentsThisWeek = ((newStudentsRes.data ?? []) as StMeta[]).map((s) => {
      const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes;
      return {
        id: s.id,
        fullName: s.full_name,
        className: cls?.name ?? null,
        createdAt: s.created_at,
      };
    });
  }

  const totalStudentsActive = studentsCountRes.count ?? 0;
  if (studentsCountRes.error) {
    warnings.push(`تعذّر عدّ الطلاب: ${studentsCountRes.error.message}`);
  }

  const totalTeachers = teachersCountRes.count ?? 0;
  if (teachersCountRes.error) {
    warnings.push(`تعذّر عدّ المعلمين: ${teachersCountRes.error.message}`);
  }

  const classNameById = new Map<string, string>();
  for (const c of (classesRes.data ?? []) as { id: string; name: string }[]) {
    classNameById.set(c.id, c.name);
  }

  const countByClass = new Map<string | null, number>();
  if (!studentsForClassRes.error && studentsForClassRes.data) {
    for (const row of studentsForClassRes.data as { class_id: string | null }[]) {
      const k = row.class_id;
      countByClass.set(k, (countByClass.get(k) ?? 0) + 1);
    }
  } else if (studentsForClassRes.error) {
    warnings.push(`تعذّر توزيع الطلاب على الصفوف: ${studentsForClassRes.error.message}`);
  }

  let unassignedClassCount = countByClass.get(null) ?? 0;
  const studentsPerClass: ClassStudentCount[] = [];
  for (const [classId, count] of countByClass) {
    if (classId === null) continue;
    const name = classNameById.get(classId) ?? "صف غير معروف";
    studentsPerClass.push({ classId, className: name, count });
  }
  studentsPerClass.sort((a, b) => a.className.localeCompare(b.className, "ar"));

  type TPay = {
    teacher_id: string;
    amount: number | string;
    paid_at: string;
    teachers: { full_name: string } | { full_name: string }[] | null;
  };

  const byTeacher = new Map<
    string,
    { fullName: string; paymentsCount: number; totalPaid: number; lastPaidAt: string }
  >();

  if (teacherPayRes.error) {
    const m = teacherPayRes.error.message?.toLowerCase() ?? "";
    if (!m.includes("does not exist") && !m.includes("schema cache")) {
      warnings.push(`تعذّر تحميل دفعات المعلمين: ${teacherPayRes.error.message}`);
    }
  } else {
    for (const p of (teacherPayRes.data ?? []) as TPay[]) {
      const t = Array.isArray(p.teachers) ? p.teachers[0] : p.teachers;
      const name = t?.full_name?.trim() || "معلم";
      const prev = byTeacher.get(p.teacher_id);
      const amt = toNumber(p.amount);
      if (!prev) {
        byTeacher.set(p.teacher_id, {
          fullName: name,
          paymentsCount: 1,
          totalPaid: amt,
          lastPaidAt: p.paid_at,
        });
      } else {
        prev.paymentsCount += 1;
        prev.totalPaid += amt;
        if (p.paid_at > prev.lastPaidAt) prev.lastPaidAt = p.paid_at;
        byTeacher.set(p.teacher_id, prev);
      }
    }
  }

  const teachersPaidThisMonth: TeacherPaidRow[] = [...byTeacher.entries()]
    .map(([teacherId, v]) => ({
      teacherId,
      fullName: v.fullName,
      paymentsCount: v.paymentsCount,
      totalPaid: Number(v.totalPaid.toFixed(2)),
      lastPaidAt: v.lastPaidAt,
    }))
    .sort((a, b) => b.lastPaidAt.localeCompare(a.lastPaidAt))
    .slice(0, LIST_LIMIT);

  return {
    success: true,
    lateTuitionStudents,
    newStudentsThisWeek,
    teachersPaidThisMonth,
    teachersPaidThisMonthCount: byTeacher.size,
    totalStudentsActive,
    totalTeachers,
    studentsPerClass,
    unassignedClassCount,
    weekStartedAt: weekStart,
    monthStartedAt: monthStart,
    warnings,
  };
}

const AR_WEEKDAYS_SUN_TO_THU = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"] as const;

const MONTH_NAMES_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
] as const;

export type StaffAttendanceWeekDay = {
  name: string;
  حاضر: number;
  غائب: number;
};

export type StaffGenderChartPayload = {
  radialData: Array<{ name: string; count: number; fill: string }>;
  maleCount: number;
  femaleCount: number;
  malePercent: number;
  femalePercent: number;
  totalActive: number;
};

export type StaffFinanceMonthRow = {
  name: string;
  الايرادات: number;
  المصروفات: number;
};

type StaffSchoolGate =
  | { ok: true; schoolId: string; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; message: string };

async function requireStaffSchool(): Promise<StaffSchoolGate> {
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

  return { ok: true, schoolId, supabase };
}

function sundayOfCurrentWeekUtcYmd(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const utcDow = d.getUTCDay();
  const start = new Date(Date.UTC(y, m, day - utcDow, 0, 0, 0, 0));
  return start.toISOString().slice(0, 10);
}

function addDaysUtcYmd(baseYmd: string, deltaDays: number): string {
  const [ys, ms, ds] = baseYmd.split("-");
  const y = Number(ys);
  const mo = Number(ms);
  const dd = Number(ds);
  const dt = new Date(Date.UTC(y, mo - 1, dd + deltaDays, 12, 0, 0, 0));
  return dt.toISOString().slice(0, 10);
}

/** حضور الطلاب (سجلات فعلية) لأيام الأحد–الخميس من الأسبوع الحالي بتوقيت UTC. */
export async function getStaffDashboardStudentAttendanceWeek(): Promise<
  | { success: true; days: StaffAttendanceWeekDay[] }
  | { success: false; message: string; days: StaffAttendanceWeekDay[] }
> {
  const gate = await requireStaffSchool();
  if (!gate.ok) {
    return { success: false, message: gate.message, days: [] };
  }

  const sun = sundayOfCurrentWeekUtcYmd();
  const dateKeys = [0, 1, 2, 3, 4].map((i) => addDaysUtcYmd(sun, i));
  const from = dateKeys[0]!;
  const to = dateKeys[4]!;

  const { data, error } = await gate.supabase
    .from("student_attendance")
    .select("attendance_date,status")
    .eq("school_id", gate.schoolId)
    .gte("attendance_date", from)
    .lte("attendance_date", to);

  const byDate = new Map<string, { present: number; absent: number }>();
  for (const dk of dateKeys) {
    byDate.set(dk, { present: 0, absent: 0 });
  }

  if (!error && data) {
    for (const row of data as { attendance_date: string; status: string }[]) {
      const key = String(row.attendance_date).slice(0, 10);
      const bucket = byDate.get(key);
      if (!bucket) continue;
      if (row.status === "present") bucket.present += 1;
      else if (row.status === "absent") bucket.absent += 1;
    }
  }

  const days: StaffAttendanceWeekDay[] = dateKeys.map((dk, i) => {
    const b = byDate.get(dk)!;
    return {
      name: AR_WEEKDAYS_SUN_TO_THU[i]!,
      حاضر: b.present,
      غائب: b.absent,
    };
  });

  if (error) {
    return {
      success: false,
      message: error.message ?? "تعذّر تحميل حضور الأسبوع.",
      days,
    };
  }

  return { success: true, days };
}

/** توزيع الطلاب النشطين حسب الجنس للرسم الدائري. */
export async function getStaffDashboardStudentGenderBreakdown(): Promise<
  | { success: true; payload: StaffGenderChartPayload }
  | { success: false; message: string; payload: null }
> {
  const gate = await requireStaffSchool();
  if (!gate.ok) {
    return { success: false, message: gate.message, payload: null };
  }

  const { data, error } = await gate.supabase
    .from("students")
    .select("gender")
    .eq("school_id", gate.schoolId)
    .eq("status", "active");

  if (error) {
    return {
      success: false,
      message: error.message ?? "تعذّر تحميل بيانات الجنس.",
      payload: null,
    };
  }

  let male = 0;
  let female = 0;
  for (const row of (data ?? []) as { gender: string }[]) {
    if (row.gender === "male") male += 1;
    else if (row.gender === "female") female += 1;
  }

  const total = male + female;
  const malePercent = total > 0 ? Math.round((male / total) * 100) : 0;
  const femalePercent = total > 0 ? Math.round((female / total) * 100) : 0;

  const payload: StaffGenderChartPayload = {
    totalActive: total,
    maleCount: male,
    femaleCount: female,
    malePercent,
    femalePercent,
    radialData: [
      { name: "الكلي", count: total > 0 ? total : 1, fill: total > 0 ? "#ffffff" : "#f3f4f6" },
      { name: "إناث", count: female, fill: "#fae27c" },
      { name: "ذكور", count: male, fill: "#c3ebfa" },
    ],
  };

  return { success: true, payload };
}

/** إيرادات ومصروفات شهرية لسنة تقويمية (UTC): دفعات + إيرادات يدوية / مصروفات + رواتب معلمين. */
export async function getStaffDashboardMonthlyFinance(
  year?: number,
): Promise<
  | {
      success: true;
      months: StaffFinanceMonthRow[];
      totalRevenue: number;
      totalExpenses: number;
      year: number;
    }
  | {
      success: false;
      message: string;
      months: [];
      totalRevenue: 0;
      totalExpenses: 0;
      year: number;
    }
> {
  const gate = await requireStaffSchool();
  if (!gate.ok) {
    return {
      success: false,
      message: gate.message,
      months: [],
      totalRevenue: 0,
      totalExpenses: 0,
      year: year ?? new Date().getUTCFullYear(),
    };
  }

  const y = year ?? new Date().getUTCFullYear();
  const from = `${y}-01-01`;
  const to = `${y}-12-31`;

  const [payRes, revRes, expRes, tpRes] = await Promise.all([
    gate.supabase
      .from("payments")
      .select("amount,paid_at")
      .eq("school_id", gate.schoolId)
      .gte("paid_at", `${from}T00:00:00.000Z`)
      .lte("paid_at", `${to}T23:59:59.999Z`),
    gate.supabase
      .from("revenues")
      .select("amount,revenue_date")
      .eq("school_id", gate.schoolId)
      .gte("revenue_date", from)
      .lte("revenue_date", to),
    gate.supabase
      .from("expenses")
      .select("amount,expense_date")
      .eq("school_id", gate.schoolId)
      .gte("expense_date", from)
      .lte("expense_date", to),
    gate.supabase
      .from("teacher_payments")
      .select("amount,paid_at")
      .eq("school_id", gate.schoolId)
      .gte("paid_at", `${from}T00:00:00.000Z`)
      .lte("paid_at", `${to}T23:59:59.999Z`),
  ]);

  const errMsg =
    payRes.error?.message ??
    revRes.error?.message ??
    expRes.error?.message ??
    tpRes.error?.message;

  if (errMsg) {
    return {
      success: false,
      message: errMsg,
      months: [],
      totalRevenue: 0,
      totalExpenses: 0,
      year: y,
    };
  }

  const incomeByMonth = new Array(12).fill(0) as number[];
  const expenseByMonth = new Array(12).fill(0) as number[];

  const bumpIncome = (month0: number, amt: number) => {
    if (month0 >= 0 && month0 < 12) incomeByMonth[month0] += amt;
  };
  const bumpExpense = (month0: number, amt: number) => {
    if (month0 >= 0 && month0 < 12) expenseByMonth[month0] += amt;
  };

  for (const p of (payRes.data ?? []) as { amount: number | string; paid_at: string }[]) {
    const d = p.paid_at.slice(0, 10);
    if (!d.startsWith(String(y))) continue;
    bumpIncome(Number.parseInt(d.slice(5, 7), 10) - 1, toNumber(p.amount));
  }

  for (const r of (revRes.data ?? []) as { amount: number | string; revenue_date: string }[]) {
    const d = r.revenue_date.slice(0, 10);
    if (!d.startsWith(String(y))) continue;
    bumpIncome(Number.parseInt(d.slice(5, 7), 10) - 1, toNumber(r.amount));
  }

  for (const e of (expRes.data ?? []) as { amount: number | string; expense_date: string }[]) {
    const d = e.expense_date.slice(0, 10);
    if (!d.startsWith(String(y))) continue;
    bumpExpense(Number.parseInt(d.slice(5, 7), 10) - 1, toNumber(e.amount));
  }

  for (const t of (tpRes.data ?? []) as { amount: number | string; paid_at: string }[]) {
    const d = t.paid_at.slice(0, 10);
    if (!d.startsWith(String(y))) continue;
    bumpExpense(Number.parseInt(d.slice(5, 7), 10) - 1, toNumber(t.amount));
  }

  const months: StaffFinanceMonthRow[] = MONTH_NAMES_AR.map((name, i) => ({
    name,
    الايرادات: Number(incomeByMonth[i]!.toFixed(2)),
    المصروفات: Number(expenseByMonth[i]!.toFixed(2)),
  }));

  const totalRevenue = Number(incomeByMonth.reduce((a, b) => a + b, 0).toFixed(2));
  const totalExpenses = Number(expenseByMonth.reduce((a, b) => a + b, 0).toFixed(2));

  return {
    success: true,
    months,
    totalRevenue,
    totalExpenses,
    year: y,
  };
}
