import { LoginForm } from "@/components/login-form";
import { resolveAppRole } from "@/lib/auth/resolve-app-role";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

function LoginFallback() {
  return (
    <div className="min-h-screen w-full bg-muted/30 p-4 md:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md items-center justify-center md:min-h-[calc(100vh-4rem)]">
        <LoginForm className="w-full" />
      </div>
    </div>
  );
}

async function HomeContent() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    const role = await resolveAppRole(supabase, session.user.id, session.user.email);

    if (role === "owner") {
      redirect("/admin");
    }

    if (role === "staff") {
      redirect("/staff");
    }
  }

  return <LoginFallback />;
}

export default function Home() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <HomeContent />
    </Suspense>
  );
}
