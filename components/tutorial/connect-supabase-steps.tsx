export function ConnectSupabaseSteps() {
  return (
    <section className="rounded-md border p-4 text-sm">
      <h3 className="mb-2 text-base font-semibold">Connect Supabase</h3>
      <ol className="list-decimal space-y-1 pl-5 text-foreground/80">
        <li>Create a Supabase project.</li>
        <li>
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code>.
        </li>
        <li>Restart the dev server after updating environment variables.</li>
      </ol>
    </section>
  );
}
