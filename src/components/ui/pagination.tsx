"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Build the list of page numbers to display, with ellipsis gaps.
 * Always shows: first page, last page, and up to 2 pages around the current page.
 * Example for page 5 of 20: [1, "...", 4, 5, 6, "...", 20]
 */
function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];
  const siblings = 1; // pages on each side of current

  // Always include first page
  pages.push(1);

  const rangeStart = Math.max(2, current - siblings);
  const rangeEnd = Math.min(total - 1, current + siblings);

  if (rangeStart > 2) pages.push("...");

  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i);
  }

  if (rangeEnd < total - 1) pages.push("...");

  // Always include last page
  pages.push(total);

  return pages;
}

const btnBase =
  "flex items-center justify-center w-10 h-10 font-extrabold uppercase transition-all";

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const [jumpValue, setJumpValue] = useState("");

  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);

  const handleJump = () => {
    const page = parseInt(jumpValue, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
      setJumpValue("");
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 mt-4">
    <div className="flex items-center justify-center gap-2">
      {/* First page */}
      <button
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        className={`${btnBase} disabled:opacity-30 disabled:cursor-not-allowed`}
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal-sm)",
        }}
        aria-label="First page"
      >
        <ChevronsLeft size={16} />
      </button>

      {/* Previous page */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`${btnBase} disabled:opacity-30 disabled:cursor-not-allowed`}
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal-sm)",
        }}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>

      {/* Page numbers */}
      {pages.map((page, idx) =>
        page === "..." ? (
          <span
            key={`ellipsis-${idx}`}
            className="flex items-center justify-center w-10 h-10 text-sm font-extrabold text-[var(--text-muted)] select-none"
          >
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`${btnBase} text-sm`}
            style={{
              backgroundColor: currentPage === page ? "var(--accent)" : "var(--bg-surface)",
              color: currentPage === page ? "#FFFFFF" : "var(--foreground)",
              border: "2px solid var(--border-hard)",
              boxShadow: currentPage === page ? "none" : "var(--shadow-brutal-sm)",
            }}
            aria-label={`Page ${page}`}
            aria-current={currentPage === page ? "page" : undefined}
          >
            {page}
          </button>
        )
      )}

      {/* Next page */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`${btnBase} disabled:opacity-30 disabled:cursor-not-allowed`}
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal-sm)",
        }}
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>

      {/* Last page */}
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        className={`${btnBase} disabled:opacity-30 disabled:cursor-not-allowed`}
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal-sm)",
        }}
        aria-label="Last page"
      >
        <ChevronsRight size={16} />
      </button>
    </div>

    {/* Go to page */}
    {totalPages > 7 && (
      <form
        onSubmit={(e) => { e.preventDefault(); handleJump(); }}
        className="flex items-center gap-2"
      >
        <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
          Go to page
        </label>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={jumpValue}
          onChange={(e) => setJumpValue(e.target.value)}
          placeholder={`1–${totalPages}`}
          className="input-brutal w-24 text-center text-sm"
        />
        <button
          type="submit"
          className="px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-white transition-colors hover:bg-[#E03300]"
          style={{
            backgroundColor: "var(--accent)",
            border: "2px solid var(--border-hard)",
          }}
        >
          Go
        </button>
      </form>
    )}
    </div>
  );
}
