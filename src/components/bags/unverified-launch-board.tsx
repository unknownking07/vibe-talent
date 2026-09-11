"use client";

import { useId, useMemo, useState } from "react";
import { CaretLeft, CaretRight, MagnifyingGlass } from "@phosphor-icons/react";

import { launchMatchesQuery, type UnverifiedLaunch } from "@/lib/bags-board";
import { UnverifiedLaunchRow } from "./unverified-launch-row";

/** Rows per page. Matches what the board showed before it could be paged. */
const PAGE_SIZE = 25;

/**
 * The tracked-but-unverified launches, paged and filterable.
 *
 * Client-side on purpose. Every row is already read server-side to build the
 * verified board above, so paging here costs no extra query — and doing it on
 * a search param instead would turn /bags dynamic and cost it the hourly ISR
 * window the sync cadence makes free.
 *
 * Searching matters more than paging does: only a few dozen of these launches
 * report any volume, so the "busiest first" order goes flat almost immediately
 * and the later pages are unranked. Filtering is the only way to find a
 * specific coin in the tail.
 */
export function UnverifiedLaunchBoard({
  launches,
}: {
  launches: UnverifiedLaunch[];
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const searchId = useId();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return launches;
    return launches.filter((launch) => launchMatchesQuery(launch, needle));
  }, [launches, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamped rather than stored: a filter that shrinks the list can strand the
  // page number past the end, and correcting that in an effect would render an
  // empty list first.
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  // Stepped from the clamped page, not the stored one, so a move made while the
  // stored page is stranded past the end lands next to what is on screen.
  const goTo = (next: number) =>
    setPage(Math.min(Math.max(next, 1), pageCount));

  return (
    <>
      <div className="relative mb-4">
        <label className="sr-only" htmlFor={searchId}>
          Search tracked launches by name, ticker, creator or mint
        </label>
        <MagnifyingGlass
          size={15}
          weight="bold"
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--bags-text-faint)]"
        />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search name, ticker, creator or mint"
          // The border is a class, not an inline style like the rest of this
          // page: an inline border outranks the focus variant, which would
          // leave a keyboard user with no focus indicator at all.
          className="w-full rounded-2xl border border-[var(--bags-border)] py-3 pl-11 pr-4 text-[13px] text-[var(--bags-text)] outline-none transition-colors placeholder:text-[var(--bags-text-faint)] focus:border-[var(--bags-green)]"
          style={{ backgroundColor: "var(--bags-surface)" }}
        />
      </div>

      {visible.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {visible.map((launch) => (
            <UnverifiedLaunchRow key={launch.mint} launch={launch} />
          ))}
        </ul>
      ) : (
        <p
          className="rounded-2xl px-5 py-8 text-center text-[13px] text-[var(--bags-text-muted)]"
          style={{
            backgroundColor: "var(--bags-surface)",
            border: "1px solid var(--bags-border)",
          }}
        >
          No tracked launch matches &ldquo;{query.trim()}&rdquo;.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {/* Announced so a filter typed into the box reports its own result
            instead of silently rewriting the list under the cursor. */}
        <p
          aria-live="polite"
          className="text-[12px] text-[var(--bags-text-faint)]"
        >
          {filtered.length > 0
            ? `${start + 1}–${start + visible.length} of ${filtered.length}`
            : "0"}{" "}
          {filtered.length === 1 ? "launch" : "launches"}
          {query.trim() ? ` matching “${query.trim()}”` : ""}
        </p>

        {pageCount > 1 ? (
          <div className="flex items-center gap-2">
            <PagerButton
              label="Previous page"
              disabled={currentPage === 1}
              onClick={() => goTo(currentPage - 1)}
            >
              <CaretLeft size={13} weight="bold" aria-hidden="true" />
            </PagerButton>
            <span className="font-mono text-[12px] text-[var(--bags-text-muted)]">
              {currentPage} / {pageCount}
            </span>
            <PagerButton
              label="Next page"
              disabled={currentPage === pageCount}
              onClick={() => goTo(currentPage + 1)}
            >
              <CaretRight size={13} weight="bold" aria-hidden="true" />
            </PagerButton>
          </div>
        ) : null}
      </div>
    </>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--bags-text-muted)] transition-colors enabled:hover:text-[var(--bags-text)] disabled:opacity-30"
      style={{
        backgroundColor: "var(--bags-surface)",
        border: "1px solid var(--bags-border)",
      }}
    >
      {children}
    </button>
  );
}
