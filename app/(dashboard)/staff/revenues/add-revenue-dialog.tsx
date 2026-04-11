"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { StaffModal } from "@/components/staff/staff-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormAction = (formData: FormData) => Promise<void>;

type AddRevenueDialogProps = {
  createRevenueAction: FormAction;
  defaultRevenueDate: string;
};

const outlineBtnClass =
  "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground";

export function AddRevenueDialog({ createRevenueAction, defaultRevenueDate }: AddRevenueDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-Yellow px-4 text-foreground shadow-sm hover:bg-Yellow/90 hover:scale-[1.02] transition-transform"
      >
        إضافة إيراد
      </Button>

      <StaffModal open={open} onClose={() => setOpen(false)} size="lg">
        <form action={createRevenueAction} className="space-y-4">
          <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
            <div className="min-w-0 space-y-1">
              <h3 className="text-base font-semibold">إضافة إيراد</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                سجّل إيراداً يدوياً (تبرع، إيجار، …). دفعات أقساط الطلاب تُضاف تلقائياً من صفحة الأقساط.
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="إغلاق"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="revenue-modal-title" className="text-muted-foreground">
                العنوان / الوصف
              </Label>
              <Input
                id="revenue-modal-title"
                name="title"
                required
                placeholder="مثال: تبرع، منحة، بيع مستلزمات…"
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="revenue-modal-amount" className="text-muted-foreground">
                المبلغ
              </Label>
              <Input
                id="revenue-modal-amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="revenue-modal-date" className="text-muted-foreground">
                تاريخ الإيراد
              </Label>
              <Input
                id="revenue-modal-date"
                name="revenueDate"
                type="date"
                defaultValue={defaultRevenueDate}
                className="rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button type="button" className={outlineBtnClass} onClick={() => setOpen(false)}>
              إلغاء
            </button>
            <Button type="submit" size="sm" className="bg-Yellow text-foreground hover:bg-Yellow/90">
              تسجيل الإيراد
            </Button>
          </div>
        </form>
      </StaffModal>
    </>
  );
}
