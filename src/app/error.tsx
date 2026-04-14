"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-24 text-center">
      <div
        className="text-[120px] font-extrabold font-mono leading-none text-[var(--accent)]"
        style={{ WebkitTextStroke: "3px var(--foreground)" }}
      >
        500
      </div>
      <h1 className="text-3xl font-extrabold uppercase text-[var(--foreground)] mt-4">
        Something Went Wrong
      </h1>
      <p className="mt-3 text-[var(--text-secondary)] font-medium">
        An unexpected error occurred. Try refreshing, or head back home.
      </p>
      <div className="mt-8 flex gap-4 justify-center">
        <button
          onClick={reset}
          className="btn-brutal btn-brutal-primary flex items-center gap-2"
        >
          <RotateCcw size={16} />
          Try Again
        </button>
        <Link
          href="/"
          className="btn-brutal btn-brutal-secondary flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Go Home
        </Link>
      </div>
    </div>
  );
}
