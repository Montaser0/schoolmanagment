import { StaffMenu } from "@/components/staff/staff-menu";
import { StaffNavbar } from "@/components/staff/staff-navbar";
import { resolveAppRole } from "@/lib/auth/resolve-app-role";
import { createClient } from "@/lib/supabase/server";
import logoImg from "@/app/images/logo.png";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

type StaffLayoutProps = {
  children: React.ReactNode;
};

export default async function StaffLayout({ children }: StaffLayoutProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const role = await resolveAppRole(supabase, user.id, user.email);

  if (role === "owner") {
    redirect("/admin");
  }

  const roleLabel =
    role === "staff" ? "موظف" : role === "owner" ? "مدير" : "—";

  return (
    <div className="h-screen flex bg-gray-50">
      {/* المحتوى الرئيسي — يسار الشاشة (LTR) مع هامش لعرض الشريط الثابت على اليمين */}
      <div className="flex-1 mr-20 lg:mr-64 bg-gray-50 min-w-0">
        <div className="fixed top-0 left-0 right-20 lg:right-64 z-40">
          <StaffNavbar />
        </div>

        <div className="pt-16 lg:pt-20 min-h-full" dir="rtl">
          {children}
        </div>
      </div>

      {/* الشريط الجانبي — ثابت على يمين الشاشة */}
      <div
        className="w-20 lg:w-64 bg-white border-l border-gray-200 shadow-lg flex-shrink-0 flex flex-col fixed right-0 top-0 h-full z-50"
        dir="rtl"
      >
        <Link
          href="/staff"
          className="flex flex-col lg:flex-row items-center gap-3 justify-center p-4 lg:p-6 border-b border-gray-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-300 group flex-shrink-0"
        >
          <div className="p-2 group-hover:shadow-md transition-all duration-300 rounded-xl">
            <Image
              src={logoImg}
              alt="شعار نظام التعليم"
              width={32}
              height={32}
              className="rounded-xl object-contain"
              priority
            />
          </div>
          <span className="hidden lg:block text-xl font-bold text-black text-center lg:text-right">
            نظام التعليم
          </span>
        </Link>
        <StaffMenu roleLabel={roleLabel} />
      </div>
    </div>
  );
}
