import { createTeacher } from "@/actions/teachers";
import { resolveSchoolId } from "@/lib/auth/resolve-school-id";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

type AddTeachersPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

function buildRedirectUrl(status: "success" | "error", message: string) {
  return `/staff/addteachers?status=${status}&message=${encodeURIComponent(message)}`;
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

export default async function StaffAddTeachersPage({ searchParams }: AddTeachersPageProps) {
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

  async function createTeacherAction(formData: FormData) {
    "use server";
    const fullName = String(formData.get("fullName") ?? "").trim();
    const phone = asNullableText(formData.get("phone"));
    const subject = asNullableText(formData.get("subject"));
    const salary = asNullableNumber(formData.get("salary"));
    const salaryInstallmentDueDate = asNullableText(formData.get("salaryInstallmentDueDate"));

    const result = await createTeacher({
      fullName,
      phone,
      subject,
      salary,
      salaryInstallmentDueDate: salaryInstallmentDueDate ?? undefined,
    });

    redirect(buildRedirectUrl(result.success ? "success" : "error", result.message));
  }

  return (
    <div className="w-full max-w-6xl space-y-6" dir="rtl">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">إضافة معلم</h1>
        <p className="text-sm text-muted-foreground">
          تسجيل معلم جديد في مدرستك (الحقول وفق جدول المعلمين في قاعدة البيانات).
        </p>
        <p className="text-xs text-muted-foreground">
          <Link href="/staff/teacher-installments" className="underline hover:text-foreground">
            رواتب وأقساط المعلمين
          </Link>
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

      <form action={createTeacherAction} className="space-y-4 rounded-lg border p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="fullName" className="text-sm font-medium">
              الاسم الكامل
            </label>
            <input
              id="fullName"
              name="fullName"
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="اسم المعلم"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium">
              الهاتف
            </label>
            <input
              id="phone"
              name="phone"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="salary" className="text-sm font-medium">
              الراتب (أساس قسط الراتب)
            </label>
            <input
              id="salary"
              name="salary"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <p className="text-xs text-muted-foreground">
              إذا كان أكبر من صفر، يُنشأ تلقائياً قسط راتب بنفس المبلغ؛ يجب تعبئة تاريخ الاستحقاق أدناه.
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor="salaryInstallmentDueDate" className="text-sm font-medium">
              تاريخ استحقاق قسط الراتب الأول
            </label>
            <input
              id="salaryInstallmentDueDate"
              name="salaryInstallmentDueDate"
              type="date"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <p className="text-xs text-muted-foreground">
              يُستخدم فقط عندما يكون الراتب أكبر من صفر. حالة الصرف تظهر في «رواتب وأقساط المعلمين».
            </p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="subject" className="text-sm font-medium">
              المادة / التخصص
            </label>
            <input
              id="subject"
              name="subject"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="مثال: رياضيات، لغة عربية…"
            />
          </div>
        </div>
        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          إضافة المعلم
        </button>
      </form>
    </div>
  );
}
