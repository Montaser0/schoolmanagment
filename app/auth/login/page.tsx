import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <div
      className="flex min-h-svh w-full items-center justify-center bg-gradient-to-b from-sky/20 via-background to-muted/30 p-6 md:p-10"
      dir="rtl"
    >
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  );
}
