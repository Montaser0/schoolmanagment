import { createSchoolWithOwner } from "@/actions/school";
import { redirect } from "next/navigation";

type SchoolsPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

export default async function SchoolsPage({ searchParams }: SchoolsPageProps) {
  const params = (await searchParams) ?? {};
  const status = params.status;
  const message = params.message;

  async function createSchoolAction(formData: FormData) {
    "use server";

    const schoolName = String(formData.get("schoolName") ?? "");
    const ownerEmail = String(formData.get("ownerEmail") ?? "");
    const ownerPassword = String(formData.get("ownerPassword") ?? "");
    const subscriptionPlan = String(formData.get("subscriptionPlan") ?? "trial");

    const result = await createSchoolWithOwner({
      schoolName,
      ownerEmail,
      ownerPassword,
      subscriptionPlan:
        subscriptionPlan === "basic" ||
        subscriptionPlan === "pro" ||
        subscriptionPlan === "enterprise"
          ? subscriptionPlan
          : "trial",
    });

    if (!result.success) {
      redirect(
        `/admin/schools?status=error&message=${encodeURIComponent(result.message)}`,
      );
    }

    redirect(
      `/admin/schools?status=success&message=${encodeURIComponent(result.message)}`,
    );
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">إنشاء مدرسة جديدة</h1>
        <p className="text-sm text-muted-foreground">
          أدخل بيانات المدرسة وبيانات حساب المالك لتسجيل الدخول على المنصة.
        </p>
      </div>

      {message ? (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            status === "success"
              ? "border-green-500/40 bg-green-500/10 text-green-700"
              : "border-red-500/40 bg-red-500/10 text-red-700"
          }`}
        >
          {message}
        </div>
      ) : null}

      <form action={createSchoolAction} className="space-y-4 rounded-lg border p-5">
        <div className="space-y-2">
          <label htmlFor="schoolName" className="text-sm font-medium">
            اسم المدرسة
          </label>
          <input
            id="schoolName"
            name="schoolName"
            type="text"
            required
            minLength={2}
            placeholder="مثال: مدرسة النخبة"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-0 focus:border-primary"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="ownerEmail" className="text-sm font-medium">
            بريد مالك المدرسة
          </label>
          <input
            id="ownerEmail"
            name="ownerEmail"
            type="email"
            required
            placeholder="owner@school.com"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-0 focus:border-primary"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="ownerPassword" className="text-sm font-medium">
            كلمة مرور المالك
          </label>
          <input
            id="ownerPassword"
            name="ownerPassword"
            type="password"
            required
            minLength={6}
            placeholder="6 أحرف على الأقل"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-0 focus:border-primary"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="subscriptionPlan" className="text-sm font-medium">
            خطة الاشتراك
          </label>
          <select
            id="subscriptionPlan"
            name="subscriptionPlan"
            defaultValue="trial"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-0 focus:border-primary"
          >
            <option value="trial">Trial</option>
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          إنشاء المدرسة والحساب
        </button>
      </form>
    </div>
  );
}
