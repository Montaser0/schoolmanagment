"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { StaffModal } from "@/components/staff/staff-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormAction = (formData: FormData) => Promise<void>;

type TuitionPaymentRowActionsProps = {
  paymentId: string;
  amount: number;
  revenueDate: string;
  updateTuitionPaymentAction: FormAction;
  deleteTuitionPaymentAction: FormAction;
};

const outlineBtnClass =
  "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground";

export function TuitionPaymentRowActions({
  paymentId,
  amount,
  revenueDate,
  updateTuitionPaymentAction,
  deleteTuitionPaymentAction,
}: TuitionPaymentRowActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 justify-end whitespace-nowrap">
      <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => setEditOpen(true)}>
        تعديل
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 rounded-lg border-red-500/40 text-xs text-red-800 hover:bg-red-500/10"
        onClick={() => setDeleteOpen(true)}
      >
        حذف
      </Button>

      <StaffModal open={editOpen} onClose={() => setEditOpen(false)} size="md">
        <form action={updateTuitionPaymentAction} className="space-y-4">
          <input type="hidden" name="paymentId" value={paymentId} />
          <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
            <h3 className="text-base font-semibold">تعديل دفعة قسط</h3>
            <button
              type="button"
              className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="إغلاق"
              onClick={() => setEditOpen(false)}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`tuition-payment-amount-${paymentId}`} className="text-muted-foreground">
                المبلغ
              </Label>
              <Input
                id={`tuition-payment-amount-${paymentId}`}
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                defaultValue={amount}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`tuition-payment-date-${paymentId}`} className="text-muted-foreground">
                تاريخ الدفعة
              </Label>
              <Input
                id={`tuition-payment-date-${paymentId}`}
                name="paidAt"
                type="date"
                required
                defaultValue={revenueDate.slice(0, 10)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button type="button" className={outlineBtnClass} onClick={() => setEditOpen(false)}>
              إلغاء
            </button>
            <Button type="submit" size="sm" className="bg-Yellow text-foreground hover:bg-Yellow/90">
              حفظ
            </Button>
          </div>
        </form>
      </StaffModal>

      <StaffModal open={deleteOpen} onClose={() => setDeleteOpen(false)} size="sm">
        <form action={deleteTuitionPaymentAction} className="space-y-4">
          <input type="hidden" name="paymentId" value={paymentId} />
          <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
            <h3 className="text-base font-semibold">حذف دفعة القسط</h3>
            <button
              type="button"
              className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="إغلاق"
              onClick={() => setDeleteOpen(false)}
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">هل تريد حذف دفعة القسط نهائيًا؟ لا يمكن التراجع.</p>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button type="button" className={outlineBtnClass} onClick={() => setDeleteOpen(false)}>
              إلغاء
            </button>
            <Button type="submit" variant="destructive" size="sm">
              حذف
            </Button>
          </div>
        </form>
      </StaffModal>
    </div>
  );
}
