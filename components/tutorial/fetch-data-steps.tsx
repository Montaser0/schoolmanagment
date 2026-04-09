export function FetchDataSteps() {
  return (
    <section className="rounded-md border p-4 text-sm">
      <h3 className="mb-2 text-base font-semibold">Fetch data securely</h3>
      <ol className="list-decimal space-y-1 pl-5 text-foreground/80">
        <li>Create server-side Supabase clients for protected routes.</li>
        <li>Enable Row Level Security on all school data tables.</li>
        <li>Filter queries by the current user school context.</li>
      </ol>
    </section>
  );
}
