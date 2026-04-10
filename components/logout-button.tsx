"use client";

import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

type LogoutButtonProps = {
  className?: string;
  children?: ReactNode;
};

export function LogoutButton({ className, children = "Logout" }: LogoutButtonProps) {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <Button type="button" className={className} onClick={() => void logout()}>
      {children}
    </Button>
  );
}
