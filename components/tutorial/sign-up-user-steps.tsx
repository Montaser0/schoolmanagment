import Link from "next/link";

export function SignUpUserSteps() {
  return (
    <section className="rounded-md border p-4 text-sm">
      <h3 className="mb-2 text-base font-semibold">Create your first account</h3>
      <ol className="list-decimal space-y-1 pl-5 text-foreground/80">
        <li>Open the sign-up page and create an owner account.</li>
        <li>Confirm the email if email verification is enabled.</li>
        <li>Sign in and complete your school onboarding.</li>
      </ol>
      <div className="mt-3">
        <Link className="underline underline-offset-4" href="/sign-up">
          Go to sign up
        </Link>
      </div>
    </section>
  );
}
