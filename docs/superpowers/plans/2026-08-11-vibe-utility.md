# $VIBE Burn Utility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give $VIBE real utility — burn it to vouch for builders or restore a broken streak, hold it for free streak freezes — and give the token a findable home with its contract address and buy link.

**Architecture:** Every new $VIBE action **burns** tokens (no treasury wallet, no custody). Burns are verified server-side using the token-balance conservation invariant, on the same Solana rail the featuring flow already uses. Vouch weight feeds `vibe_score` through the existing `update_user_streak()` SQL function, capped so rank stays unbuyable.

**Tech Stack:** Next.js 16 App Router · Supabase (Postgres + RLS) · `@solana/web3.js` + `@solana/spl-token` · Privy · `@noble/curves` (ed25519) · Upstash Redis · Vitest

**Spec:** `docs/superpowers/specs/2026-08-11-vibe-utility-design.md`

---

## Phase boundaries

Seven phases. **Each phase ends in a shippable state and is a natural PR boundary.**

| Phase | Delivers | Depends on |
| --- | --- | --- |
| 1 | `/token` page, CA, buy link | — |
| 2 | Burn primitive + verification (pure, tested) | — |
| 3 | Migration (schema + scoring function) | — |
| 4 | Verified wallet link | 2, 3 |
| 5 | Streak protect | 2, 3, 4 |
| 6 | Burn-to-vouch | 2, 3, 4 |
| 7 | Holder tiers → free freezes | 3, 4 |

Phases 1–3 are independent and can be done in any order. **Phase 1 alone satisfies the "add CA + buy link" request** and can ship immediately.

## File structure

**Created:**

| File | Responsibility |
| --- | --- |
| `src/lib/vibe-config.ts` | Every tunable constant. Single source for caps, thresholds, prices. |
| `src/lib/vibe-burn.ts` | Burn tx construction, memo build/parse, conservation-invariant maths. Pure + tested. |
| `src/lib/vibe-burn-verify.ts` | Server-only shared verifier both burn endpoints call. Keeps them from drifting. |
| `src/lib/wallet-link.ts` | Nonce key + signed-message builder, shared by the nonce and link routes. |
| `src/lib/vibe-balance.ts` | Reads and caches a wallet's $VIBE balance. |
| `src/app/api/wallet/balance/route.ts` | On-demand balance refresh with a 60s cooldown. |
| `src/lib/vouch.ts` | Vouch point maths for UI preview. Mirrors the SQL, tested against the same table. |
| `src/lib/token-stats.ts` | Live $VIBE price/supply/burn totals for `/token`. |
| `src/lib/__tests__/vibe-burn.test.ts` | Tests for memo + invariant. |
| `src/lib/__tests__/vouch.test.ts` | Tests for point maths. |
| `src/app/token/page.tsx` | `/token` — CA, buy link, stats, tiers, explainer. |
| `src/components/token/burn-confirm.tsx` | Shared irreversibility confirmation panel. |
| `src/components/token/vouch-button.tsx` | Vouch flow (amount → confirm → burn). |
| `src/components/profile/backed-by.tsx` | "Backed by" display on a profile. |
| `src/components/dashboard/streak-protect-card.tsx` | Restore-your-streak CTA. |
| `src/app/api/wallet/nonce/route.ts` | Issues a signing nonce. |
| `src/app/api/wallet/link/route.ts` | Verifies ed25519, binds wallet. |
| `src/app/api/vouch/route.ts` | Verifies a vouch burn, records it. |
| `src/app/api/streak/protect/route.ts` | Verifies a protect burn, restores the streak. |
| `supabase/migrations/20260811_vibe_utility.sql` | All schema + the rewritten scoring function. |

**Modified:**

| File | Change |
| --- | --- |
| `src/app/api/cron/reset-streaks/route.ts` | Record `streak_before_break` / `streak_broken_at`; stamp `source` on synthetic logs. |
| `src/app/api/cron/reset-freezes/route.ts` | Per-user allowance from holder tier instead of a flat 2. |
| `src/app/sitemap.ts` | Add `/token`. |
| `src/app/llms.txt/route.ts` | Mention `/token`. |
| `src/components/layout/` footer | Contract address + buy link. |
| `package.json` | Promote `@noble/curves` to a direct dependency. |

---

# Phase 1 — `/token` page, contract address, buy link

Ships standalone. No wallet, no burns, no migration.

### Task 1.1: Config constants module

**Files:**
- Create: `src/lib/vibe-config.ts`

- [ ] **Step 1: Create the config module**

Every tunable number in one place, so calibration never requires touching logic.

```ts
// src/lib/vibe-config.ts
//
// Every tunable constant for $VIBE utility. Calibration values are expected to
// change once there's real usage; nothing here should require touching burn,
// verification or scoring logic to adjust.

import { CHAIN_CONFIGS, isSolanaChain } from "@/lib/chains-config";

const solana = CHAIN_CONFIGS.solana;

/** $VIBE mint. Re-exported so consumers don't repeat the isSolanaChain narrow. */
export const VIBE_MINT = isSolanaChain(solana) ? solana.vibeMint : "";
export const VIBE_DECIMALS = isSolanaChain(solana) ? solana.vibeDecimals : 9;

/** Where a user actually buys $VIBE. Jupiter cannot route this token — it sits
 *  on a Meteora DBC bonding curve — so this is an outbound link, not a widget. */
export const VIBE_BUY_URL = `https://bags.fm/${VIBE_MINT}`;
export const VIBE_CHART_URL = `https://dexscreener.com/solana/${VIBE_MINT}`;
export const VIBE_EXPLORER_URL = `https://solscan.io/token/${VIBE_MINT}`;

export const VOUCH = {
  /** Minimum burn to vouch, USD. */
  minUsd: 2,
  /** Amounts offered in the UI, USD. */
  presetsUsd: [2, 5, 10, 25] as const,
  /** Max vibe_score points a single voucher can contribute. */
  perVoucherCapPoints: 5,
  /** Max vibe_score points all vouches combined can contribute to one profile. */
  perProfileCapPoints: 25,
  /** Below this vibe_score a voucher's burn is display-only, worth 0 points.
   *  This is the Sybil defence — see the spec. */
  voucherMinVibeScore: 20,
} as const;

export const STREAK_PROTECT = {
  /** Price of one restore, USD. */
  usdPrice: 1,
  /** Hours after the break during which a restore may be bought. */
  graceHours: 48,
  /** Refuse to restore a gap larger than this — no buying back a lost week. */
  maxGapDays: 2,
  /** Paid restores allowed per calendar month. */
  maxPaidPerMonth: 2,
  /** Don't offer a restore for a streak shorter than this. */
  minStreakToOffer: 3,
} as const;

/** Free monthly streak freezes by $VIBE held, richest tier first.
 *  Evaluated once on the 1st when the allowance is granted — see the spec on
 *  why this is not re-evaluated mid-month. */
export const HOLDER_TIERS = [
  { key: "patron", label: "Patron", minUsd: 40, freezes: 4 },
  { key: "backer", label: "Backer", minUsd: 10, freezes: 3 },
] as const;

/** Allowance for a user holding nothing. Matches today's behaviour. */
export const BASE_FREEZES = 2;

export type HolderTier = (typeof HOLDER_TIERS)[number];

/** Richest tier whose threshold `usdHeld` meets, or null. */
export function holderTierFor(usdHeld: number): HolderTier | null {
  return HOLDER_TIERS.find((t) => usdHeld >= t.minUsd) ?? null;
}

/** Free monthly freezes for a given USD holding. */
export function freezeAllowanceFor(usdHeld: number): number {
  return holderTierFor(usdHeld)?.freezes ?? BASE_FREEZES;
}
```

- [ ] **Step 2: Write tests for the tier helpers**

```ts
// src/lib/__tests__/vibe-config.test.ts
import { describe, it, expect } from "vitest";
import { holderTierFor, freezeAllowanceFor, BASE_FREEZES } from "../vibe-config";

describe("holderTierFor", () => {
  it("returns null below the lowest threshold", () => {
    expect(holderTierFor(0)).toBeNull();
    expect(holderTierFor(9.99)).toBeNull();
  });

  it("returns backer at the boundary and patron above it", () => {
    expect(holderTierFor(10)?.key).toBe("backer");
    expect(holderTierFor(39.99)?.key).toBe("backer");
    expect(holderTierFor(40)?.key).toBe("patron");
    expect(holderTierFor(10_000)?.key).toBe("patron");
  });
});

describe("freezeAllowanceFor", () => {
  it("gives the base allowance to non-holders", () => {
    expect(freezeAllowanceFor(0)).toBe(BASE_FREEZES);
  });

  it("raises the allowance by tier", () => {
    expect(freezeAllowanceFor(10)).toBe(3);
    expect(freezeAllowanceFor(40)).toBe(4);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npm run test -- src/lib/__tests__/vibe-config.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 4: Commit**

```bash
git add src/lib/vibe-config.ts src/lib/__tests__/vibe-config.test.ts
git commit -m "feat(vibe): add \$VIBE utility config constants"
```

---

### Task 1.2: Live token stats

**Files:**
- Create: `src/lib/token-stats.ts`

- [ ] **Step 1: Write the stats module**

Reuses `fetchVibeUsdCached` rather than re-implementing the GeckoTerminal call. Fails soft — `/token` must still render if an RPC is down, unlike the payment path which fails closed.

```ts
// src/lib/token-stats.ts
//
// Live $VIBE stats for the /token page. Unlike the payment path (which fails
// CLOSED so it never grants against a stale price), this fails SOFT — /token is
// an informational page and should still render if an upstream is down.

import { fetchVibeUsdCached } from "@/lib/promotion-pricing";
import { CHAIN_CONFIGS, isSolanaChain } from "@/lib/chains-config";
import { VIBE_MINT, VIBE_DECIMALS } from "@/lib/vibe-config";

export type TokenStats = {
  priceUsd: number | null;
  supply: number | null;
  marketCapUsd: number | null;
  /** Total $VIBE destroyed through vouches + streak protects, whole tokens. */
  burnedTotal: number;
  burnedUsd: number;
};

/** Circulating supply in whole tokens, via getTokenSupply. Null on failure. */
export async function fetchSupply(): Promise<number | null> {
  const solana = CHAIN_CONFIGS.solana;
  if (!isSolanaChain(solana)) return null;
  try {
    const res = await fetch(solana.rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenSupply",
        params: [VIBE_MINT],
      }),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const ui = json?.result?.value?.uiAmount;
    return typeof ui === "number" ? ui : null;
  } catch {
    return null;
  }
}

/** Convert base units to whole tokens. */
export function toWholeTokens(baseUnits: bigint): number {
  return Number(baseUnits) / 10 ** VIBE_DECIMALS;
}

/**
 * Assemble the page stats. `burnedBaseUnits` and `burnedUsd` come from the
 * database (summed across vouches + streak protects) and are passed in so this
 * module stays free of Supabase coupling and easy to test.
 */
export async function getTokenStats(
  burnedBaseUnits: bigint,
  burnedUsd: number,
): Promise<TokenStats> {
  const [priceUsd, supply] = await Promise.all([
    fetchVibeUsdCached().catch(() => null),
    fetchSupply(),
  ]);

  return {
    priceUsd,
    supply,
    marketCapUsd: priceUsd != null && supply != null ? priceUsd * supply : null,
    burnedTotal: toWholeTokens(burnedBaseUnits),
    burnedUsd,
  };
}

/** Compact display for large token counts: 2,078,000 -> "2.08M". */
export function formatTokenCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
```

- [ ] **Step 2: Write tests for the pure helpers**

```ts
// src/lib/__tests__/token-stats.test.ts
import { describe, it, expect } from "vitest";
import { formatTokenCount, toWholeTokens } from "../token-stats";

describe("toWholeTokens", () => {
  it("divides by the 9-decimal base", () => {
    expect(toWholeTokens(BigInt("2078000000000000"))).toBe(2_078_000);
  });

  it("returns 0 for a zero burn", () => {
    expect(toWholeTokens(BigInt(0))).toBe(0);
  });
});

describe("formatTokenCount", () => {
  it("abbreviates by magnitude", () => {
    expect(formatTokenCount(2_078_000)).toBe("2.08M");
    expect(formatTokenCount(998_079_152)).toBe("998.08M");
    expect(formatTokenCount(1_500_000_000)).toBe("1.50B");
    expect(formatTokenCount(4_200)).toBe("4.2K");
  });

  it("shows small counts in full", () => {
    expect(formatTokenCount(0)).toBe("0");
    expect(formatTokenCount(999)).toBe("999");
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npm run test -- src/lib/__tests__/token-stats.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 4: Commit**

```bash
git add src/lib/token-stats.ts src/lib/__tests__/token-stats.test.ts
git commit -m "feat(vibe): add live \$VIBE token stats module"
```

---

### Task 1.3: `/token` page

**Files:**
- Create: `src/app/token/page.tsx`
- Create: `src/components/token/copy-address.tsx`

**Reference for styling:** copy the brutalist conventions from `src/app/roadmap/page.tsx` — `card-brutal`, `btn-brutal btn-brutal-primary`, `var(--bg-surface)`, `var(--accent)`, uppercase extrabold headings. **Dark mode uses warm greys (hue ~14°)** — use the existing CSS variables, never hardcoded neutral greys.

- [ ] **Step 1: Create the copy-address client component**

```tsx
// src/components/token/copy-address.tsx
"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked by permissions policy; the address is still
      // selectable on screen, so failing silently is acceptable here.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Contract address copied" : "Copy contract address"}
      className="flex items-center gap-2 px-3 py-2 font-mono text-[11px] sm:text-xs font-bold break-all text-left transition-colors"
      style={{
        border: "2px solid var(--border-hard)",
        backgroundColor: "var(--bg-surface)",
        color: "var(--foreground)",
      }}
    >
      <span className="flex-1">{address}</span>
      {copied ? (
        <Check size={14} style={{ color: "var(--accent)" }} aria-hidden="true" />
      ) : (
        <Copy size={14} aria-hidden="true" />
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Create the page**

Server component. Sums burns from the database, fetches live stats, renders. `vouches` is not in the generated DB types yet, so those queries are cast — matching the existing `featured_promotions` pattern in `src/lib/featured-promotions.ts`.

```tsx
// src/app/token/page.tsx
import type { Metadata } from "next";
import { Flame, Shield, TrendingUp, ExternalLink } from "lucide-react";
import { jsonLdHtml } from "@/lib/json-ld";
import { siteUrl } from "@/lib/seo";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTokenStats, formatTokenCount } from "@/lib/token-stats";
import {
  VIBE_MINT, VIBE_BUY_URL, VIBE_CHART_URL, VIBE_EXPLORER_URL,
  HOLDER_TIERS, BASE_FREEZES, VOUCH, STREAK_PROTECT,
} from "@/lib/vibe-config";
import { CopyAddress } from "@/components/token/copy-address";

// Stats are live-ish but not per-request — 5 min matches the pricing cache and
// keeps this page off the ISR revalidation hot path.
export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: "$VIBE Token — Burn to Vouch, Protect Your Streak | VibeTalent" },
  description:
    `$VIBE is VibeTalent's token on Solana (CA: ${VIBE_MINT}). Burn $VIBE to vouch for a builder and add verifiable trust to their profile, or to restore a broken streak. Hold $VIBE for free monthly streak freezes. Every burn permanently destroys supply.`,
  keywords: [
    "$VIBE token", "VIBE token contract address", "VibeTalent token",
    "burn to vouch", "Solana developer token", "stake to vouch builders",
  ],
  alternates: { canonical: `${siteUrl}/token` },
  openGraph: {
    title: "$VIBE Token — Burn to Vouch",
    description:
      "Burn $VIBE to vouch for builders or protect your streak. Hold $VIBE for free streak freezes. Live on Solana.",
    url: `${siteUrl}/token`,
    siteName: "VibeTalent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "$VIBE Token — Burn to Vouch",
    description: "Burn $VIBE to back builders. Hold it for free streak freezes. Live on Solana.",
  },
};

async function fetchBurnTotals(): Promise<{ baseUnits: bigint; usd: number }> {
  try {
    const sb = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [vouches, protects] = await Promise.all([
      (sb as any).from("vouches").select("vibe_burned, usd_at_burn"),
      (sb as any).from("streak_protects").select("vibe_burned, usd_at_burn"),
    ]);
    const rows = [...(vouches.data ?? []), ...(protects.data ?? [])] as Array<{
      vibe_burned: string | number;
      usd_at_burn: string | number;
    }>;
    return {
      baseUnits: rows.reduce((a, r) => a + BigInt(r.vibe_burned ?? 0), BigInt(0)),
      usd: rows.reduce((a, r) => a + Number(r.usd_at_burn ?? 0), 0),
    };
  } catch {
    // Page must render even if the tables aren't migrated yet.
    return { baseUnits: BigInt(0), usd: 0 };
  }
}

export default async function TokenPage() {
  const burns = await fetchBurnTotals();
  const stats = await getTokenStats(burns.baseUnits, burns.usd);

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is the $VIBE contract address?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `$VIBE is live on Solana at contract address ${VIBE_MINT}. It can be bought on Bags. It is not routable on Jupiter.`,
        },
      },
      {
        "@type": "Question",
        name: "What is $VIBE used for?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `$VIBE has three uses on VibeTalent. Burn it to vouch for a builder, which adds verifiable trust to their profile. Burn it to restore a coding streak you broke. Hold it to earn extra free streak freezes every month. Burning permanently destroys the tokens — nobody receives them.`,
        },
      },
      {
        "@type": "Question",
        name: "What does burning $VIBE mean?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Burning permanently destroys tokens and removes them from the total supply. They are not sent to VibeTalent, and not sent to the builder being vouched for. Nobody receives them. A burn cannot be undone or refunded.",
        },
      },
    ],
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(faqLd)} />

      {/* Hero */}
      <h1 className="text-4xl sm:text-5xl font-extrabold uppercase leading-none">
        <span className="block text-[var(--foreground)]">$VIBE</span>
        <span className="block" style={{ color: "var(--accent)" }}>Burn to Back Builders</span>
      </h1>
      <p className="mt-4 text-sm text-[var(--text-secondary)] leading-relaxed max-w-2xl">
        $VIBE is VibeTalent&apos;s token on Solana. Burn it to vouch for a builder you believe in,
        or to bring back a streak you broke. Hold it and your free streak freezes go up every month.
        Every burn destroys supply permanently.
      </p>

      {/* Contract address */}
      <section className="mt-8">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
          Contract Address (Solana)
        </h2>
        <CopyAddress address={VIBE_MINT} />
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={VIBE_BUY_URL} target="_blank" rel="noopener noreferrer"
             className="btn-brutal btn-brutal-primary btn-notched text-sm flex items-center gap-2">
            Buy $VIBE on Bags <ExternalLink size={14} aria-hidden="true" />
          </a>
          <a href={VIBE_CHART_URL} target="_blank" rel="noopener noreferrer"
             className="btn-brutal text-sm flex items-center gap-2">
            Chart <ExternalLink size={14} aria-hidden="true" />
          </a>
          <a href={VIBE_EXPLORER_URL} target="_blank" rel="noopener noreferrer"
             className="btn-brutal text-sm flex items-center gap-2">
            Solscan <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">
          Buy with SOL or USDC on Solana. $VIBE trades on a Bags bonding curve and is not
          routable on Jupiter, so buy through the link above.
        </p>
      </section>

      {/* Live stats */}
      <section className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Price" value={stats.priceUsd != null ? `$${stats.priceUsd.toFixed(9)}` : "—"} />
        <Stat label="Market Cap" value={stats.marketCapUsd != null ? `$${Math.round(stats.marketCapUsd).toLocaleString("en-US")}` : "—"} />
        <Stat label="Supply" value={stats.supply != null ? formatTokenCount(stats.supply) : "—"} />
        <Stat label="Burned Forever" value={formatTokenCount(stats.burnedTotal)} accent />
      </section>

      {/* Utility */}
      <section className="mt-12">
        <h2 className="text-2xl font-extrabold uppercase text-[var(--foreground)] mb-4">What $VIBE Does</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <UtilityCard icon={Flame} title="Burn to Vouch"
            text={`Put $VIBE behind a builder you rate. Your name and the amount show publicly on their profile, and it adds up to ${VOUCH.perProfileCapPoints} points to their vibe score. From $${VOUCH.minUsd}.`} />
          <UtilityCard icon={Shield} title="Burn to Protect"
            text={`Broke a streak? Burn about $${STREAK_PROTECT.usdPrice} of $VIBE within ${STREAK_PROTECT.graceHours} hours to bring it back. Protected days are marked on your heatmap.`} />
          <UtilityCard icon={TrendingUp} title="Hold for Freezes"
            text={`Every builder gets ${BASE_FREEZES} free streak freezes a month. Hold $VIBE and that goes up — no burning needed.`} />
        </div>
      </section>

      {/* Holder tiers */}
      <section className="mt-12">
        <h2 className="text-2xl font-extrabold uppercase text-[var(--foreground)] mb-4">Holder Tiers</h2>
        <div style={{ border: "2px solid var(--border-hard)" }}>
          <TierRow tier="No holding" hold="$0" freezes={BASE_FREEZES} />
          {[...HOLDER_TIERS].reverse().map((t) => (
            <TierRow key={t.key} tier={t.label} hold={`$${t.minUsd}+`} freezes={t.freezes} />
          ))}
        </div>
        <p className="mt-3 text-[11px] text-[var(--text-muted)]">
          Your tier is checked on the 1st of each month when freezes are granted, and holds for the
          whole month regardless of price moves. Link a wallet in Settings to qualify.
        </p>
      </section>

      {/* Burn explainer */}
      <section className="mt-12 p-5" style={{ border: "2px solid var(--border-hard)", backgroundColor: "var(--bg-surface)" }}>
        <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-2">What burning means</h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          Burning permanently destroys tokens. They are <strong>not</strong> sent to VibeTalent, and
          <strong> not</strong> sent to the builder you&apos;re backing. Nobody receives them — they are
          removed from the total supply and cannot be recovered. Every burn is a Solana transaction
          you can verify yourself on Solscan.
        </p>
      </section>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-3" style={{ border: "2px solid var(--border-hard)", backgroundColor: "var(--bg-surface)" }}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 font-mono text-sm font-extrabold break-all"
           style={{ color: accent ? "var(--accent)" : "var(--foreground)" }}>{value}</div>
    </div>
  );
}

function UtilityCard({ icon: Icon, title, text }: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  title: string; text: string;
}) {
  return (
    <div className="card-brutal p-5" style={{ backgroundColor: "var(--bg-surface)" }}>
      <Icon size={20} style={{ color: "var(--accent)" }} />
      <h3 className="mt-3 text-base font-extrabold uppercase text-[var(--foreground)]">{title}</h3>
      <p className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed">{text}</p>
    </div>
  );
}

function TierRow({ tier, hold, freezes }: { tier: string; hold: string; freezes: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-3"
         style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <span className="text-xs font-extrabold uppercase text-[var(--foreground)]">{tier}</span>
      <span className="font-mono text-xs text-[var(--text-secondary)]">{hold}</span>
      <span className="font-mono text-xs font-bold" style={{ color: "var(--accent)" }}>
        {freezes} freezes/mo
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Verify it builds and renders**

Run: `npx tsc --noEmit`
Expected: no errors.

Then start the dev server via the preview tooling and load `/token`. Confirm: the address renders and copies, all three outbound links resolve, stats show real values (or `—` without breaking), and the page reads correctly in both light and dark mode.

- [ ] **Step 4: Commit**

```bash
git add src/app/token/page.tsx src/components/token/copy-address.tsx
git commit -m "feat(token): add /token page with contract address, buy link and live stats"
```

---

### Task 1.4: Surface the CA site-wide

**Files:**
- Modify: the footer component under `src/components/layout/`
- Modify: `src/app/sitemap.ts`
- Modify: `src/app/llms.txt/route.ts`

- [ ] **Step 1: Locate the footer**

Run: `ls src/components/layout/` and open the footer component.

- [ ] **Step 2: Add a compact token block to the footer**

Import `VIBE_MINT` and `VIBE_BUY_URL` from `@/lib/vibe-config`. Add, matching the footer's existing column styling:

```tsx
<div>
  <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">$VIBE</h3>
  <a href="/token" className="block text-xs font-bold hover:opacity-80" style={{ color: "var(--accent)" }}>
    Token &amp; Utility
  </a>
  <a href={VIBE_BUY_URL} target="_blank" rel="noopener noreferrer"
     className="block mt-1 text-xs font-bold hover:opacity-80" style={{ color: "var(--accent)" }}>
    Buy $VIBE
  </a>
  <p className="mt-2 font-mono text-[9px] break-all text-[var(--text-muted)]">{VIBE_MINT}</p>
</div>
```

- [ ] **Step 3: Add `/token` to the sitemap**

In `src/app/sitemap.ts`, add an entry alongside the other static routes, following whatever shape the existing entries use (`url`, `lastModified`, `changeFrequency`, `priority`). Use priority `0.8`.

- [ ] **Step 4: Mention `/token` in llms.txt**

In `src/app/llms.txt/route.ts`, add a line under the existing pages list:

```
- [/token](https://www.vibetalent.work/token): $VIBE token — contract address, where to buy, and what it does (burn to vouch for builders, burn to restore a streak, hold for free streak freezes).
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && ./node_modules/.bin/eslint src`
Expected: clean.

Load `/sitemap.xml` and `/llms.txt` in the preview and confirm `/token` appears in both.

- [ ] **Step 6: Commit**

```bash
git add -A src/components/layout src/app/sitemap.ts src/app/llms.txt
git commit -m "feat(token): surface \$VIBE contract address in footer, sitemap and llms.txt"
```

**Phase 1 ships here.** `/token` is live, the CA is discoverable, and buying works.

---

# Phase 2 — Burn primitive

Pure library work with full test coverage. No UI, no schema.

### Task 2.1: Promote `@noble/curves` to a direct dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install it explicitly**

It resolves today only as a transitive dependency of the Solana packages, which means a lockfile change could remove it.

```bash
npm install @noble/curves@^1.8.0
```

- [ ] **Step 2: Verify the version didn't move**

Run: `node -e 'console.log(require("./node_modules/@noble/curves/package.json").version)'`
Expected: `1.8.0` (the API used in Phase 4 is verified against this version).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): make @noble/curves a direct dependency"
```

---

### Task 2.2: Burn memo + conservation-invariant verification

**Files:**
- Create: `src/lib/vibe-burn.ts`
- Test: `src/lib/__tests__/vibe-burn.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/vibe-burn.test.ts
import { describe, it, expect } from "vitest";
import { buildBurnMemo, parseBurnMemo, netTokenDelta, burnedAtLeast } from "../vibe-burn";

const MINT = "FfDYT3WqimMw7itMxw4kYJ26GPG78RfpZmepQCFpBAGS";
const OTHER = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const bal = (owner: string, mint: string, amount: string) => ({
  owner, mint, uiTokenAmount: { amount },
});

describe("buildBurnMemo / parseBurnMemo", () => {
  it("round-trips a vouch memo", () => {
    const memo = buildBurnMemo({ kind: "vouch", actorId: "aaa", targetId: "bbb" });
    expect(memo).toBe("vouch:aaa:bbb");
    expect(parseBurnMemo(memo)).toEqual({ kind: "vouch", actorId: "aaa", targetId: "bbb" });
  });

  it("round-trips a protect memo", () => {
    const memo = buildBurnMemo({ kind: "protect", actorId: "aaa", breakDate: "2026-08-10" });
    expect(memo).toBe("protect:aaa:2026-08-10");
    expect(parseBurnMemo(memo)).toEqual({ kind: "protect", actorId: "aaa", breakDate: "2026-08-10" });
  });

  it("rejects malformed and unknown memos", () => {
    expect(parseBurnMemo("vouch:only-one-part")).toBeNull();
    expect(parseBurnMemo("transfer:aaa:bbb")).toBeNull();
    expect(parseBurnMemo("")).toBeNull();
    expect(parseBurnMemo("vouch:aaa:bbb:extra")).toBeNull();
  });
});

describe("netTokenDelta", () => {
  it("nets to zero for a transfer between two accounts", () => {
    const pre  = [bal("alice", MINT, "1000"), bal("bob", MINT, "0")];
    const post = [bal("alice", MINT, "400"),  bal("bob", MINT, "600")];
    expect(netTokenDelta(pre, post, MINT)).toBe(BigInt(0));
  });

  it("nets to zero when the destination account is created in-transaction", () => {
    const pre  = [bal("alice", MINT, "1000")];
    const post = [bal("alice", MINT, "400"), bal("bob", MINT, "600")];
    expect(netTokenDelta(pre, post, MINT)).toBe(BigInt(0));
  });

  it("goes negative by the burned amount", () => {
    const pre  = [bal("alice", MINT, "1000")];
    const post = [bal("alice", MINT, "400")];
    expect(netTokenDelta(pre, post, MINT)).toBe(BigInt(-600));
  });

  it("reflects the burn when the account is closed after burning", () => {
    const pre  = [bal("alice", MINT, "600")];
    const post: typeof pre = [];
    expect(netTokenDelta(pre, post, MINT)).toBe(BigInt(-600));
  });

  it("ignores balances for other mints", () => {
    const pre  = [bal("alice", MINT, "1000"), bal("alice", OTHER, "5000")];
    const post = [bal("alice", MINT, "400"),  bal("alice", OTHER, "0")];
    expect(netTokenDelta(pre, post, MINT)).toBe(BigInt(-600));
  });
});

describe("burnedAtLeast", () => {
  const pre  = [bal("alice", MINT, "1000")];
  const post = [bal("alice", MINT, "100")]; // 900 destroyed

  it("accepts a burn at or above the expected amount", () => {
    expect(burnedAtLeast(pre, post, MINT, BigInt(900))).toBe(true);
    expect(burnedAtLeast(pre, post, MINT, BigInt(500))).toBe(true);
  });

  it("accepts a burn inside the 10% slippage floor", () => {
    // 900 destroyed vs 1000 expected = 90%, exactly at the floor.
    expect(burnedAtLeast(pre, post, MINT, BigInt(1000))).toBe(true);
  });

  it("rejects a burn below the slippage floor", () => {
    expect(burnedAtLeast(pre, post, MINT, BigInt(1100))).toBe(false);
  });

  it("rejects a transfer, which destroys nothing", () => {
    const tPre  = [bal("alice", MINT, "1000")];
    const tPost = [bal("alice", MINT, "100"), bal("treasury", MINT, "900")];
    expect(burnedAtLeast(tPre, tPost, MINT, BigInt(900))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/lib/__tests__/vibe-burn.test.ts`
Expected: FAIL — cannot resolve `../vibe-burn`.

- [ ] **Step 3: Implement the module**

```ts
// src/lib/vibe-burn.ts
//
// Burn construction + verification for $VIBE.
//
// WHY THE INVARIANT INSTEAD OF PARSING INSTRUCTIONS: the jsonParsed shape of
// `burn` / `burnChecked` could not be confirmed against a live transaction (a
// 120-transaction sample across USDC and BONK surfaced only transfer /
// transferChecked), and guessing field names risks a silent verification
// failure on a path that grants value. Token balances are conserved by a
// transfer and are NOT conserved by a burn, so summing the deltas across every
// touched account for the mint detects destruction with no shape assumptions.

import { Buffer } from "buffer";
import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createBurnCheckedInstruction } from "@solana/spl-token";
import { passesSlippage } from "@/lib/promotion-pricing";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

// ── Memo binding ──

export type BurnAction =
  | { kind: "vouch"; actorId: string; targetId: string }
  | { kind: "protect"; actorId: string; breakDate: string };

/**
 * The memo must name the ACTOR as well as the target. With a target-only memo
 * (as the featuring flow uses — safe there only because that endpoint has its
 * own "you own this project" gate) user A could submit user B's already
 * broadcast burn and be credited for it.
 */
export function buildBurnMemo(action: BurnAction): string {
  return action.kind === "vouch"
    ? `vouch:${action.actorId}:${action.targetId}`
    : `protect:${action.actorId}:${action.breakDate}`;
}

export function parseBurnMemo(memo: string): BurnAction | null {
  const parts = (memo || "").split(":");
  if (parts.length !== 3) return null;
  const [kind, actorId, third] = parts;
  if (!actorId || !third) return null;
  if (kind === "vouch") return { kind: "vouch", actorId, targetId: third };
  if (kind === "protect") return { kind: "protect", actorId, breakDate: third };
  return null;
}

// ── Verification ──

type TokenBalance = {
  owner?: string | null;
  mint: string;
  uiTokenAmount?: { amount?: string | null } | null;
};

/**
 * Net base-unit change in existence for `mint` across every account the
 * transaction touched. Zero for a transfer (the tokens moved), negative for a
 * burn (the tokens stopped existing).
 */
export function netTokenDelta(
  pre: TokenBalance[],
  post: TokenBalance[],
  mint: string,
): bigint {
  const sum = (arr: TokenBalance[]) =>
    (arr || [])
      .filter((b) => b.mint === mint)
      .reduce((acc, b) => acc + BigInt(b.uiTokenAmount?.amount || "0"), BigInt(0));
  return sum(post) - sum(pre);
}

/**
 * Did this transaction destroy at least `expected` base units of `mint`,
 * allowing the same 10% slippage floor the transfer path uses (prices move
 * between quote and signature)?
 */
export function burnedAtLeast(
  pre: TokenBalance[],
  post: TokenBalance[],
  mint: string,
  expected: bigint,
  floorBps = 9000,
): boolean {
  const destroyed = -netTokenDelta(pre, post, mint);
  if (destroyed <= BigInt(0)) return false;
  return passesSlippage(destroyed, expected, floorBps);
}

// ── Construction ──

/**
 * Build an SPL burn of `amount` base units from the signer's own associated
 * token account, with `memo` attached. Serialized unsigned for Privy to sign.
 *
 * Simpler than a transfer: there is no recipient, so no associated-token-account
 * creation is needed.
 */
export async function buildSolanaTokenBurn({
  senderAddress,
  rpcUrl,
  mint: mintAddress,
  decimals,
  amount,
  memo,
}: {
  senderAddress: string;
  rpcUrl: string;
  mint: string;
  decimals: number;
  amount: bigint;
  memo: string;
}): Promise<Uint8Array> {
  const connection = new Connection(rpcUrl, "confirmed");
  const mint = new PublicKey(mintAddress);
  const owner = new PublicKey(senderAddress);
  const ata = await getAssociatedTokenAddress(mint, owner);

  const tx = new Transaction();
  tx.add(createBurnCheckedInstruction(ata, mint, owner, amount, decimals));
  tx.add(
    new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memo, "utf8"),
    }),
  );

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = owner;

  return tx.serialize({ requireAllSignatures: false });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/lib/__tests__/vibe-burn.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/vibe-burn.ts src/lib/__tests__/vibe-burn.test.ts
git commit -m "feat(vibe): add burn primitive with conservation-invariant verification"
```

---

### Task 2.3: Vouch point maths (UI preview mirror of the SQL)

**Files:**
- Create: `src/lib/vouch.ts`
- Test: `src/lib/__tests__/vouch.test.ts`

**Critical:** `vibe_score` is computed in SQL by `update_user_streak()`, which is the source of truth. This module exists **only** so the UI can preview "you'll give +2" before the burn. The test table below is the exact table verified against live Postgres in Task 3.1 — if you change one, change both.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/vouch.test.ts
import { describe, it, expect } from "vitest";
import { voucherCredibility, vouchPoints, totalVouchPoints } from "../vouch";
import { VOUCH } from "../vibe-config";

describe("voucherCredibility", () => {
  it("is zero below the minimum voucher score (Sybil floor)", () => {
    expect(voucherCredibility(0)).toBe(0);
    expect(voucherCredibility(19)).toBe(0);
  });

  it("starts at 0.5 at the floor and reaches 1.0 at 200", () => {
    expect(voucherCredibility(20)).toBeCloseTo(0.55, 5);
    expect(voucherCredibility(200)).toBe(1);
    expect(voucherCredibility(718)).toBe(1);
  });
});

describe("vouchPoints", () => {
  // This table matches the SQL verified in Task 3.1 exactly.
  it("matches the verified SQL results", () => {
    expect(vouchPoints(10, 718)).toBe(3);   // $10, max credibility
    expect(vouchPoints(25, 200)).toBe(5);   // hits the per-voucher cap
    expect(vouchPoints(100, 44)).toBe(5);   // over-cap, mid credibility
    expect(vouchPoints(2, 400)).toBe(1);    // minimum burn
    expect(vouchPoints(50, 10)).toBe(0);    // below the Sybil floor
  });

  it("never exceeds the per-voucher cap", () => {
    expect(vouchPoints(10_000, 718)).toBe(VOUCH.perVoucherCapPoints);
  });
});

describe("totalVouchPoints", () => {
  it("sums per-voucher points and applies the profile cap", () => {
    expect(totalVouchPoints([
      { usd: 10, voucherVibeScore: 718 },  // 3
      { usd: 25, voucherVibeScore: 200 },  // 5
      { usd: 100, voucherVibeScore: 44 },  // 5
      { usd: 2, voucherVibeScore: 400 },   // 1
      { usd: 50, voucherVibeScore: 10 },   // 0
    ])).toBe(14);
  });

  it("caps a whale-backed profile", () => {
    const many = Array.from({ length: 20 }, () => ({ usd: 25, voucherVibeScore: 300 }));
    expect(totalVouchPoints(many)).toBe(VOUCH.perProfileCapPoints);
  });

  it("returns zero for no vouches", () => {
    expect(totalVouchPoints([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- src/lib/__tests__/vouch.test.ts`
Expected: FAIL — cannot resolve `../vouch`.

- [ ] **Step 3: Implement**

```ts
// src/lib/vouch.ts
//
// Vouch point maths.
//
// IMPORTANT: vibe_score is computed in SQL by update_user_streak(), which is
// the source of truth. This module is a MIRROR used only to preview "you'll
// give +N" in the UI before a burn. The two must stay in agreement — the test
// table in __tests__/vouch.test.ts is the same table verified against live
// Postgres when the migration was written. Change one, change both.

import { VOUCH } from "@/lib/vibe-config";

/**
 * How much a voucher's money counts, 0 to 1.
 *
 * Below `voucherMinVibeScore` this is 0 — the burn still shows publicly (it did
 * happen) but contributes nothing to the score. That floor is the Sybil
 * defence: without it, ~25 throwaway accounts burning $4 each could max a
 * profile for around $100.
 */
export function voucherCredibility(voucherVibeScore: number): number {
  if (voucherVibeScore < VOUCH.voucherMinVibeScore) return 0;
  return 0.5 + 0.5 * Math.min(voucherVibeScore / 200, 1);
}

/** Points one voucher contributes, given their TOTAL burned USD for a builder. */
export function vouchPoints(totalUsd: number, voucherVibeScore: number): number {
  const credibility = voucherCredibility(voucherVibeScore);
  if (credibility === 0) return 0;
  return Math.min(
    Math.floor(Math.sqrt(totalUsd) * credibility),
    VOUCH.perVoucherCapPoints,
  );
}

/**
 * Total points across all vouchers, profile-capped. Each entry is one
 * voucher's aggregated burn — callers must group by voucher first, since
 * re-vouching adds to a voucher's total before the per-voucher cap applies.
 */
export function totalVouchPoints(
  vouchers: Array<{ usd: number; voucherVibeScore: number }>,
): number {
  const sum = vouchers.reduce((acc, v) => acc + vouchPoints(v.usd, v.voucherVibeScore), 0);
  return Math.min(sum, VOUCH.perProfileCapPoints);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- src/lib/__tests__/vouch.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/vouch.ts src/lib/__tests__/vouch.test.ts
git commit -m "feat(vibe): add vouch point maths mirroring the scoring SQL"
```

---

### Task 2.4: Shared burn-transaction verifier

**Files:**
- Create: `src/lib/vibe-burn-verify.ts`

Both burn endpoints need the identical sequence — fetch the transaction, reject
failures, match the memo to the actor, price the expected amount, check the
invariant. Writing it once means the two routes cannot drift, and a security fix
lands in one place.

- [ ] **Step 1: Write the verifier**

```ts
// src/lib/vibe-burn-verify.ts
//
// Server-only. Shared verification for every $VIBE burn endpoint.
//
// Returns a discriminated union rather than throwing, so callers map failures
// straight onto HTTP statuses without a try/catch ladder. 404 and 503 are
// deliberately distinguished: the client retries those (the transaction may not
// have propagated yet) and surfaces everything else immediately.

import { CHAIN_CONFIGS, isSolanaChain } from "@/lib/chains-config";
import { expectedTokenAmount, extractMemos, fetchVibeUsdCached } from "@/lib/promotion-pricing";
import { burnedAtLeast, netTokenDelta, parseBurnMemo, type BurnAction } from "@/lib/vibe-burn";
import { VIBE_MINT } from "@/lib/vibe-config";

export type BurnVerifyResult =
  | { ok: true; burned: bigint; vibeUsd: number }
  | { ok: false; status: number; error: string };

/**
 * Verify that `signature` is a confirmed Solana transaction which burned at
 * least `usd` worth of $VIBE and whose memo matches `expectedAction` exactly.
 *
 * Matching the FULL action (not just the target) is what stops user A claiming
 * user B's already-broadcast burn — see the spec.
 */
export async function verifyBurnTransaction(
  signature: string,
  expectedAction: BurnAction,
  usd: number,
): Promise<BurnVerifyResult> {
  const solana = CHAIN_CONFIGS.solana;
  if (!isSolanaChain(solana)) {
    return { ok: false, status: 500, error: "Solana not configured" };
  }

  // 1. Fetch the transaction. 'confirmed' (not 'finalized') so verification
  //    works seconds after the wallet returns.
  let txJson: { error?: unknown; result?: SolanaTx };
  try {
    const res = await fetch(solana.rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [
          signature,
          { commitment: "confirmed", maxSupportedTransactionVersion: 0, encoding: "jsonParsed" },
        ],
      }),
    });
    if (!res.ok) {
      return { ok: false, status: 503, error: "Couldn't reach the Solana network. Please retry." };
    }
    txJson = await res.json();
  } catch {
    return { ok: false, status: 503, error: "Couldn't reach the Solana network. Please retry." };
  }

  if (txJson?.error) {
    return { ok: false, status: 503, error: "Solana RPC error. Please retry." };
  }
  const tx = txJson?.result;
  if (!tx) {
    return { ok: false, status: 404, error: "Transaction not found or not confirmed yet." };
  }
  if (tx.meta?.err) {
    return { ok: false, status: 400, error: "That transaction failed on-chain." };
  }

  // 2. Memo must match the expected action on EVERY field.
  const memos = extractMemos(tx.transaction?.message?.instructions ?? []);
  const matched = memos
    .map(parseBurnMemo)
    .some((a) => a != null && sameAction(a, expectedAction));
  if (!matched) {
    return { ok: false, status: 400, error: "That burn isn't bound to this action." };
  }

  // 3. Expected amount. Fails closed — never grant against an unknown price.
  let vibeUsd: number;
  try {
    vibeUsd = await fetchVibeUsdCached();
  } catch {
    return { ok: false, status: 503, error: "Couldn't price $VIBE right now. Please retry." };
  }
  const expected = expectedTokenAmount(
    BigInt(Math.round(usd * 1e6)),
    "vibe",
    vibeUsd,
    solana.vibeDecimals,
  );

  // 4. The invariant. A transfer of the same amount fails here, by design.
  const pre = tx.meta?.preTokenBalances ?? [];
  const post = tx.meta?.postTokenBalances ?? [];
  if (!burnedAtLeast(pre, post, VIBE_MINT, expected)) {
    return { ok: false, status: 400, error: "That transaction didn't burn enough $VIBE." };
  }

  return { ok: true, burned: -netTokenDelta(pre, post, VIBE_MINT), vibeUsd };
}

function sameAction(a: BurnAction, b: BurnAction): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "vouch" && b.kind === "vouch") {
    return a.actorId === b.actorId && a.targetId === b.targetId;
  }
  if (a.kind === "protect" && b.kind === "protect") {
    return a.actorId === b.actorId && a.breakDate === b.breakDate;
  }
  return false;
}

type TokenBalanceEntry = {
  owner?: string | null;
  mint: string;
  uiTokenAmount?: { amount?: string | null } | null;
};

type SolanaTx = {
  meta?: {
    err?: unknown;
    preTokenBalances?: TokenBalanceEntry[];
    postTokenBalances?: TokenBalanceEntry[];
  } | null;
  transaction?: {
    message?: { instructions?: Array<{ program?: string; programId?: string; parsed?: unknown }> };
  };
};
```

- [ ] **Step 2: Test that `sameAction` matching is strict**

`sameAction` is not exported, so test it through the memo layer — the property
that matters is that a memo naming a different actor never matches.

```ts
// Append to src/lib/__tests__/vibe-burn.test.ts
describe("memo actor binding", () => {
  it("distinguishes memos that differ only by actor", () => {
    const mine = buildBurnMemo({ kind: "vouch", actorId: "me", targetId: "builder" });
    const theirs = buildBurnMemo({ kind: "vouch", actorId: "someone-else", targetId: "builder" });
    expect(mine).not.toBe(theirs);
    expect(parseBurnMemo(theirs)).toEqual({
      kind: "vouch", actorId: "someone-else", targetId: "builder",
    });
  });

  it("distinguishes a vouch memo from a protect memo with the same ids", () => {
    expect(buildBurnMemo({ kind: "vouch", actorId: "a", targetId: "b" }))
      .not.toBe(buildBurnMemo({ kind: "protect", actorId: "a", breakDate: "b" }));
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npm run test -- src/lib/__tests__/vibe-burn.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 4: Commit**

```bash
git add src/lib/vibe-burn-verify.ts src/lib/__tests__/vibe-burn.test.ts
git commit -m "feat(vibe): add shared burn-transaction verifier"
```

---

# Phase 3 — Migration

### Task 3.1: Schema + rewritten scoring function

**Files:**
- Create: `supabase/migrations/20260811_vibe_utility.sql`

**Two hard requirements:**
1. **Schema-qualify every table reference** inside the function. Supabase empties `search_path` for `SECURITY DEFINER` functions; an unqualified `users` fails with "relation does not exist".
2. **The new `users` columns must stay out of the client `UPDATE` grant.** If a client can write `vibe_balance`, holder tiers become free.

- [ ] **Step 1: Write the migration**

```sql
-- $VIBE burn utility: wallet linking, streak protect, burn-to-vouch, holder tiers.
--
-- Spec: docs/superpowers/specs/2026-08-11-vibe-utility-design.md
-- Editor-safe: plain statements, no DO/$$ blocks except the function body.

-- ── 1. Wallet linking + cached balance ──

alter table public.users add column if not exists solana_wallet text;
alter table public.users add column if not exists solana_wallet_verified_at timestamptz;
alter table public.users add column if not exists vibe_balance bigint not null default 0;
alter table public.users add column if not exists vibe_balance_at timestamptz;

-- One wallet, one account. Without this a single funded wallet grants holder
-- perks to unlimited accounts.
create unique index if not exists users_solana_wallet_key
  on public.users (solana_wallet) where solana_wallet is not null;

-- ── 2. Streak break capture ──

alter table public.users add column if not exists streak_broken_at timestamptz;
alter table public.users add column if not exists streak_before_break integer;

-- ── 3. Streak log provenance ──
-- Synthetic freeze rows are currently indistinguishable from real GitHub
-- activity. Marking them makes the heatmap honest and the data auditable.

alter table public.streak_logs add column if not exists source text not null default 'activity';
alter table public.streak_logs drop constraint if exists streak_logs_source_check;
alter table public.streak_logs add constraint streak_logs_source_check
  check (source in ('activity', 'freeze', 'restore'));

-- ── 4. Vouches ──

create table if not exists public.vouches (
  id           uuid primary key default gen_random_uuid(),
  voucher_id   uuid not null references public.users(id) on delete cascade,
  builder_id   uuid not null references public.users(id) on delete cascade,
  vibe_burned  bigint not null,          -- base units destroyed; drives the uncapped display
  usd_at_burn  numeric(12,2) not null,   -- frozen at burn; drives the capped score
  tx_ref       text not null,            -- Solana signature
  created_at   timestamptz not null default now(),
  constraint vouches_no_self_vouch check (voucher_id <> builder_id),
  constraint vouches_positive check (vibe_burned > 0 and usd_at_burn > 0)
);

-- Replay protection: one signature can only ever be claimed once.
create unique index if not exists vouches_tx_ref_key on public.vouches (tx_ref);
create index if not exists vouches_builder_idx on public.vouches (builder_id);
create index if not exists vouches_voucher_idx on public.vouches (voucher_id);

alter table public.vouches enable row level security;

-- Vouches are public by design — that is the whole point of the feature.
drop policy if exists "vouches are publicly readable" on public.vouches;
create policy "vouches are publicly readable" on public.vouches for select using (true);

-- No client writes. Rows are inserted only by the verified burn endpoint via
-- the service role, which bypasses RLS.

-- ── 5. Streak protects ──

create table if not exists public.streak_protects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  vibe_burned   bigint not null,
  usd_at_burn   numeric(12,2) not null,
  tx_ref        text not null,
  streak_restored integer not null,
  days_filled   integer not null,
  created_at    timestamptz not null default now(),
  constraint streak_protects_positive check (vibe_burned > 0 and usd_at_burn > 0)
);

create unique index if not exists streak_protects_tx_ref_key on public.streak_protects (tx_ref);
create index if not exists streak_protects_user_created_idx
  on public.streak_protects (user_id, created_at desc);

alter table public.streak_protects enable row level security;

drop policy if exists "own streak protects readable" on public.streak_protects;
create policy "own streak protects readable" on public.streak_protects
  for select using ((select auth.uid()) = user_id);

-- ── 6. Scoring function, with the capped vouch term ──
-- Unchanged from the current definition except for the vouch block marked below.

create or replace function public.update_user_streak(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_current_streak INTEGER := 0;
  v_longest_streak INTEGER := 0;
  v_temp_streak INTEGER := 1;
  v_prev_date DATE;
  v_curr_date DATE;
  v_last_date DATE;
  v_today DATE := CURRENT_DATE;
  v_lifetime INTEGER := 0;
  v_30d INTEGER := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT DISTINCT activity_date
    FROM public.streak_logs
    WHERE user_id = p_user_id
    ORDER BY activity_date ASC
  LOOP
    v_curr_date := rec.activity_date;

    IF v_prev_date IS NOT NULL THEN
      IF v_curr_date - v_prev_date = 1 THEN
        v_temp_streak := v_temp_streak + 1;
      ELSE
        v_temp_streak := 1;
      END IF;
    END IF;

    IF v_temp_streak > v_longest_streak THEN
      v_longest_streak := v_temp_streak;
    END IF;

    v_last_date := v_curr_date;
    v_prev_date := v_curr_date;
  END LOOP;

  IF v_last_date IS NOT NULL AND (v_today - v_last_date) <= 1 THEN
    v_current_streak := v_temp_streak;
  ELSE
    v_current_streak := 0;
  END IF;

  SELECT COALESCE(lifetime_contributions, 0), COALESCE(contributions_30d, 0)
    INTO v_lifetime, v_30d
    FROM public.users WHERE id = p_user_id;

  UPDATE public.users
  SET
    streak = v_current_streak,
    longest_streak = GREATEST(longest_streak, v_longest_streak),
    badge_level = CASE
      WHEN GREATEST(longest_streak, v_longest_streak) >= 365 THEN 'diamond'::badge_level
      WHEN GREATEST(longest_streak, v_longest_streak) >= 180 THEN 'gold'::badge_level
      WHEN GREATEST(longest_streak, v_longest_streak) >= 90 THEN 'silver'::badge_level
      WHEN GREATEST(longest_streak, v_longest_streak) >= 30 THEN 'bronze'::badge_level
      ELSE 'none'::badge_level
    END,
    vibe_score =
      10
      + (v_current_streak * 2)
      + COALESCE((
        SELECT SUM(
          2
          + CASE WHEN live_url IS NOT NULL AND live_url != '' THEN 2 ELSE 0 END
          + CASE WHEN github_url IS NOT NULL AND github_url != '' THEN 2 ELSE 0 END
          + CASE WHEN quality_score > 0 THEN LEAST(quality_score, 100) ELSE 0 END
        ) FROM public.projects WHERE projects.user_id = p_user_id AND NOT COALESCE(flagged, false)
      ), 0)
      + COALESCE((
        SELECT COUNT(*) * 5
        FROM public.project_endorsements pe
        JOIN public.projects p ON p.id = pe.project_id
        WHERE p.user_id = p_user_id AND NOT COALESCE(p.flagged, false)
      ), 0)
      + CASE
        WHEN GREATEST(longest_streak, v_longest_streak) >= 365 THEN 40
        WHEN GREATEST(longest_streak, v_longest_streak) >= 180 THEN 30
        WHEN GREATEST(longest_streak, v_longest_streak) >= 90 THEN 20
        WHEN GREATEST(longest_streak, v_longest_streak) >= 30 THEN 10
        ELSE 0
      END
      + COALESCE((
        SELECT SUM(
          CASE rating
            WHEN 5 THEN 20
            WHEN 4 THEN 15
            WHEN 3 THEN 10
            WHEN 2 THEN 5
            ELSE 0
          END
        )
        FROM public.reviews
        WHERE builder_id = p_user_id
          AND COALESCE(trust_score, 100) >= 30
      ), 0)
      + LEAST(FLOOR(SQRT(GREATEST(0, v_lifetime)::numeric))::INTEGER, 250)
      + LEAST(FLOOR(v_30d::numeric * 0.5)::INTEGER, 50)
      -- ── VOUCH TERM (new) ──
      -- Group by voucher first: re-vouching adds to that voucher's total BEFORE
      -- the per-voucher cap applies. Credibility is 0 below vibe_score 20, so a
      -- throwaway account's burn still shows publicly but scores nothing.
      -- Verified against live Postgres: $10/718 -> 3, $25/200 -> 5,
      -- $100/44 -> 5, $2/400 -> 1, $50/10 -> 0, profile total 14.
      + COALESCE((
        SELECT LEAST(SUM(pts), 25)::INTEGER FROM (
          SELECT LEAST(
            FLOOR(
              SQRT(SUM(v.usd_at_burn)) *
              CASE
                WHEN vu.vibe_score < 20 THEN 0
                ELSE 0.5 + 0.5 * LEAST(vu.vibe_score::numeric / 200, 1)
              END
            ), 5
          ) AS pts
          FROM public.vouches v
          JOIN public.users vu ON vu.id = v.voucher_id
          WHERE v.builder_id = p_user_id
          GROUP BY v.voucher_id, vu.vibe_score
        ) per_voucher
      ), 0)
  WHERE id = p_user_id;
END;
$function$;
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: applies cleanly.

- [ ] **Step 3: Verify the schema landed**

```bash
npx supabase db push --dry-run
```
Expected: no pending changes.

Then confirm the columns and tables exist by querying `information_schema.columns` for `users`, `streak_logs`, `vouches` and `streak_protects`.

- [ ] **Step 4: Verify the vouch term scores correctly**

Pick a test user with no vouches, note their `vibe_score`, insert a vouch from a high-score account, call `SELECT public.update_user_streak('<builder-id>')`, and confirm the score rose by exactly the expected points. Then delete the test vouch and re-run the function to confirm it returns to the original value.

- [ ] **Step 5: Check for new advisor warnings**

Run the Supabase security advisor and confirm no new RLS warnings for `vouches` or `streak_protects`. A `SELECT USING (true)` on `vouches` is intentional and expected — vouches are public.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260811_vibe_utility.sql
git commit -m "feat(db): add wallet linking, vouches, streak protects and the capped vouch score term"
```

---

# Phase 4 — Verified wallet link

### Task 4.1: Nonce endpoint

**Files:**
- Create: `src/lib/wallet-link.ts`
- Create: `src/app/api/wallet/nonce/route.ts`

- [ ] **Step 1: Create the shared helpers module**

These live in `lib`, not in the route file. App Router restricts what a `route.ts`
may export — arbitrary named exports alongside `GET`/`POST` are not allowed, and
the link route needs both helpers to reconstruct the exact signed message.

```ts
// src/lib/wallet-link.ts
//
// Shared between the nonce and link routes. The signed message must be byte
// identical on both sides or verification fails, so it is built in exactly one
// place.

export const NONCE_TTL_SECONDS = 300;

export function nonceKey(userId: string): string {
  return `wallet-nonce:${userId}`;
}

export function nonceMessage(nonce: string): string {
  return `Link this wallet to your VibeTalent account.\n\nNonce: ${nonce}\n\nThis proves you own the wallet. It does not approve any transaction or spend.`;
}
```

- [ ] **Step 2: Write the route**

```ts
// src/app/api/wallet/nonce/route.ts
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { nonceKey, nonceMessage, NONCE_TTL_SECONDS } from "@/lib/wallet-link";

// A nonce makes the signature single-use and time-bounded, so a signature
// captured from one link attempt can't be replayed to bind the wallet again.

export async function GET() {
  const authClient = await createServerSupabaseClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    // Fail closed: without nonce storage the signature can't be made single-use.
    return NextResponse.json(
      { error: "Wallet linking is unavailable right now." },
      { status: 503 },
    );
  }

  const nonce = crypto.randomUUID();
  const redis = new Redis({ url, token });
  await redis.set(nonceKey(user.id), nonce, { ex: NONCE_TTL_SECONDS });

  return NextResponse.json({ nonce, message: nonceMessage(nonce) });
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors. In particular, confirm Next.js does not complain about
invalid route exports — that is exactly what Step 1 avoids.

- [ ] **Step 4: Commit**

```bash
git add src/lib/wallet-link.ts src/app/api/wallet/nonce/route.ts
git commit -m "feat(wallet): add single-use nonce endpoint for wallet linking"
```

---

### Task 4.2: Link endpoint with ed25519 verification

**Files:**
- Create: `src/app/api/wallet/link/route.ts`

**Verified API:** `@noble/curves@1.8.0` + `bs58@6.0.0`, confirmed working with a real signature round-trip:
`ed25519.verify(bs58.decode(sig), new TextEncoder().encode(msg), bs58.decode(address))`.

- [ ] **Step 1: Write the route**

```ts
// src/app/api/wallet/link/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";
import { Redis } from "@upstash/redis";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nonceKey, nonceMessage } from "@/lib/wallet-link";

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function POST(req: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const { address, signature } = (await req.json()) ?? {};
    if (typeof address !== "string" || !SOLANA_ADDRESS_RE.test(address)) {
      return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
    }
    if (typeof signature !== "string" || signature.length < 64) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    }

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      return NextResponse.json({ error: "Wallet linking is unavailable right now." }, { status: 503 });
    }

    // Consume the nonce so a captured signature can't be replayed.
    const redis = new Redis({ url, token });
    const nonce = await redis.get<string>(nonceKey(user.id));
    if (!nonce) {
      return NextResponse.json(
        { error: "That link request expired. Please try again." },
        { status: 400 },
      );
    }
    await redis.del(nonceKey(user.id));

    let valid = false;
    try {
      valid = ed25519.verify(
        bs58.decode(signature),
        new TextEncoder().encode(nonceMessage(nonce)),
        bs58.decode(address),
      );
    } catch {
      valid = false; // malformed base58 in either field
    }
    if (!valid) {
      return NextResponse.json(
        { error: "That signature doesn't match the wallet." },
        { status: 400 },
      );
    }

    const sb = createAdminClient();

    // One wallet, one account — enforced by a unique index, but check first so
    // the user gets a clear message instead of a constraint error.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: taken } = await (sb as any)
      .from("users")
      .select("id")
      .eq("solana_wallet", address)
      .neq("id", user.id)
      .maybeSingle();
    if (taken) {
      return NextResponse.json(
        { error: "That wallet is already linked to another account." },
        { status: 409 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb as any)
      .from("users")
      .update({
        solana_wallet: address,
        solana_wallet_verified_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      console.error("Failed to link wallet:", error);
      return NextResponse.json({ error: "Couldn't link that wallet." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, address });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
```

- [ ] **Step 2: Test the signature path end to end**

Write a throwaway script under the scratchpad that generates a keypair, signs `nonceMessage("test-nonce")`, and verifies it — confirming the exact encode/decode pairing before wiring the UI:

```js
import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";
const priv = ed25519.utils.randomPrivateKey();
const pub = ed25519.getPublicKey(priv);
const msg = new TextEncoder().encode("Link this wallet to your VibeTalent account.\n\nNonce: test-nonce\n\nThis proves you own the wallet. It does not approve any transaction or spend.");
const sig = ed25519.sign(msg, priv);
console.log(ed25519.verify(bs58.decode(bs58.encode(sig)), msg, bs58.decode(bs58.encode(pub)))); // true
```

Expected: `true`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/wallet/link/route.ts
git commit -m "feat(wallet): verify wallet ownership via ed25519 and bind it to the account"
```

---

### Task 4.3: Wallet linking UI in Settings

**Files:**
- Modify: `src/app/settings/page.tsx`
- Create: `src/components/token/link-wallet.tsx`

- [ ] **Step 1: Create the client component**

Wrap in `PrivyProvider` with the Solana-only config, exactly as `feature-your-project-card.tsx` does — including the module-scoped `getSolanaConnectors()` cache, which Privy requires to be a stable reference. Load it through `next/dynamic` with `ssr: false` so the ~60-chunk web3 stack stays off the Settings critical path.

The flow:

```tsx
async function handleLink() {
  setBusy(true);
  try {
    const res = await fetch("/api/wallet/nonce");
    if (!res.ok) throw new Error("Couldn't start wallet linking. Try again.");
    const { message } = await res.json();

    const { signature } = await signMessage({
      message,
      wallet: connectedSolanaWallet,
    });

    const link = await fetch("/api/wallet/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: connectedSolanaWallet.address,
        signature: typeof signature === "string" ? signature : signatureToString(signature),
      }),
    });
    if (!link.ok) {
      const e = await link.json().catch(() => ({}));
      throw new Error(e.error || "Couldn't link that wallet.");
    }
    setLinked(connectedSolanaWallet.address);
  } catch (e) {
    setError(e instanceof Error ? e.message : "Couldn't link that wallet.");
  } finally {
    setBusy(false);
  }
}
```

`signMessage` comes from `useSignMessage` in `@privy-io/react-auth/solana`. `signatureToString` is already exported from `src/lib/solana-payment.ts`. Copy the status-message markup (role/aria-live) from `feature-your-project-card.tsx`.

State to render: not connected → "Connect Solana Wallet"; connected but unlinked → "Verify ownership"; linked → the shortened address, current $VIBE balance, holder tier, and an unlink option.

- [ ] **Step 2: Mount it in Settings**

Add a "Wallet" section to `src/app/settings/page.tsx` matching the existing section styling, with copy explaining what linking unlocks: free streak freezes by holding, and attribution for vouches.

- [ ] **Step 3: Verify in the browser**

Run the dev server, open `/settings`, connect a Solana wallet, sign, and confirm the address persists across a reload. Then attempt to link the same wallet from a second account and confirm the 409 message renders.

- [ ] **Step 4: Commit**

```bash
git add src/components/token/link-wallet.tsx src/app/settings/page.tsx
git commit -m "feat(wallet): add wallet linking UI to settings"
```

---

# Phase 5 — Streak protect

### Task 5.1: Capture the break in the reset cron

**Files:**
- Modify: `src/app/api/cron/reset-streaks/route.ts`

The cron currently sets `streak = 0` and throws away the value, so there is nothing to restore. It also writes synthetic freeze rows that are indistinguishable from real activity.

- [ ] **Step 1: Stamp `source` on the synthetic freeze rows**

In the `syntheticLogs` map (around line 99), add the marker:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const syntheticLogs = usersToFreeze.map((u: any) => ({
  user_id: u.id,
  activity_date: yesterdayStr,
  source: "freeze",
}));
```

- [ ] **Step 2: Record the pre-break streak instead of discarding it**

Replace the bulk reset (around lines 141-157) — the bulk `.in()` update can't write a per-user `streak_before_break`, so it becomes a loop:

```ts
if (usersToReset.length > 0) {
  const brokenAt = new Date().toISOString();
  for (const u of usersToReset as Array<{ id: string; username: string; streak: number }>) {
    // Record what was lost so a paid restore knows what to bring back. Without
    // this the value is gone the moment the streak resets.
    const { error: updateError } = await supabase
      .from("users")
      .update({
        streak: 0,
        streak_before_break: u.streak,
        streak_broken_at: brokenAt,
      })
      .eq("id", u.id);
    if (updateError) {
      console.error(`Failed to reset streak for ${u.username}:`, updateError);
    }
  }
  console.log(
    `Reset streaks for ${usersToReset.length} users:`,
    usersToReset.map((u: { username: string }) => u.username),
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && ./node_modules/.bin/eslint src`
Expected: clean.

Trigger the route locally with the `CRON_SECRET` bearer token and confirm the response shape is unchanged and that a reset user has `streak_before_break` and `streak_broken_at` populated.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/reset-streaks/route.ts
git commit -m "feat(streak): record the pre-break streak and mark freeze-sourced logs"
```

---

### Task 5.2: Streak protect endpoint

**Files:**
- Create: `src/app/api/streak/protect/route.ts`

Auth → eligibility → replay → shared burn verification → restore → record.

- [ ] **Step 1: Write the route**

```ts
// src/app/api/streak/protect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyBurnTransaction } from "@/lib/vibe-burn-verify";
import { STREAK_PROTECT } from "@/lib/vibe-config";

const SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;
const DAY_MS = 86_400_000;

function ymd(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const { signature, break_date: breakDate } = (await req.json()) ?? {};
    if (typeof signature !== "string" || !SIGNATURE_RE.test(signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    if (typeof breakDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(breakDate)) {
      return NextResponse.json({ error: "Invalid break_date" }, { status: 400 });
    }

    const sb = createAdminClient();

    // 2. Eligibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: me } = await (sb as any)
      .from("users")
      .select("id, streak_before_break, streak_broken_at")
      .eq("id", user.id)
      .single();

    if (!me?.streak_broken_at || !me?.streak_before_break) {
      return NextResponse.json({ error: "You have no broken streak to restore." }, { status: 400 });
    }
    if (me.streak_before_break < STREAK_PROTECT.minStreakToOffer) {
      return NextResponse.json(
        { error: `Streaks under ${STREAK_PROTECT.minStreakToOffer} days can't be restored.` },
        { status: 400 },
      );
    }

    const brokenAt = new Date(me.streak_broken_at).getTime();
    if (Date.now() - brokenAt > STREAK_PROTECT.graceHours * 3600_000) {
      return NextResponse.json(
        { error: `The ${STREAK_PROTECT.graceHours}-hour window to restore this streak has passed.` },
        { status: 400 },
      );
    }

    // Monthly rate cap.
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: usedThisMonth } = await (sb as any)
      .from("streak_protects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", monthStart.toISOString());
    if ((usedThisMonth ?? 0) >= STREAK_PROTECT.maxPaidPerMonth) {
      return NextResponse.json(
        { error: `You've used all ${STREAK_PROTECT.maxPaidPerMonth} streak restores this month.` },
        { status: 429 },
      );
    }

    // 3. Work out the gap to fill.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lastLog } = await (sb as any)
      .from("streak_logs")
      .select("activity_date")
      .eq("user_id", user.id)
      .order("activity_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastLog?.activity_date) {
      return NextResponse.json({ error: "No activity history to restore." }, { status: 400 });
    }

    const yesterday = new Date(Date.now() - DAY_MS);
    const missing: string[] = [];
    for (
      let t = new Date(lastLog.activity_date).getTime() + DAY_MS;
      t <= yesterday.getTime();
      t += DAY_MS
    ) {
      missing.push(ymd(new Date(t)));
    }
    if (missing.length === 0) {
      return NextResponse.json({ error: "Your streak isn't broken." }, { status: 400 });
    }
    if (missing.length > STREAK_PROTECT.maxGapDays) {
      return NextResponse.json(
        { error: `You've missed ${missing.length} days — only up to ${STREAK_PROTECT.maxGapDays} can be restored.` },
        { status: 400 },
      );
    }

    // 4. Replay — a signature can only ever be used once.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (sb as any)
      .from("streak_protects").select("id").eq("tx_ref", signature).maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "This transaction was already used." }, { status: 409 });
    }

    // 5. Verify the burn. The memo must name THIS user and THIS break date, so
    //    another user's broadcast burn can't be claimed here.
    const verdict = await verifyBurnTransaction(
      signature,
      { kind: "protect", actorId: user.id, breakDate },
      STREAK_PROTECT.usdPrice,
    );
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.error }, { status: verdict.status });
    }

    // 6. Fill the gap, then let the trigger recompute the streak.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: logsErr } = await (sb as any).from("streak_logs").upsert(
      missing.map((d) => ({ user_id: user.id, activity_date: d, source: "restore" })),
      { onConflict: "user_id,activity_date", ignoreDuplicates: true },
    );
    if (logsErr) {
      console.error("Failed to insert restore logs:", logsErr);
      return NextResponse.json({ error: "Couldn't restore your streak." }, { status: 500 });
    }

    // The AFTER INSERT trigger on streak_logs recomputes streak + vibe_score.
    // Clear the break markers so the offer disappears.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from("users")
      .update({ streak_broken_at: null, streak_before_break: null })
      .eq("id", user.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from("streak_protects").insert({
      user_id: user.id,
      vibe_burned: verdict.burned.toString(),
      usd_at_burn: STREAK_PROTECT.usdPrice,
      tx_ref: signature,
      streak_restored: me.streak_before_break,
      days_filled: missing.length,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: after } = await (sb as any)
      .from("users").select("streak").eq("id", user.id).single();

    return NextResponse.json({ ok: true, streak: after?.streak ?? me.streak_before_break });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && ./node_modules/.bin/eslint src && npm run test`
Expected: clean, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/streak/protect/route.ts
git commit -m "feat(streak): add \$VIBE burn endpoint to restore a broken streak"
```

---

### Task 5.3: Streak protect UI

**Files:**
- Create: `src/components/token/burn-confirm.tsx`
- Create: `src/components/dashboard/streak-protect-card.tsx`
- Modify: the dashboard streak section

- [ ] **Step 1: Build the shared confirmation panel**

Used by both burn flows. **Copy rule for every string here: never "spend", "pay", "stake" or "send" — the tokens are destroyed.**

```tsx
// src/components/token/burn-confirm.tsx
"use client";

import { useState } from "react";
import { Flame, Loader2 } from "lucide-react";
import { formatTokenCount } from "@/lib/token-stats";

type Props = {
  /** Base-unit amount about to be destroyed, already converted to whole tokens. */
  tokenAmount: number;
  usdAmount: number;
  /** One line naming what the burn achieves, e.g. "@karan gets +2 vibe score". */
  outcome: string;
  /** Who, if anyone, the user might wrongly assume receives the tokens. */
  recipientDisclaimer: string;
  busy: boolean;
  onConfirm: () => void;
  onBack: () => void;
};

export function BurnConfirm({
  tokenAmount, usdAmount, outcome, recipientDisclaimer, busy, onConfirm, onBack,
}: Props) {
  const [acknowledged, setAcknowledged] = useState(false);
  const pretty = formatTokenCount(tokenAmount);

  return (
    <div className="p-4" style={{ border: "2px solid var(--accent)", backgroundColor: "var(--bg-surface)" }}>
      <div className="flex items-center gap-2">
        <Flame size={18} style={{ color: "var(--accent)" }} aria-hidden="true" />
        <h3 className="text-sm font-extrabold uppercase text-[var(--foreground)]">This burn is permanent</h3>
      </div>

      <p className="mt-3 text-sm text-[var(--foreground)] leading-relaxed">
        You&apos;re about to destroy{" "}
        <strong className="font-mono">{tokenAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })} $VIBE</strong>{" "}
        (~${usdAmount.toFixed(2)}) forever.
      </p>

      <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
        <strong className="text-[var(--foreground)]">Nobody receives these tokens</strong> — {recipientDisclaimer}.
        They&apos;re removed from the total supply permanently.
      </p>

      <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">In return: {outcome}.</p>

      <p className="mt-2 text-sm font-bold text-[var(--foreground)]">
        This cannot be undone, reversed, or refunded.
      </p>

      <label className="mt-4 flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5"
        />
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          I understand these tokens will be destroyed and cannot be recovered.
        </span>
      </label>

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onBack} disabled={busy} className="btn-brutal text-sm">
          Back
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!acknowledged || busy}
          className="btn-brutal btn-brutal-primary btn-notched flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? (
            <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Burning...</>
          ) : (
            <><Flame size={16} aria-hidden="true" /> Burn {pretty} $VIBE</>
          )}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build the protect card**

Renders only when the user has a restorable break.

`breakDate` is `ymd(new Date(user.streak_broken_at))` and must be **the same
string** in the memo and in the POST body — the server rebuilds the expected
memo from the body and rejects a mismatch, so a disagreement here fails
verification with "that burn isn't bound to this action".

Steps: derive `breakDate` → quote the `STREAK_PROTECT.usdPrice` in $VIBE →
build the burn with `buildSolanaTokenBurn` and memo
`buildBurnMemo({ kind: "protect", actorId: userId, breakDate })` → sign via
Privy `useSignAndSendTransaction` → `POST /api/streak/protect` with
`{ signature, break_date: breakDate }`, retrying on 404/503 for up to 6 attempts
with 2.5s gaps, exactly as `handlePromoteSolana` does in
`feature-your-project-card.tsx`.

Confirmation props:
- `outcome`: `` `your ${streakBeforeBreak}-day streak comes back` ``
- `recipientDisclaimer`: `"not VibeTalent, not anyone else"`

On success show the restored streak and a Solscan link: `` `https://solscan.io/tx/${signature}` ``.

- [ ] **Step 3: Mount it on the dashboard**

Render above the streak heatmap, only when a break is restorable.

- [ ] **Step 4: Mark restored days in the heatmap**

In `src/lib/heatmap-utils.ts` and the heatmap component, carry `source` through and render `freeze`/`restore` days in a distinct style from earned activity — protected days must be visually honest.

- [ ] **Step 5: Verify end to end**

With a linked wallet holding $VIBE on mainnet, break a streak in staging data, confirm the card appears, complete a burn, and confirm: the streak returns, the transaction verifies on Solscan, the restored day renders distinctly, and a replay of the same signature returns 409.

- [ ] **Step 6: Commit**

```bash
git add src/components/token/burn-confirm.tsx src/components/dashboard/streak-protect-card.tsx src/lib/heatmap-utils.ts
git commit -m "feat(streak): add burn-to-protect UI with explicit irreversibility confirmation"
```

---

# Phase 6 — Burn to vouch

### Task 6.1: Vouch endpoint

**Files:**
- Create: `src/app/api/vouch/route.ts`

- [ ] **Step 1: Add a rate limiter**

In `src/lib/rate-limit.ts`, alongside `endorsementsLimiter`, following the same
`createRateLimiter` pattern:

```ts
export const vouchLimiter = createRateLimiter("vouch", 10, "1 h");
```

- [ ] **Step 2: Write the route**

```ts
// src/app/api/vouch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { vouchLimiter, getIP, checkRateLimit } from "@/lib/rate-limit";
import { verifyBurnTransaction } from "@/lib/vibe-burn-verify";
import { VOUCH } from "@/lib/vibe-config";

const SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const limited = await checkRateLimit(vouchLimiter, getIP(req));
    if (limited) return limited;

    // 2. Validate
    const { builder_username: builderUsername, usd, signature } = (await req.json()) ?? {};
    if (typeof signature !== "string" || !SIGNATURE_RE.test(signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    if (typeof builderUsername !== "string" || !builderUsername.trim()) {
      return NextResponse.json({ error: "Invalid builder" }, { status: 400 });
    }
    const usdAmount = Number(usd);
    if (!Number.isFinite(usdAmount) || usdAmount < VOUCH.minUsd) {
      return NextResponse.json(
        { error: `The minimum vouch is $${VOUCH.minUsd}.` },
        { status: 400 },
      );
    }

    const sb = createAdminClient();

    // 3. Resolve the builder. A clear message beats hitting the
    //    vouches_no_self_vouch constraint.
    const { data: builder } = await sb
      .from("users")
      .select("id, username")
      .eq("username", builderUsername)
      .single();
    if (!builder) {
      return NextResponse.json({ error: "Builder not found." }, { status: 404 });
    }
    if (builder.id === user.id) {
      return NextResponse.json({ error: "You can't vouch for yourself." }, { status: 400 });
    }

    // 4. Replay — a signature can only ever be claimed once.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (sb as any)
      .from("vouches").select("id").eq("tx_ref", signature).maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "This transaction was already used." }, { status: 409 });
    }

    // 5. Verify the burn. The memo must name this voucher AND this builder.
    const verdict = await verifyBurnTransaction(
      signature,
      { kind: "vouch", actorId: user.id, targetId: builder.id },
      usdAmount,
    );
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.error }, { status: verdict.status });
    }

    // 6. Record it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insErr } = await (sb as any).from("vouches").insert({
      voucher_id: user.id,
      builder_id: builder.id,
      vibe_burned: verdict.burned.toString(),
      usd_at_burn: usdAmount,
      tx_ref: signature,
    });
    if (insErr) {
      console.error("Failed to record vouch:", insErr);
      return NextResponse.json({ error: "Couldn't record that vouch." }, { status: 500 });
    }

    // 7. Recompute the builder's score. Without this the vouch has no effect on
    //    vibe_score until their next activity fires the streak_logs trigger.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcErr } = await (sb as any).rpc("update_user_streak", {
      p_user_id: builder.id,
    });
    if (rpcErr) {
      // The vouch is recorded and will count on the next recompute; don't fail
      // the request over a scoring refresh.
      console.error("Failed to recompute score after vouch:", rpcErr);
    }

    // 8. Bust the builder's cached profile so the new backer shows immediately.
    try {
      revalidateTag(`user-${builder.username}`, { expire: 0 });
      revalidatePath(`/profile/${builder.username}`);
    } catch (err) {
      console.error("Failed to revalidate builder profile:", err);
    }

    return NextResponse.json({ ok: true, burned: verdict.burned.toString() });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && ./node_modules/.bin/eslint src && npm run test`
Expected: clean.

Confirm `checkRateLimit` and `getIP` are exported from `src/lib/rate-limit.ts`
with the signatures used above — check how `src/app/api/endorsements/route.ts`
calls them and match it exactly.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/vouch/route.ts src/lib/rate-limit.ts
git commit -m "feat(vouch): add \$VIBE burn endpoint for vouching for a builder"
```

---

### Task 6.2: Vouch UI

**Files:**
- Create: `src/components/token/vouch-button.tsx`

- [ ] **Step 1: Build the two-step flow**

**Step 1 — amount.** Preset buttons from `VOUCH.presetsUsd` plus a custom field with a `VOUCH.minUsd` floor. Below the selection, live:

```
$5.00 ≈ 2,078,000 $VIBE  ·  gives @karan +2 vibe score
```

Token equivalent from the quote; points preview from `vouchPoints(usd, viewerVibeScore)`. When the viewer is below `VOUCH.voucherMinVibeScore`, say so plainly instead of showing `+0`:

> Your vouch will show publicly on their profile, but won't add to their score until your own vibe score reaches 20.

Also surface the cap so nobody overspends: *"Score contribution caps at $25 per person."*

**Step 2 — confirm.** Render `<BurnConfirm>` with:
- `outcome`: `` `@${username} gets +${points} vibe score, and you appear publicly as a backer on their profile` ``
- `recipientDisclaimer`: `` `not VibeTalent, not @${username}` ``

**Then:** build the burn with memo `vouch:<userId>:<builderId>`, sign, POST, retry on 404/503 as above, and on success show the Solscan link.

- [ ] **Step 2: Verify the two-step gate**

Confirm the burn button stays disabled until the checkbox is ticked, that "Back" returns to amount selection with the amount preserved, and that no wallet prompt appears before confirmation.

- [ ] **Step 3: Commit**

```bash
git add src/components/token/vouch-button.tsx
git commit -m "feat(vouch): add two-step vouch flow with burn confirmation"
```

---

### Task 6.3: "Backed by" profile display

**Files:**
- Create: `src/components/profile/backed-by.tsx`
- Modify: the profile page

- [ ] **Step 1: Build the component**

Server component. Query vouches for the builder joined to voucher `username`, `display_name`, `avatar_url`, `vibe_score`; group by voucher and sum.

Render:
- Headline: total $VIBE burned (uncapped — this is the trust signal) and backer count.
- Each backer: avatar, username, amount burned, relative time.
- The `<VouchButton>` for viewers who aren't the profile owner.

Empty state, for a profile with no vouches: a short line inviting the first vouch, plus the button. Do not render a bare empty box.

- [ ] **Step 2: Mount on the profile page**

Place near the endorsements section. Gate avatars on `avatar_url` being set, following the pattern in `src/lib/notification-display.ts` — avatars are unset for most production users and fall back to icon chips.

- [ ] **Step 3: Verify**

Confirm the total reflects the full burned amount even when the score contribution is capped — the display is deliberately uncapped while the score is not.

- [ ] **Step 4: Commit**

```bash
git add src/components/profile/backed-by.tsx src/app/profile
git commit -m "feat(vouch): show backers and total \$VIBE burned on profiles"
```

---

# Phase 7 — Holder tiers

### Task 7.1: Balance refresh helper

**Files:**
- Create: `src/lib/vibe-balance.ts`

- [ ] **Step 1: Write the helper**

```ts
// src/lib/vibe-balance.ts
//
// Reads a wallet's $VIBE balance from Solana and caches it on the user row.
// Cached because the public RPC is slow and rate-limited, and profile/dashboard
// renders must not depend on a live RPC round trip.

import { CHAIN_CONFIGS, isSolanaChain } from "@/lib/chains-config";
import { VIBE_MINT } from "@/lib/vibe-config";

const REFRESH_COOLDOWN_MS = 60_000;

/** Live $VIBE balance in base units for a wallet. Null if unreadable. */
export async function fetchVibeBalance(wallet: string): Promise<bigint | null> {
  const solana = CHAIN_CONFIGS.solana;
  if (!isSolanaChain(solana)) return null;
  try {
    const res = await fetch(solana.rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "getTokenAccountsByOwner",
        params: [wallet, { mint: VIBE_MINT }, { encoding: "jsonParsed" }],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const accounts = json?.result?.value ?? [];
    // A wallet can hold the same mint across several token accounts.
    return accounts.reduce(
      (acc: bigint, a: { account?: { data?: { parsed?: { info?: { tokenAmount?: { amount?: string } } } } } }) =>
        acc + BigInt(a?.account?.data?.parsed?.info?.tokenAmount?.amount || "0"),
      BigInt(0),
    );
  } catch {
    return null;
  }
}

/** Has the cached balance gone stale enough to justify another RPC call? */
export function isBalanceStale(balanceAt: string | null): boolean {
  if (!balanceAt) return true;
  return Date.now() - new Date(balanceAt).getTime() > REFRESH_COOLDOWN_MS;
}
```

- [ ] **Step 2: Test the pure helper**

```ts
// src/lib/__tests__/vibe-balance.test.ts
import { describe, it, expect } from "vitest";
import { isBalanceStale } from "../vibe-balance";

describe("isBalanceStale", () => {
  it("treats a never-fetched balance as stale", () => {
    expect(isBalanceStale(null)).toBe(true);
  });

  it("treats a just-fetched balance as fresh", () => {
    expect(isBalanceStale(new Date().toISOString())).toBe(false);
  });

  it("treats a balance older than the cooldown as stale", () => {
    expect(isBalanceStale(new Date(Date.now() - 120_000).toISOString())).toBe(true);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npm run test -- src/lib/__tests__/vibe-balance.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 4: Add the on-demand refresh route**

The monthly cron is what *grants* allowances, but the tier display on `/token`
and Settings needs a current balance without waiting for the 1st. The cooldown
keeps this from hammering the rate-limited public RPC.

```ts
// src/app/api/wallet/balance/route.ts
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchVibeBalance, isBalanceStale } from "@/lib/vibe-balance";

export async function POST() {
  try {
    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const sb = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: me } = await (sb as any)
      .from("users")
      .select("solana_wallet, vibe_balance, vibe_balance_at")
      .eq("id", user.id)
      .single();

    if (!me?.solana_wallet) {
      return NextResponse.json({ error: "No wallet linked." }, { status: 400 });
    }

    // Serve the cache inside the cooldown rather than re-hitting the RPC.
    if (!isBalanceStale(me.vibe_balance_at)) {
      return NextResponse.json({ balance: String(me.vibe_balance ?? "0"), cached: true });
    }

    const balance = await fetchVibeBalance(me.solana_wallet);
    if (balance == null) {
      // Fall back to the cached value — a transient RPC failure shouldn't make
      // the UI claim the user holds nothing.
      return NextResponse.json({ balance: String(me.vibe_balance ?? "0"), cached: true });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from("users").update({
      vibe_balance: balance.toString(),
      vibe_balance_at: new Date().toISOString(),
    }).eq("id", user.id);

    return NextResponse.json({ balance: balance.toString(), cached: false });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && ./node_modules/.bin/eslint src`
Expected: clean.

Call the route twice in quick succession with a linked wallet and confirm the
second response has `cached: true`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/vibe-balance.ts src/lib/__tests__/vibe-balance.test.ts src/app/api/wallet/balance/route.ts
git commit -m "feat(vibe): add cached \$VIBE balance reader and on-demand refresh"
```

---

### Task 7.2: Tier-aware freeze allowance

**Files:**
- Modify: `src/app/api/cron/reset-freezes/route.ts`

The cron currently writes a flat `2` for everyone. It becomes per-user, driven by holdings.

- [ ] **Step 1: Replace the bulk update with a tier-aware pass**

Keep the existing `CRON_SECRET` gate and the day-of-month check unchanged. Replace the bulk `.update({ streak_freezes_remaining: 2, ... })` with:

```ts
import { fetchVibeBalance } from "@/lib/vibe-balance";
import { freezeAllowanceFor, BASE_FREEZES, VIBE_DECIMALS } from "@/lib/vibe-config";
import { fetchVibeUsdCached } from "@/lib/promotion-pricing";

// Everyone starts from the base allowance; linked wallets can raise it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { error: baseErr } = await (supabase as any)
  .from("users")
  .update({ streak_freezes_remaining: BASE_FREEZES, streak_freezes_used: 0 })
  .neq("id", "");
if (baseErr) {
  console.error("Failed to reset freezes:", baseErr);
  return NextResponse.json({ error: "Failed to reset freezes" }, { status: 500 });
}

// Holder tiers. If $VIBE can't be priced, everyone keeps the base allowance —
// better to under-grant than to grant a tier we couldn't verify.
let vibeUsd: number | null = null;
try {
  vibeUsd = await fetchVibeUsdCached();
} catch {
  console.warn("Could not price $VIBE; holder tiers skipped this cycle");
}

let upgraded = 0;
if (vibeUsd != null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: linked } = await (supabase as any)
    .from("users")
    .select("id, solana_wallet")
    .not("solana_wallet", "is", null);

  for (const u of (linked ?? []) as Array<{ id: string; solana_wallet: string }>) {
    const balance = await fetchVibeBalance(u.solana_wallet);
    if (balance == null) continue;
    const usdHeld = (Number(balance) / 10 ** VIBE_DECIMALS) * vibeUsd;
    const allowance = freezeAllowanceFor(usdHeld);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("users").update({
      streak_freezes_remaining: allowance,
      vibe_balance: balance.toString(),
      vibe_balance_at: new Date().toISOString(),
    }).eq("id", u.id);

    if (allowance > BASE_FREEZES) upgraded++;
  }
}
```

Return `upgraded` in the response alongside the existing count so the cron log shows tier grants.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && ./node_modules/.bin/eslint src`
Expected: clean.

Trigger locally with `?force=1` and the bearer token. Confirm every user has `streak_freezes_remaining >= 2` and that a wallet holding over $10 of $VIBE received 3.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/reset-freezes/route.ts
git commit -m "feat(vibe): grant extra monthly streak freezes to \$VIBE holders"
```

---

### Task 7.3: Show the tier where it motivates

**Files:**
- Modify: `src/components/token/link-wallet.tsx`, `src/app/token/page.tsx`

- [ ] **Step 1: Show the viewer's tier**

In the wallet section of Settings and on `/token`, when a wallet is linked show: balance, USD value, current tier, freezes granted, and — when not on the top tier — how much more is needed:

> Holding $12.40 · **Backer** · 3 free freezes/month
> Hold $40 to reach Patron and get 4.

- [ ] **Step 2: Verify**

Confirm the numbers agree with what `reset-freezes` would grant for the same balance, and that an unlinked user sees a prompt to link rather than a broken tier display.

- [ ] **Step 3: Commit**

```bash
git add src/components/token/link-wallet.tsx src/app/token/page.tsx
git commit -m "feat(vibe): surface holder tier and progress to the next one"
```

---

## Final verification

- [ ] `npm run test` — all green
- [ ] `npx tsc --noEmit` — clean
- [ ] `./node_modules/.bin/eslint src` — clean (scope to `src/`; the gitignored `vibecoders/` folder produces ~10k noise errors)
- [ ] `npm run build` — succeeds
- [ ] Supabase security advisor shows no new warnings beyond the intentional public `SELECT` on `vouches`
- [ ] A real burn on mainnet verifies, grants, and appears on Solscan
- [ ] Replaying the same signature returns 409 on both burn endpoints
- [ ] A burn whose memo names a different actor is rejected
- [ ] A plain transfer of the correct amount is rejected as "didn't burn enough" — this is the invariant's core guarantee
- [ ] `/token` renders correctly in light and dark mode
- [ ] No user-facing string uses "spend", "pay", "stake" or "send" for a burn
