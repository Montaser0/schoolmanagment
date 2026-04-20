"use client";

import { useSearchParams } from "next/navigation";

export function SchoolsStatusAlert() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const message = searchParams.get("message");

  if (!message) return null;

  return (
    <div
      className={`rounded-md border px-4 py-3 text-sm ${
        status === "success"
          ? "border-green-500/40 bg-green-500/10 text-green-700"
          : "border-red-500/40 bg-red-500/10 text-red-700"
      }`}
    >
      {message}
    </div>
  );
}
