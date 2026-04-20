import { createSchoolWithOwner } from "@/actions/school";
import InputField from "@/components/component/InputField";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SchoolsStatusAlert } from "./schools-status-alert";

export default async function SchoolsPage() {

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

      <Suspense fallback={null}>
        <SchoolsStatusAlert />
      </Suspense>

      <form action={createSchoolAction} className="space-y-4 rounded-lg border p-5">
        <InputField
          label="اسم المدرسة"
          name="schoolName"
          containerClassName="space-y-2"
          width="full"
          inputClassName="rounded-md border bg-background px-3 py-2 text-sm outline-none ring-0 focus:border-primary"
          inputProps={{
            id: "schoolName",
            required: true,
            minLength: 2,
            placeholder: "مثال: مدرسة النخبة",
          }}
        />

        <InputField
          label="بريد مالك المدرسة"
          name="ownerEmail"
          type="email"
          containerClassName="space-y-2"
          width="full"
          inputClassName="rounded-md border bg-background px-3 py-2 text-sm outline-none ring-0 focus:border-primary"
          inputProps={{
            id: "ownerEmail",
            required: true,
            placeholder: "owner@school.com",
          }}
        />

        <InputField
          label="كلمة مرور المالك"
          name="ownerPassword"
          type="password"
          containerClassName="space-y-2"
          width="full"
          inputClassName="rounded-md border bg-background px-3 py-2 text-sm outline-none ring-0 focus:border-primary"
          inputProps={{
            id: "ownerPassword",
            required: true,
            minLength: 6,
            placeholder: "6 أحرف على الأقل",
          }}
        />

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
