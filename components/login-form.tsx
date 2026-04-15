"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/app/images/logo.png";
import Image from "next/image";
import { useState } from "react";
import { resolveAppRole } from "@/lib/auth/resolve-app-role";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      if (!data.session) {
        throw new Error("تم تسجيل الدخول لكن لم تُفعَّل جلسة. حاول مرة أخرى.");
      }

      const role = await resolveAppRole(supabase, data.user.id, data.user.email);

      if (!role) {
        throw new Error(
          "لم يُعثر على دورك في النظام. تأكد من وجود سجل في جدول users مرتبط بنفس معرّف المستخدم في auth، وأن الحقل role/type يحتوي owner أو staff.",
        );
      }

      const redirectPath = role === "owner" ? "/admin" : "/staff";
      window.location.assign(redirectPath);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "حدث خطأ غير متوقع.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden rounded-2xl border-border shadow-lg">
        <div className="h-1.5 bg-sky" aria-hidden />
        <CardHeader className="space-y-3 bg-muted/20 pb-4 pt-6">
          <div className="flex justify-center">
            <Image
              src={logo}
              alt="شعار نظام إدارة المدرسة"
              width={96}
              height={96}
              priority
              className="h-24 w-24 object-contain"
            />
          </div>
          <CardTitle className="text-center text-2xl font-semibold tracking-tight text-foreground">تسجيل الدخول</CardTitle>
          <CardDescription className="text-center text-sm leading-relaxed text-gray-600">
            أدخل البريد الإلكتروني وكلمة المرور للوصول إلى لوحة المدرسة.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0">
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-5">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-base text-muted-foreground">
                  البريد الإلكتروني
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@school.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-lg px-4 py-3 text-base md:text-base"
                  autoComplete="email"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password" className="text-base text-muted-foreground">
                  كلمة المرور
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-lg px-4 py-3 text-base md:text-base"
                  autoComplete="current-password"
                />
              </div>
              {error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-800"
                >
                  {error}
                </div>
              ) : null}
              <Button
                type="submit"
                disabled={isLoading}
                className="h-12 w-full rounded-xl bg-Yellow text-base text-foreground shadow-sm transition-transform hover:bg-Yellow/90 hover:scale-[1.01] disabled:hover:scale-100"
              >
                {isLoading ? "جاري تسجيل الدخول…" : "دخول"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
