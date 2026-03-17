import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-24 text-center">
      <div
        className="text-[120px] font-extrabold font-mono leading-none text-[var(--accent)]"
        style={{ WebkitTextStroke: "3px #0F0F0F" }}
      >
        404
      </div>
      <h1 className="text-3xl font-extrabold uppercase text-[#0F0F0F] mt-4">
        Page Not Found
      </h1>
      <p className="mt-3 text-[#52525B] font-medium">
        This page doesn&apos;t exist on VibeTalent. Maybe the builder shipped it somewhere else.
      </p>
      <div className="mt-8 flex gap-4 justify-center">
        <Link
          href="/"
          className="btn-brutal btn-brutal-primary flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Go Home
        </Link>
        <Link
          href="/explore"
          className="btn-brutal btn-brutal-secondary"
        >
          Explore Talent
        </Link>
      </div>
    </div>
  );
}
