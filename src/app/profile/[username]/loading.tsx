function Shape({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

export default function ProfileLoading() {
  return (
    <div role="status" className="flex justify-center p-4 sm:p-8">
      <span className="sr-only">Loading builder profile</span>
      <div className="grid w-full max-w-[1200px] grid-cols-1 items-start gap-6 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-6">
          <aside className="flex flex-col gap-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-brutal)]" aria-hidden="true">
            <div className="flex flex-col items-center gap-4 text-center">
              <Shape className="h-[120px] w-[120px] rounded-full" />
              <div className="flex w-full flex-col items-center gap-2">
                <Shape className="h-6 w-40 max-w-full" />
                <Shape className="h-3 w-24" />
                <Shape className="h-3 w-28" />
              </div>
              <Shape className="mt-1 h-3 w-4/5" />
            </div>
            <div className="flex justify-center gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Shape key={index} className="h-9 w-9 rounded-full" />
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <Shape className="h-12 w-full rounded-xl" />
              <Shape className="mx-auto h-3 w-4/5" />
              <Shape className="mt-2 h-10 w-full rounded-xl" />
            </div>
          </aside>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-brutal)]" aria-hidden="true">
            <Shape className="h-4 w-36" />
            <Shape className="mt-3 h-3 w-24" />
          </div>
        </div>

        <div className="flex flex-col gap-6" aria-hidden="true">
          <div className="flex items-center justify-between gap-4 py-2">
            <Shape className="h-5 w-48 max-w-[65%]" />
            <Shape className="h-9 w-28 rounded-xl" />
          </div>
          <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-brutal)]">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex flex-col gap-2 border-r border-[var(--border-subtle)] px-3 py-4 last:border-r-0 sm:px-5">
                <Shape className="h-5 w-12" />
                <Shape className="h-3 w-full max-w-20" />
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-brutal)]">
            <Shape className="h-4 w-32" />
            <Shape className="mt-5 h-8 w-3/4" />
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-brutal)]">
            <Shape className="h-4 w-44" />
            <Shape className="mt-5 h-28 w-full" />
          </div>
          <section className="space-y-4">
            <Shape className="h-5 w-44" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Shape className="h-52 w-full rounded-2xl" />
              <Shape className="h-52 w-full rounded-2xl" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
