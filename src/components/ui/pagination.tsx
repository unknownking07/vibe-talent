"use client";

import { useId, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

type PaginationBaseProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

type PaginationHeader = {
  label: string;
  pageSize: number;
  totalItems: number;
  itemNoun: string;
};

// Discriminated union: callers must provide either all four header fields or none.
type PaginationProps =
  | (PaginationBaseProps & PaginationHeader)
  | (PaginationBaseProps & {
      label?: never;
      pageSize?: never;
      totalItems?: never;
      itemNoun?: never;
    });

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];
  const siblings = 1;

  pages.push(1);

  const rangeStart = Math.max(2, current - siblings);
  const rangeEnd = Math.min(total - 1, current + siblings);

  if (rangeStart > 2) pages.push("...");

  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i);
  }

  if (rangeEnd < total - 1) pages.push("...");

  pages.push(total);

  return pages;
}

const btnBase =
  "flex items-center justify-center w-12 h-12 rounded-xl font-bold transition-all";

const ACTIVE_GLOW =
  "0 0 0 4px rgba(255, 58, 0, 0.18), 0 8px 24px rgba(255, 58, 0, 0.35)";

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  label,
  pageSize,
  totalItems,
  itemNoun,
}: PaginationProps) {
  const [jumpValue, setJumpValue] = useState("");
  const reactId = useId();
  const jumpInputId = `${reactId}-pagination-jump-input`;

  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);

  const handleJump = () => {
    const page = parseInt(jumpValue, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
      setJumpValue("");
    }
  };

  // The discriminated union guarantees these four come together; destructuring
  // strips that narrowing, so we re-check each individually for the type guard.
  const showHeader =
    label !== undefined &&
    pageSize !== undefined &&
    totalItems !== undefined &&
    itemNoun !== undefined;

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center gap-6 mt-4">
      {showHeader && (
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
            {label}
          </span>
          <p className="text-base text-[var(--text-muted)]">
            Showing{" "}
            <span className="font-bold text-[var(--foreground)]">
              {(currentPage - 1) * pageSize + 1}
              –{Math.min(currentPage * pageSize, totalItems)}
            </span>
            {" of "}
            <span className="font-bold text-[var(--foreground)]">
              {totalItems}
            </span>{" "}
            {itemNoun}
          </p>
        </div>
      )}

      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className={`${btnBase} text-[var(--text-muted)] hover:bg-[var(--bg-surface-light)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--bg-surface)]`}
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
          }}
          aria-label="First page"
        >
          <ChevronsLeft size={16} />
        </button>

        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`${btnBase} text-[var(--text-muted)] hover:bg-[var(--bg-surface-light)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--bg-surface)]`}
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
          }}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>

        {pages.map((page, idx) =>
          page === "..." ? (
            <span
              key={`ellipsis-${idx}`}
              className="flex items-center justify-center w-12 h-12 text-sm font-bold text-[var(--text-muted)] select-none"
            >
              …
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`${btnBase} text-sm ${
                currentPage === page
                  ? ""
                  : "hover:bg-[var(--bg-surface-light)]"
              }`}
              style={{
                backgroundColor:
                  currentPage === page ? "var(--accent)" : "var(--bg-surface)",
                color: currentPage === page ? "#FFFFFF" : "var(--foreground)",
                border:
                  currentPage === page
                    ? "1px solid var(--accent)"
                    : "1px solid var(--border-subtle)",
                boxShadow: currentPage === page ? ACTIVE_GLOW : "none",
              }}
              aria-label={`Page ${page}`}
              aria-current={currentPage === page ? "page" : undefined}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`${btnBase} text-[var(--text-muted)] hover:bg-[var(--bg-surface-light)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--bg-surface)]`}
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
          }}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className={`${btnBase} text-[var(--text-muted)] hover:bg-[var(--bg-surface-light)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--bg-surface)]`}
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
          }}
          aria-label="Last page"
        >
          <ChevronsRight size={16} />
        </button>
      </div>

      {totalPages > 5 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleJump();
          }}
          className="flex items-center gap-3 p-2 pl-5 rounded-2xl"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <label
            htmlFor={jumpInputId}
            className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]"
          >
            Go to page
          </label>
          <input
            id={jumpInputId}
            type="number"
            min={1}
            max={totalPages}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            placeholder={`1–${totalPages}`}
            className="w-24 h-10 px-3 rounded-lg text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={{
              backgroundColor: "var(--background)",
              border: "1px solid var(--border-subtle)",
              color: "var(--foreground)",
            }}
          />
          <button
            type="submit"
            className="px-5 h-10 rounded-lg text-xs font-extrabold uppercase tracking-[0.1em] text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--accent)" }}
          >
            Jump
          </button>
        </form>
      )}
    </nav>
  );
}
