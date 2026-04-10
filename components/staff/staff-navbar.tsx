import { AuthButton } from "@/components/auth-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";

export async function StaffNavbar() {
  return (
    <header
      className="h-16 lg:h-20 border-b border-gray-200 bg-white shadow-sm flex items-center justify-between px-4 md:px-6"
      dir="rtl"
    >
      <Link
        href="/staff"
        className="text-sm font-semibold text-gray-800 hover:text-gray-950 transition-colors"
      >
        لوحة المدرسة
      </Link>
      <div className="flex items-center gap-3 text-sm">
        {!hasEnvVars ? (
          <EnvVarWarning />
        ) : (
          <Suspense fallback={<span className="text-muted-foreground">…</span>}>
            <AuthButton />
          </Suspense>
        )}
      </div>
    </header>
  );
}
