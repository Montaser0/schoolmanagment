import {
  createStudentInstallment,
  deleteStudentInstallment,
  listInstallmentLines,
  recordTuitionPayment,
  updateStudentInstallment,
  type InstallmentPaymentStatus,
} from "@/actions/student-installments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveSchoolId } from "@/lib/auth/resolve-school-id";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { InstallmentRowActions } from "./installment-row-actions";

type PageSearchParams = Promise<{
  status?: string;
  classId?: string;
  flash?: string;
  flashType?: string;
}>;

const STATUS_OPTIONS: { value: InstallmentPaymentStatus | "all"; label: string }[] = [
  { value: "all", label: "كل الحالات" },
  { value: "unpaid", label: "غير مسدد" },
  { value: "late", label: "متأخر" },
  { value: "paid_partial", label: "مسدد جزئياً" },
];

function parseStatusParam(raw: string | undefined): InstallmentPaymentStatus | "all" {
  const v = raw?.trim() ?? "";
  /** الأقساط المسددة بالكامل لا تُعرض في القائمة */
  if (v === "paid_full") return "all";
  if (v === "paid_partial" || v === "late" || v === "unpaid") return v;
  return "all";
}

function buildListUrl(status: string, classId: string) {
  const q = new URLSearchParams();
  if (status && status !== "all") q.set("status", status);
  if (classId) q.set("classId", classId);
  const s = q.toString();
  return s ? `/staff/student-installments?${s}` : "/staff/student-installments";
}

function buildFlashUrl(type: "success" | "error", message: string, preserve: { status: string; classId: string }) {
  const q = new URLSearchParams();
  q.set("flashType", type);
  q.set("flash", message);
  if (preserve.status && preserve.status !== "all") q.set("status", preserve.status);
  if (preserve.classId) q.set("classId", preserve.classId);
  return `/staff/student-installments?${q.toString()}`;
}

const selectClassName = cn(
  "flex h-10 min-w-[180px] rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors",
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
);

function asPositiveNumber(value: FormDataEntryValue | null): number | undefined {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const n = Number.parseFloat(text);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

export default async function StudentInstallmentsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = (await searchParams) ?? {};
  const statusFilter = parseStatusParam(params.status);
  const classFilter = params.classId?.trim() ?? "";
  const flash = params.flash?.trim();
  const flashType = params.flashType === "success" ? "success" : params.flashType === "error" ? "error" : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const schoolId = await resolveSchoolId(supabase, user.id, user.email);
  if (!schoolId) {
    return (
      <div className="p-4 flex flex-col gap-8" dir="rtl">
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-center text-sm text-amber-900">
          لم يتم العثور على مدرسة مرتبطة بحسابك.
        </div>
      </div>
    );
  }

  const [{ data: schoolRow }, { data: classRows }, listResult] = await Promise.all([
    supabase.from("schools").select("name").eq("id", schoolId).maybeSingle(),
    supabase.from("classes").select("id,name").eq("school_id", schoolId).order("name", { ascending: true }),
    listInstallmentLines({
      paymentStatus: statusFilter,
      classId: classFilter || undefined,
    }),
  ]);

  const schoolName = (schoolRow as { name?: string } | null)?.name ?? "مدرستك";
  const classes = (classRows ?? []) as { id: string; name: string }[];

  const lines = listResult.success ? listResult.lines : [];

  async function applyFiltersAction(formData: FormData) {
    "use server";
    const status = String(formData.get("status") ?? "all");
    const classId = String(formData.get("classId") ?? "").trim();
    redirect(buildListUrl(status, classId));
  }

  async function recordPaymentAction(formData: FormData) {
    "use server";
    const studentId = String(formData.get("studentId") ?? "").trim();
    const installmentId = String(formData.get("installmentId") ?? "").trim();
    const amount = asPositiveNumber(formData.get("amount"));
    const preserveStatus = String(formData.get("preserveStatus") ?? "all");
    const preserveClassId = String(formData.get("preserveClassId") ?? "").trim();

    if (amount === undefined) {
      redirect(buildFlashUrl("error", "أدخل مبلغ دفعة صالحًا.", { status: preserveStatus, classId: preserveClassId }));
      return;
    }

    const result = await recordTuitionPayment({
      studentId,
      installmentId,
      amount,
    });

    redirect(
      buildFlashUrl(result.success ? "success" : "error", result.message, {
        status: preserveStatus,
        classId: preserveClassId,
      }),
    );
  }

  async function deleteInstallmentRowAction(formData: FormData) {
    "use server";
    const installmentId = String(formData.get("installmentId") ?? "").trim();
    const preserveStatus = String(formData.get("preserveStatus") ?? "all");
    const preserveClassId = String(formData.get("preserveClassId") ?? "").trim();
    const result = await deleteStudentInstallment(installmentId);
    redirect(
      buildFlashUrl(result.success ? "success" : "error", result.message, {
        status: preserveStatus,
        classId: preserveClassId,
      }),
    );
  }

  async function updateInstallmentRowAction(formData: FormData) {
    "use server";
    const installmentId = String(formData.get("installmentId") ?? "").trim();
    const dueDate = String(formData.get("dueDate") ?? "").trim();
    const totalAmount = asPositiveNumber(formData.get("totalAmount"));
    const preserveStatus = String(formData.get("preserveStatus") ?? "all");
    const preserveClassId = String(formData.get("preserveClassId") ?? "").trim();
    const result = await updateStudentInstallment({ installmentId, totalAmount, dueDate });
    redirect(
      buildFlashUrl(result.success ? "success" : "error", result.message, {
        status: preserveStatus,
        classId: preserveClassId,
      }),
    );
  }

  async function createInstallmentRowAction(formData: FormData) {
    "use server";
    const studentId = String(formData.get("studentId") ?? "").trim();
    const dueDate = String(formData.get("dueDate") ?? "").trim();
    const totalAmount = asPositiveNumber(formData.get("totalAmount"));
    const preserveStatus = String(formData.get("preserveStatus") ?? "all");
    const preserveClassId = String(formData.get("preserveClassId") ?? "").trim();
    const result = await createStudentInstallment({ studentId, totalAmount, dueDate });
    redirect(
      buildFlashUrl(result.success ? "success" : "error", result.message, {
        status: preserveStatus,
        classId: preserveClassId,
      }),
    );
  }

  return (
    <div className="bg-white p-4 rounded-md mt-4 max-w-6xl mx-auto" dir="rtl">
      <p className="mb-2 text-xs text-muted-foreground">{schoolName}</p>

      {flash && flashType ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            flashType === "success"
              ? "border-green-500/40 bg-green-500/10 text-green-800"
              : "border-red-500/40 bg-red-500/10 text-red-800"
          }`}
        >
          {flash}
        </div>
      ) : null}

      <section className="bg-white rounded-md overflow-hidden">
        <div className="flex items-center justify-between">
          <h1 className="hidden md:block text-lg font-semibold mr-2">الأقساط السنوية للطلاب</h1>
          <form action={applyFiltersAction} className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="filterStatus" className="text-xs text-muted-foreground">
                  حالة القسط
                </Label>
                <select id="filterStatus" name="status" defaultValue={statusFilter} className={`${selectClassName} h-10`}>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="filterClass" className="text-xs text-muted-foreground">
                  الصف
                </Label>
                <select id="filterClass" name="classId" defaultValue={classFilter} className={`${selectClassName} h-10`}>
                  <option value="">كل الصفوف</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="submit"
                className="h-10 rounded-md bg-Yellow px-4 text-foreground shadow-sm hover:bg-Yellow/90 hover:scale-[1.02] transition-transform"
              >
                تطبيق
              </Button>
            </div>
          </form>
        </div>

        <p className="text-xs text-muted-foreground mt-2 mb-2 mr-2">
          <Link href="/staff/studentlist" className="font-medium text-foreground underline-offset-4 hover:underline">
            قائمة الطلاب
          </Link>
          <span className="mx-1.5 text-muted-foreground">·</span>
          <Link href="/staff/students" className="font-medium text-foreground underline-offset-4 hover:underline">
            إضافة طالب
          </Link>
          {listResult.success ? <span className="mr-3">عدد السجلات: {lines.length}</span> : null}
        </p>

        {!listResult.success ? <span className="text-sm text-red-700">{listResult.message}</span> : null}

        {!listResult.success ? null : lines.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            لا توجد أقساط سنوية مطابقة للتصفية. عرّف الطالب من «إضافة طالب» بقسط سنوي أكبر من صفر وتاريخ استحقاق ليظهر
            القسط هنا.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm mt-4">
              <thead>
                <tr className="border-b bg-white text-right text-gray-800">
                  <th className="px-4 py-3 font-semibold text-center">اسم الطالب</th>
                  <th className="px-4 py-3 font-semibold text-center">الصف</th>
                  <th className="px-4 py-3 font-semibold text-center">تاريخ الاستحقاق</th>
                  <th className="px-4 py-3 font-semibold text-center">المبلغ</th>
                  <th className="px-4 py-3 font-semibold text-center">المدفوع</th>
                  <th className="px-4 py-3 font-semibold text-center">المتبقي</th>
                  <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">دفعة</th>
                  <th className="px-4 py-3 font-semibold text-start whitespace-nowrap">الاجراءات</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const canPay = line.paymentStatus !== "paid_full";
                  return (
                    <tr
                      key={line.installmentId}
                      className={`hover:bg-slate-100 border-b align-top ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
                    >
                      <td className="px-4 py-3 text-center font-medium">{line.studentName}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{line.className ?? "—"}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap tabular-nums">{line.dueDate}</td>
                      <td className="px-4 py-3 text-center tabular-nums">${line.totalAmount.toLocaleString("en-US")}</td>
                      <td className="px-4 py-3 text-center tabular-nums">${line.totalPaid.toLocaleString("en-US")}</td>
                      <td className="px-4 py-3 text-center tabular-nums">${line.remaining.toLocaleString("en-US")}</td>
                      <td className="px-4 py-3">
                        {canPay ? (
                          <form action={recordPaymentAction} className="flex items-center justify-end gap-1 whitespace-nowrap">
                            <input type="hidden" name="studentId" value={line.studentId} />
                            <input type="hidden" name="installmentId" value={line.installmentId} />
                            <input type="hidden" name="preserveStatus" value={statusFilter} />
                            <input type="hidden" name="preserveClassId" value={classFilter} />
                            <Input
                              name="amount"
                              type="number"
                              min="0.01"
                              step="0.01"
                              placeholder="المبلغ"
                              required
                              className="h-8 w-[6rem] rounded-lg text-xs"
                            />
                            <Button type="submit" variant="outline" size="sm" className="h-8 shrink-0 text-xs">
                              تسجيل
                            </Button>
                          </form>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <InstallmentRowActions
                          installmentId={line.installmentId}
                          studentId={line.studentId}
                          totalAmount={line.totalAmount}
                          dueDate={line.dueDate}
                          totalPaid={line.totalPaid}
                          preserveStatus={statusFilter}
                          preserveClassId={classFilter}
                          deleteInstallmentAction={deleteInstallmentRowAction}
                          updateInstallmentAction={updateInstallmentRowAction}
                          createInstallmentAction={createInstallmentRowAction}
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
