import { getStaffDashboardStats } from "@/actions/staff-dashboard";
import { resolveSchoolId } from "@/lib/auth/resolve-school-id";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

function formatShortDate(iso: string): string {
  const d = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return iso;
  try {
    return new Date(`${d}T12:00:00Z`).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

export default async function StaffDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const schoolId = await resolveSchoolId(supabase, user.id, user.email);
  if (!schoolId) {
    return (
      <div className="w-full max-w-5xl rounded-lg border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-700">
        لم يتم العثور على مدرسة مرتبطة بحسابك.
      </div>
    );
  }

  const dash = await getStaffDashboardStats();
  if (!dash.success) {
    return (
      <div className="w-full max-w-5xl rounded-lg border border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-900">
        {dash.message}
      </div>
    );
  }

  const weekLabel = formatShortDate(dash.weekStartedAt);
  const monthLabel = formatShortDate(dash.monthStartedAt);

  return (
    <div className="w-full max-w-6xl space-y-8" dir="rtl">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <p className="text-sm text-muted-foreground">
          نظرة سريعة على الطلاب والمعلمين والأقساط. الأسبوع يُحسب من الإثنين (UTC)؛ صرف الرواتب يُقاس من بداية الشهر
          الحالي.
        </p>
      </div>

      {dash.warnings.length > 0 ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 space-y-1">
          {dash.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">إجمالي الطلاب النشطين</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{dash.totalStudentsActive.toLocaleString("ar-EG")}</p>
          <Link href="/staff/studentlist" className="mt-2 inline-block text-xs text-primary underline">
            قائمة الطلاب
          </Link>
        </div>
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">إجمالي المعلمين</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{dash.totalTeachers.toLocaleString("ar-EG")}</p>
          <Link href="/staff/teacherslist" className="mt-2 inline-block text-xs text-primary underline">
            قائمة المعلمين
          </Link>
        </div>
        <div className="rounded-lg border bg-card p-5 shadow-sm sm:col-span-2 lg:col-span-1">
          <p className="text-sm font-medium text-muted-foreground">معلمون صُرفت رواتبهم هذا الشهر</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {dash.teachersPaidThisMonthCount.toLocaleString("ar-EG")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">منذ {monthLabel}</p>
          <Link href="/staff/teacher-installments" className="mt-2 inline-block text-xs text-primary underline">
            أقساط المعلمين
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border overflow-hidden">
          <div className="border-b bg-muted/40 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">متأخرون عن تسديد القسط</h2>
            <Link href="/staff/student-installments" className="text-xs text-primary underline">
              كل الأقساط
            </Link>
          </div>
          <ul className="divide-y max-h-72 overflow-y-auto text-sm">
            {dash.lateTuitionStudents.length === 0 ? (
              <li className="px-4 py-6 text-center text-muted-foreground">لا يوجد طلاب متأخرون حسب البيانات الحالية.</li>
            ) : (
              dash.lateTuitionStudents.map((s) => (
                <li key={s.installmentId} className="px-4 py-3 flex flex-col gap-0.5">
                  <span className="font-medium">{s.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.className ?? "بدون صف"} · استحقاق {s.dueDate} · متبقي{" "}
                    {s.remaining.toLocaleString("ar-EG")}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <div className="border-b bg-muted/40 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">طلاب مضافون هذا الأسبوع</h2>
            <span className="text-xs text-muted-foreground">منذ {weekLabel}</span>
          </div>
          <ul className="divide-y max-h-72 overflow-y-auto text-sm">
            {dash.newStudentsThisWeek.length === 0 ? (
              <li className="px-4 py-6 text-center text-muted-foreground">لا طلاب جدد هذا الأسبوع.</li>
            ) : (
              dash.newStudentsThisWeek.map((s) => (
                <li key={s.id} className="px-4 py-3 flex flex-col gap-0.5">
                  <span className="font-medium">{s.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.className ?? "بدون صف"} · {formatShortDate(s.createdAt)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border overflow-hidden lg:col-span-2">
          <div className="border-b bg-muted/40 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">عدد الطلاب النشطين حسب الصف</h2>
            <Link href="/staff/class" className="text-xs text-primary underline">
              إدارة الصفوف
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-right">
                <tr>
                  <th className="px-4 py-2 font-medium">الصف</th>
                  <th className="px-4 py-2 font-medium w-32">عدد الطلاب</th>
                </tr>
              </thead>
              <tbody>
                {dash.unassignedClassCount > 0 ? (
                  <tr className="border-t">
                    <td className="px-4 py-2 text-muted-foreground">بدون صف</td>
                    <td className="px-4 py-2 tabular-nums">{dash.unassignedClassCount.toLocaleString("ar-EG")}</td>
                  </tr>
                ) : null}
                {dash.studentsPerClass.length === 0 && dash.unassignedClassCount === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">
                      لا توجد بيانات صفوف.
                    </td>
                  </tr>
                ) : (
                  dash.studentsPerClass.map((c) => (
                    <tr key={c.classId} className="border-t">
                      <td className="px-4 py-2">{c.className}</td>
                      <td className="px-4 py-2 tabular-nums">{c.count.toLocaleString("ar-EG")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border overflow-hidden lg:col-span-2">
          <div className="border-b bg-muted/40 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">معلمون تُوصَّل لهم رواتب (هذا الشهر)</h2>
            <Link href="/staff/teacher-installments" className="text-xs text-primary underline">
              صرف الرواتب
            </Link>
          </div>
          <ul className="divide-y max-h-64 overflow-y-auto text-sm">
            {dash.teachersPaidThisMonth.length === 0 ? (
              <li className="px-4 py-6 text-center text-muted-foreground">
                لا دفعات رواتب مسجّلة هذا الشهر بعد.
              </li>
            ) : (
              dash.teachersPaidThisMonth.map((t) => (
                <li key={t.teacherId} className="px-4 py-3 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="font-medium">{t.fullName}</span>
                    <span className="text-xs text-muted-foreground block sm:inline sm:mr-2">
                      {" "}
                      · {t.paymentsCount} دفعة · آخر صرف {formatShortDate(t.lastPaidAt)}
                    </span>
                  </div>
                  <span className="tabular-nums font-medium">{t.totalPaid.toLocaleString("ar-EG")}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
