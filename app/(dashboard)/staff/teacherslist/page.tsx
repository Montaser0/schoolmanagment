import { backfillAbsentForPastTeachersUnmarked, listTeachers } from "@/actions/teachers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveSchoolId } from "@/lib/auth/resolve-school-id";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DailyTeacherAttendanceCheckbox } from "./daily-attendance-checkbox";

type TeachersListPageProps = {
  searchParams?: Promise<{
    q?: string;
    date?: string;
    month?: string;
  }>;
};

function parseDateParam(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw) return new Date().toISOString().slice(0, 10);
  const d = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return raw.slice(0, 10);
}

function isPastAttendanceDateUtc(dateStr: string): boolean {
  const day = dateStr.trim().slice(0, 10);
  return day < new Date().toISOString().slice(0, 10);
}

function currentYearMonth(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthToDateRange(ym: string): { from: string; to: string; label: string } | null {
  const raw = ym.trim();
  const m = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12 || !Number.isFinite(y)) return null;
  const from = `${y}-${String(mo).padStart(2, "0")}-01`;
  const lastDay = new Date(y, mo, 0).getDate();
  const to = `${y}-${String(mo).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to, label: raw };
}

function parseYearMonthParam(value: string | undefined): { from: string; to: string; value: string } {
  const parsed = value?.trim() ? monthToDateRange(value) : null;
  if (parsed) return { from: parsed.from, to: parsed.to, value: parsed.label };
  const fallback = monthToDateRange(currentYearMonth())!;
  return { from: fallback.from, to: fallback.to, value: fallback.label };
}

type MonthlyAttendanceStats = {
  presentDays: number;
  recordedDays: number;
  daysInCalendarMonth: number;
  ratePercent: number;
};

function daysInCalendarMonth(ymValue: string): number {
  const parsed = monthToDateRange(ymValue);
  if (!parsed) return 30;
  const y = Number(parsed.from.slice(0, 4));
  const mo = Number(parsed.from.slice(5, 7));
  if (!Number.isFinite(y) || mo < 1 || mo > 12) return 30;
  return new Date(y, mo, 0).getDate();
}

function buildMonthlyStatsByTeacher(
  rows: { teacher_id: string; status: string }[],
  daysInMonth: number,
): Map<string, MonthlyAttendanceStats> {
  const counts = new Map<string, { present: number; absent: number }>();
  for (const row of rows) {
    const tid = row.teacher_id;
    const cur = counts.get(tid) ?? { present: 0, absent: 0 };
    if (row.status === "present") cur.present += 1;
    else if (row.status === "absent") cur.absent += 1;
    counts.set(tid, cur);
  }
  const out = new Map<string, MonthlyAttendanceStats>();
  const denom = Math.max(daysInMonth, 1);
  for (const [tid, { present, absent }] of counts) {
    const recorded = present + absent;
    const ratePercent = Math.round((present / denom) * 1000) / 10;
    out.set(tid, {
      presentDays: present,
      recordedDays: recorded,
      daysInCalendarMonth: daysInMonth,
      ratePercent,
    });
  }
  return out;
}

export default async function StaffTeachersListPage({ searchParams }: TeachersListPageProps) {
  const params = (await searchParams) ?? {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const schoolId = await resolveSchoolId(supabase, user.id, user.email);
  if (!schoolId) {
    return (
      <div className="p-6 flex flex-col gap-6" dir="rtl">
        <div className="rounded-2xl border border-amber-400/40 bg-amber-100/40 p-6 text-amber-900 text-center text-sm">
          لم يتم العثور على مدرسة مرتبطة بحسابك.
        </div>
      </div>
    );
  }

  const query = params.q?.trim() || undefined;
  const attendanceDate = parseDateParam(params.date);
  const monthRange = parseYearMonthParam(params.month);

  const [{ data: schoolRow }, teachersResult] = await Promise.all([
    supabase.from("schools").select("name").eq("id", schoolId).maybeSingle(),
    listTeachers({
      query,
      limit: 1000,
      attendanceFrom: attendanceDate,
      attendanceTo: attendanceDate,
    }),
  ]);

  const schoolName = (schoolRow as { name?: string } | null)?.name ?? "مدرستك";

  const teacherIds =
    teachersResult.success && teachersResult.teachers.length > 0
      ? teachersResult.teachers.map((t) => t.id)
      : [];

  async function fetchAttendanceInRange(
    from: string,
    to: string,
  ): Promise<{ teacher_id: string; status: string }[]> {
    if (teacherIds.length === 0) return [];
    const pageSize = 1000;
    const all: { teacher_id: string; status: string }[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("teacher_attendance")
        .select("teacher_id,status")
        .eq("school_id", schoolId)
        .gte("attendance_date", from)
        .lte("attendance_date", to)
        .in("teacher_id", teacherIds)
        .range(offset, offset + pageSize - 1);
      if (error) break;
      const chunk = (data ?? []) as { teacher_id: string; status: string }[];
      all.push(...chunk);
      if (chunk.length < pageSize) break;
    }
    return all;
  }

  if (teacherIds.length > 0 && isPastAttendanceDateUtc(attendanceDate)) {
    await backfillAbsentForPastTeachersUnmarked({
      attendanceDate,
      teacherIds,
    });
  }

  const [dailyRows, monthlyRows] =
    teacherIds.length > 0
      ? await Promise.all([
          supabase
            .from("teacher_attendance")
            .select("teacher_id,status")
            .eq("school_id", schoolId)
            .eq("attendance_date", attendanceDate)
            .in("teacher_id", teacherIds)
            .then(({ data }) => (data ?? []) as { teacher_id: string; status: string }[]),
          fetchAttendanceInRange(monthRange.from, monthRange.to),
        ])
      : [[], []];

  const presentByTeacher = new Map<string, boolean>();
  for (const row of dailyRows) {
    presentByTeacher.set(row.teacher_id, row.status === "present");
  }

  const calendarDaysInMonth = daysInCalendarMonth(monthRange.value);
  const monthlyStatsByTeacher = buildMonthlyStatsByTeacher(monthlyRows, calendarDaysInMonth);

  const totalTeachers = teachersResult.success ? teachersResult.total : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-6" dir="rtl">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">قائمة المعلمين</h1>
          <p className="text-sm text-muted-foreground">{schoolName}</p>
        </div>
      </div>

      <section className="bg-white rounded-3xl shadow-lg border p-6 space-y-6">
        <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">بحث وتصفية</h2>
        <form method="get" className="space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="q">بحث</Label>
              <Input
                id="q"
                name="q"
                defaultValue={query ?? ""}
                placeholder="اسم، هاتف، أو مادة"
                className="rounded-xl focus-visible:ring-2 focus-visible:ring-yellow-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="month">شهر نسبة الحضور</Label>
              <Input
                id="month"
                name="month"
                type="month"
                defaultValue={monthRange.value}
                className="rounded-xl focus-visible:ring-2 focus-visible:ring-yellow-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">تاريخ الحضور اليومي</Label>
              <Input
                id="date"
                name="date"
                type="date"
                defaultValue={attendanceDate}
                className="rounded-xl focus-visible:ring-2 focus-visible:ring-yellow-400"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="submit"
              className="rounded-md bg-Yellow px-4 text-foreground shadow-sm hover:bg-Yellow/90 hover:scale-[1.02] transition-transform"
            >
              تطبيق
            </Button>
            <Button type="button" variant="outline" asChild className="rounded-md">
              <Link href="/staff/teacherslist">إعادة ضبط</Link>
            </Button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-3xl shadow-lg border overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/80 px-6 py-4 text-sm">
          <div className="font-semibold text-gray-800">
            المعلمون: {teachersResult.success ? totalTeachers.toLocaleString("en-US") : "—"}
            <span className="mx-2 font-normal text-muted-foreground">·</span>
            <span className="font-normal text-muted-foreground">اليوم {attendanceDate}</span>
            <span className="mx-2 font-normal text-muted-foreground">·</span>
            <span className="font-normal text-muted-foreground">الشهر {monthRange.value}</span>
          </div>
          {!teachersResult.success ? <span className="text-sm text-red-700">{teachersResult.message}</span> : null}
        </div>

        {!teachersResult.success ? null : teachersResult.teachers.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">لا يوجد معلمون مطابقون.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-right text-gray-800">
                  <th className="px-4 py-3 font-semibold">الاسم</th>
                  <th className="px-4 py-3 font-semibold">المادة</th>
                  <th className="px-4 py-3 font-semibold">الهاتف</th>
                  <th className="px-4 py-3 font-semibold">الراتب</th>
                  <th className="px-4 py-3 font-semibold">
                    نسبة الحضور
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{monthRange.value}</span>
                  </th>
                  <th className="px-4 py-3 text-center font-semibold">حاضر</th>
                </tr>
              </thead>
              <tbody>
                {teachersResult.teachers.map((teacher) => {
                  const isPresent = presentByTeacher.get(teacher.id) === true;
                  const monthly = monthlyStatsByTeacher.get(teacher.id);
                  return (
                    <tr key={teacher.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80">
                      <td className="px-4 py-3 font-medium text-gray-900">{teacher.fullName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{teacher.subject ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{teacher.phone ?? "—"}</td>
                      <td className="px-4 py-3 tabular-nums text-foreground">
                        {teacher.salary.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(() => {
                          const presentDays = monthly?.presentDays ?? 0;
                          const hasAnyRecord = (monthly?.recordedDays ?? 0) > 0;
                          if (!hasAnyRecord && presentDays === 0) {
                            return (
                              <span
                                className="text-muted-foreground"
                                title="لا توجد أيام مسجّلة في هذا الشهر"
                              >
                                —
                              </span>
                            );
                          }
                          const rate = monthly?.ratePercent ?? 0;
                          const dim = monthly?.daysInCalendarMonth ?? calendarDaysInMonth;
                          return (
                            <div className="space-y-0.5">
                              <div className="font-semibold tabular-nums text-foreground">
                                {rate.toLocaleString("en-US")}%
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {presentDays.toLocaleString("en-US")} يوم حضور من أصل{" "}
                                {dim.toLocaleString("en-US")} يومًا في الشهر
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <DailyTeacherAttendanceCheckbox
                          teacherId={teacher.id}
                          attendanceDate={attendanceDate}
                          initialPresent={isPresent}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
