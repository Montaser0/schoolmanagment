import {
  createStudent,
  deleteStudent,
  getStudentAttendance,
  listStudents,
  updateStudent,
  upsertStudentAttendance,
} from "@/actions/students";
import { resolveSchoolId } from "@/lib/auth/resolve-school-id";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type StudentsPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
    q?: string;
    classId?: string;
    gender?: "male" | "female";
    studentStatus?: "active" | "withdrawn";
    hasLatePayments?: "true" | "false";
    alertLevel?: "none" | "medium" | "high";
    attendanceStudentId?: string;
  }>;
};

function buildRedirectUrl(status: "success" | "error", message: string) {
  return `/staff/students?status=${status}&message=${encodeURIComponent(message)}`;
}

function asNullableText(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function asNullableNumber(value: FormDataEntryValue | null): number | undefined {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const number = Number.parseFloat(text);
  if (!Number.isFinite(number)) return undefined;
  return number;
}

export default async function StaffStudentsPage({ searchParams }: StudentsPageProps) {
  const params = (await searchParams) ?? {};
  const pageStatus = params.status;
  const pageMessage = params.message;

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

  const query = params.q?.trim() || undefined;
  const classId = params.classId?.trim() || undefined;
  const gender = params.gender;
  const studentStatus = params.studentStatus;
  const hasLatePayments =
    params.hasLatePayments === "true"
      ? true
      : params.hasLatePayments === "false"
        ? false
        : undefined;
  const alertLevel = params.alertLevel;
  const attendanceStudentId = params.attendanceStudentId?.trim() || undefined;

  const [{ data: classes }, studentsResult] = await Promise.all([
    supabase
      .from("classes")
      .select("id,name")
      .eq("school_id", schoolId)
      .order("name", { ascending: true }),
    listStudents({
      query,
      classId,
      gender,
      status: studentStatus,
      hasLatePayments,
      alertLevel,
      limit: 500,
    }),
  ]);

  const attendanceResult = attendanceStudentId
    ? await getStudentAttendance({
        studentId: attendanceStudentId,
      })
    : null;

  async function createStudentAction(formData: FormData) {
    "use server";
    const fullName = String(formData.get("fullName") ?? "").trim();
    const selectedClassId = asNullableText(formData.get("classId"));
    const guardianPhone = asNullableText(formData.get("guardianPhone"));
    const address = asNullableText(formData.get("address"));
    const baseTuition = asNullableNumber(formData.get("baseTuition"));
    const genderValue = String(formData.get("gender") ?? "male") as "male" | "female";

    const result = await createStudent({
      fullName,
      classId: selectedClassId,
      gender: genderValue,
      baseTuition,
      guardianPhone,
      address,
      status: "active",
    });

    redirect(buildRedirectUrl(result.success ? "success" : "error", result.message));
  }

  async function updateStudentAction(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "").trim();
    const fullName = String(formData.get("fullName") ?? "").trim();
    const selectedClassId = asNullableText(formData.get("classId"));
    const guardianPhone = asNullableText(formData.get("guardianPhone"));
    const address = asNullableText(formData.get("address"));
    const baseTuition = asNullableNumber(formData.get("baseTuition"));
    const genderValue = String(formData.get("gender") ?? "male") as "male" | "female";
    const statusValue = String(formData.get("status") ?? "active") as "active" | "withdrawn";

    const result = await updateStudent({
      id,
      fullName,
      classId: selectedClassId,
      gender: genderValue,
      baseTuition,
      guardianPhone,
      address,
      status: statusValue,
    });

    redirect(buildRedirectUrl(result.success ? "success" : "error", result.message));
  }

  async function deleteStudentAction(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "").trim();
    const result = await deleteStudent({ id });
    redirect(buildRedirectUrl(result.success ? "success" : "error", result.message));
  }

  async function upsertAttendanceAction(formData: FormData) {
    "use server";
    const studentId = String(formData.get("studentId") ?? "").trim();
    const attendanceDate = String(formData.get("attendanceDate") ?? "").trim();
    const status = String(formData.get("status") ?? "present") as "present" | "absent";

    const result = await upsertStudentAttendance({
      studentId,
      attendanceDate,
      status,
    });

    const baseUrl = buildRedirectUrl(result.success ? "success" : "error", result.message);
    const suffix = studentId ? `&attendanceStudentId=${encodeURIComponent(studentId)}` : "";
    redirect(`${baseUrl}${suffix}`);
  }

  return (
    <div className="w-full max-w-6xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">إدارة الطلاب</h1>
        <p className="text-sm text-muted-foreground">
          إضافة وتعديل وحذف الطلاب، مع البحث والتصفية والحضور/الغياب، ومتابعة القسط
          والتأخير والتنبيهات.
        </p>
      </div>

      {pageMessage ? (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            pageStatus === "success"
              ? "border-green-500/40 bg-green-500/10 text-green-700"
              : "border-red-500/40 bg-red-500/10 text-red-700"
          }`}
        >
          {pageMessage}
        </div>
      ) : null}

      <form method="get" className="space-y-4 rounded-lg border p-5">
        <h2 className="text-lg font-semibold">البحث والتصفية</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            name="q"
            defaultValue={query ?? ""}
            placeholder="بحث بالاسم أو هاتف ولي الأمر"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <select
            name="classId"
            defaultValue={classId ?? ""}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">كل الصفوف</option>
            {(classes ?? []).map((classItem) => (
              <option key={classItem.id} value={classItem.id}>
                {classItem.name}
              </option>
            ))}
          </select>
          <select
            name="gender"
            defaultValue={gender ?? ""}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">كل الأنواع</option>
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
          </select>
          <select
            name="studentStatus"
            defaultValue={studentStatus ?? ""}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="withdrawn">منسحب</option>
          </select>
          <select
            name="hasLatePayments"
            defaultValue={params.hasLatePayments ?? ""}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">كل الطلاب</option>
            <option value="true">عليهم تأخير أقساط</option>
            <option value="false">بدون تأخير أقساط</option>
          </select>
          <select
            name="alertLevel"
            defaultValue={alertLevel ?? ""}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">كل مستويات التنبيه</option>
            <option value="none">بدون تنبيه</option>
            <option value="medium">تنبيه متوسط</option>
            <option value="high">تنبيه مرتفع</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            تطبيق التصفية
          </button>
          <a
            href="/staff/students"
            className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            إعادة ضبط
          </a>
        </div>
      </form>

      <form action={createStudentAction} className="space-y-4 rounded-lg border p-5">
        <h2 className="text-lg font-semibold">إضافة طالب</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="fullName" className="text-sm font-medium">
              الاسم الكامل
            </label>
            <input
              id="fullName"
              name="fullName"
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="اسم الطالب"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="classId" className="text-sm font-medium">
              الصف
            </label>
            <select
              id="classId"
              name="classId"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">بدون صف</option>
              {(classes ?? []).map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="gender" className="text-sm font-medium">
              النوع
            </label>
            <select
              id="gender"
              name="gender"
              defaultValue="male"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="baseTuition" className="text-sm font-medium">
              القسط الأساسي
            </label>
            <input
              id="baseTuition"
              name="baseTuition"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="guardianPhone" className="text-sm font-medium">
              هاتف ولي الأمر
            </label>
            <input
              id="guardianPhone"
              name="guardianPhone"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="address" className="text-sm font-medium">
              العنوان
            </label>
            <input
              id="address"
              name="address"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          إضافة الطالب
        </button>
      </form>

      <section className="space-y-4 rounded-lg border p-5">
        <h2 className="text-lg font-semibold">
          الطلاب الحاليون ({studentsResult.success ? studentsResult.total : 0})
        </h2>

        {!studentsResult.success ? (
          <p className="text-sm text-red-700">{studentsResult.message}</p>
        ) : studentsResult.students.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا يوجد طلاب مطابقون للتصفية الحالية.</p>
        ) : (
          <div className="space-y-4">
            {studentsResult.students.map((student) => (
              <article key={student.id} className="rounded-lg border p-4">
                <div className="mb-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-4">
                  <div>
                    <span className="text-muted-foreground">الصف:</span>{" "}
                    {student.className ?? "-"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">الحالة:</span>{" "}
                    {student.status === "active" ? "نشط" : "منسحب"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">حضور:</span>{" "}
                    {student.attendance.presentCount}
                    {" / "}
                    <span className="text-muted-foreground">غياب:</span>{" "}
                    {student.attendance.absentCount}
                  </div>
                  <div>
                    <span className="text-muted-foreground">التنبيه المالي:</span>{" "}
                    {student.finance.alertLevel === "high"
                      ? "مرتفع"
                      : student.finance.alertLevel === "medium"
                        ? "متوسط"
                        : "لا يوجد"}
                  </div>
                </div>

                <div className="mb-4 rounded-md bg-muted/40 p-3 text-sm">
                  <div>المتبقي: {student.finance.remainingTotal.toLocaleString("ar-EG")} ج.م</div>
                  <div>الأقساط المتأخرة: {student.finance.overdueInstallments}</div>
                  <div>أقصى تأخير بالأيام: {student.finance.maxLateDays}</div>
                  {student.finance.alertMessage ? (
                    <div className="mt-1 text-amber-700">{student.finance.alertMessage}</div>
                  ) : null}
                </div>

                <form action={updateStudentAction} className="space-y-3">
                  <input type="hidden" name="id" value={student.id} />
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input
                      name="fullName"
                      required
                      defaultValue={student.fullName}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <select
                      name="classId"
                      defaultValue={student.classId ?? ""}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    >
                      <option value="">بدون صف</option>
                      {(classes ?? []).map((classItem) => (
                        <option key={classItem.id} value={classItem.id}>
                          {classItem.name}
                        </option>
                      ))}
                    </select>
                    <select
                      name="gender"
                      defaultValue={student.gender}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    >
                      <option value="male">ذكر</option>
                      <option value="female">أنثى</option>
                    </select>
                    <select
                      name="status"
                      defaultValue={student.status}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    >
                      <option value="active">نشط</option>
                      <option value="withdrawn">منسحب</option>
                    </select>
                    <input
                      name="baseTuition"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={student.baseTuition}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <input
                      name="guardianPhone"
                      defaultValue={student.guardianPhone ?? ""}
                      placeholder="هاتف ولي الأمر"
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <input
                      name="address"
                      defaultValue={student.address ?? ""}
                      placeholder="العنوان"
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary md:col-span-2"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                    >
                      حفظ التعديل
                    </button>
                    <a
                      href={`/staff/students?attendanceStudentId=${encodeURIComponent(student.id)}`}
                      className="inline-flex items-center rounded-md border px-4 py-2 text-sm hover:bg-muted"
                    >
                      عرض حضور/غياب
                    </a>
                  </div>
                </form>

                <form action={deleteStudentAction} className="mt-3">
                  <input type="hidden" name="id" value={student.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-md border border-red-500/40 px-3 py-1.5 text-sm text-red-700 hover:bg-red-500/10"
                  >
                    حذف الطالب
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-lg border p-5">
        <h2 className="text-lg font-semibold">الحضور والغياب</h2>
        <form action={upsertAttendanceAction} className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <select
            name="studentId"
            required
            defaultValue={attendanceStudentId ?? ""}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">اختر طالبا</option>
            {studentsResult.success
              ? studentsResult.students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName}
                  </option>
                ))
              : null}
          </select>
          <input
            type="date"
            name="attendanceDate"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <select
            name="status"
            defaultValue="present"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="present">حاضر</option>
            <option value="absent">غائب</option>
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            حفظ الحضور
          </button>
        </form>

        {attendanceStudentId && attendanceResult ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">آخر سجلات الحضور للطالب المحدد</h3>
            {!attendanceResult.success ? (
              <p className="text-sm text-red-700">{attendanceResult.message}</p>
            ) : attendanceResult.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد سجلات حضور/غياب حتى الآن.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b text-right">
                      <th className="px-2 py-2 font-medium">التاريخ</th>
                      <th className="px-2 py-2 font-medium">الحالة</th>
                      <th className="px-2 py-2 font-medium">وقت التسجيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceResult.rows.map((row) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="px-2 py-2">{row.attendanceDate}</td>
                        <td className="px-2 py-2">
                          {row.status === "present" ? "حاضر" : "غائب"}
                        </td>
                        <td className="px-2 py-2">
                          {new Date(row.createdAt).toLocaleString("ar-EG")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            اختر طالبا من الأعلى ثم احفظ حضور/غياب لعرض السجل هنا.
          </p>
        )}
      </section>
    </div>
  );
}
