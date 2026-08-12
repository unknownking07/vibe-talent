import type { ReactNode } from "react";
import Image from "next/image";
import { CheckCircle } from "@phosphor-icons/react";

/**
 * Shared chrome for the auth flow (login, signup, forgot/reset password).
 *
 * Replaces the old "boxed form floating in a void" layout: the form now sits
 * directly on the page background (inputs and buttons carry the structure),
 * and on desktop a brand panel restates the product's one argument — proof
 * over resumes — next to the form. On mobile the panel disappears entirely;
 * the form is the page.
 *
 * Presentational only. Pages keep every piece of auth logic and render their
 * form as children. No "use client" needed — every consumer already is one.
 */

const PROOF_POINTS = [
  "GitHub-verified daily streaks",
  "Shipped projects with live URLs",
  "One vibe score clients can trust",
];

// Static echo of the homepage proof wall (owner's design language): a fixed
// pattern of activity tiers, deliberately NOT animated and NOT live data —
// it's set dressing here, and a hardcoded pattern keeps the auth pages free
// of any fetch. Tiers index into the same --hm-* scale the real wall uses.
const MINI_WALL: number[][] = [
  [2, 4, 1, 0, 3, 4, 2, 1, 4, 0, 2, 3, 1, 4],
  [4, 1, 3, 2, 0, 1, 4, 3, 2, 4, 0, 1, 3, 2],
  [1, 3, 0, 4, 2, 3, 1, 0, 4, 2, 3, 4, 0, 1],
  [3, 0, 2, 1, 4, 0, 3, 2, 1, 3, 4, 0, 2, 4],
  [0, 2, 4, 3, 1, 2, 0, 4, 3, 1, 2, 3, 4, 0],
];

function MiniWall() {
  return (
    <div className="flex flex-col gap-[3px]" aria-hidden>
      {MINI_WALL.map((row, r) => (
        <div key={r} className="flex gap-[3px]">
          {row.map((tier, c) => (
            <div
              key={c}
              className="h-3 flex-1 rounded-[3px]"
              style={{ backgroundColor: `var(--hm-${tier})` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 lg:py-20">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
        <div className="w-full max-w-md mx-auto lg:mx-0 lg:justify-self-end">{children}</div>

        <aside className="hidden lg:block lg:sticky lg:top-24">
          <div
            className="rounded-3xl p-8 overflow-hidden"
            style={{ backgroundColor: "var(--bg-inverted)", border: "1px solid var(--border-subtle)" }}
          >
            <MiniWall />
            <h2 className="mt-7 text-2xl font-bold text-white">Proof over resumes</h2>
            <ul className="mt-4 space-y-2.5">
              {PROOF_POINTS.map((p) => (
                <li key={p} className="flex items-center gap-2.5 text-sm font-medium text-[var(--text-muted-soft)]">
                  <CheckCircle weight="fill" size={17} className="text-[var(--accent)] shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
            <p
              className="mt-7 pt-5 text-xs font-medium text-[var(--text-muted)]"
              style={{ borderTop: "1px solid var(--border-subtle)" }}
            >
              Free for builders. No platform fees.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Logo + title + subtitle block above an auth form. */
export function AuthHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div className="text-center lg:text-left mb-8">
      <Image
        src="/logo.png"
        alt="VibeTalent"
        width={48}
        height={48}
        className="mx-auto lg:mx-0 mb-5 object-contain"
      />
      <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)] font-medium">{subtitle}</p>
      {children}
    </div>
  );
}

/** Full-width accent action — the one loud element per screen. */
export function AuthPrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full h-12 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white cursor-pointer transition-[background-color,transform] hover:bg-[var(--accent-hover)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ backgroundColor: "var(--accent)" }}
    >
      {children}
    </button>
  );
}

/** Quiet bordered alternative (Google, secondary actions). */
export function AuthSecondaryButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-12 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[var(--foreground)] cursor-pointer transition-[background-color,transform] hover:bg-[var(--bg-surface-light)] active:scale-[0.98]"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
    >
      {children}
    </button>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-[var(--border-subtle)]" />
      <span className="text-xs font-medium text-[var(--text-muted)]">or</span>
      <div className="flex-1 h-px bg-[var(--border-subtle)]" />
    </div>
  );
}

/** Google's four-colour mark (same path everywhere it appears). */
export function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
