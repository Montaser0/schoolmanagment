"use client";

import { upsertTeacherAttendance } from "@/actions/teachers";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type DailyTeacherAttendanceCheckboxProps = {
  teacherId: string;
  attendanceDate: string;
  initialPresent: boolean;
};

export function DailyTeacherAttendanceCheckbox({
  teacherId,
  attendanceDate,
  initialPresent,
}: DailyTeacherAttendanceCheckboxProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onChange(checked: boolean) {
    startTransition(async () => {
      const result = await upsertTeacherAttendance({
        teacherId,
        attendanceDate,
        status: checked ? "present" : "absent",
      });
      if (result.success) {
        router.refresh();
      } else {
        window.alert(result.message);
      }
    });
  }

  return (
    <label className="inline-flex cursor-pointer items-center justify-center gap-2">
      <input
        type="checkbox"
        checked={initialPresent}
        disabled={isPending}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 cursor-pointer rounded border border-input accent-primary disabled:opacity-50"
        aria-label="حاضر في التاريخ المحدد"
      />
      <span className="sr-only">حاضر</span>
    </label>
  );
}
