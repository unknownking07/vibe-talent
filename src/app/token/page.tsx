import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Fire, Shield, TrendUp } from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { jsonLdHtml } from "@/lib/json-ld";
import { siteUrl } from "@/lib/seo";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTokenStats, formatTokenCount, formatTokenPrice } from "@/lib/token-stats";
import {
  VIBE_MINT,
  VIBE_BUY_URL,
  VIBE_CHART_URL,
  VIBE_EXPLORER_URL,
  HOLDER_TIERS,
  BASE_FREEZES,
  VOUCH,
  STREAK_PROTECT,
} from "@/lib/vibe-config";
import { CopyAddress } from "@/components/token/copy-address";

// Live-ish, not per-request. Matches the pricing cache and keeps this page off
// the ISR revalidation hot path.
export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: "$VIBE Token: Burn to Vouch, Protect Your Streak | VibeTalent" },
  description:
    `$VIBE is VibeTalent's token on Solana (CA: ${VIBE_MINT}). Burn $VIBE to vouch for a builder and add verifiable trust to their profile, or to restore a broken coding streak. Hold $VIBE for extra free streak freezes every month. Every burn permanently destroys supply.`,
  keywords: [
    "$VIBE token",
    "VIBE token contract address",
    "VibeTalent token",
    "burn to vouch",
    "Solana developer token",
    "stake to vouch builders",
    "buy $VIBE",
  ],
  alternates: { canonical: `${siteUrl}/token` },
  openGraph: {
    title: "$VIBE Token: Burn to Vouch",
    description:
      "Burn $VIBE to vouch for builders or bring back a broken streak. Hold $VIBE for free streak freezes. Live on Solana.",
    url: `${siteUrl}/token`,
    siteName: "VibeTalent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "$VIBE Token: Burn to Vouch",
    description:
      "Burn $VIBE to back builders. Hold it for free streak freezes. Live on Solana.",
  },
};

/**
 * Total destroyed across both burn flows. Returns zeroes if the tables don't
 * exist yet — this page ships ahead of the migration and must still render.
 */
async function fetchBurnTotals(): Promise<{ baseUnits: bigint; usd: number }> {
  try {
    const sb = createAdminClient();
    const [vouches, protects] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sb as any).from("vouches").select("vibe_burned, usd_at_burn"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sb as any).from("streak_protects").select("vibe_burned, usd_at_burn"),
    ]);
    const rows = [...(vouches.data ?? []), ...(protects.data ?? [])] as Array<{
      vibe_burned: string | number;
      usd_at_burn: string | number;
    }>;
    return {
      baseUnits: rows.reduce((acc, r) => acc + BigInt(r.vibe_burned ?? 0), BigInt(0)),
      usd: rows.reduce((acc, r) => acc + Number(r.usd_at_burn ?? 0), 0),
    };
  } catch {
    return { baseUnits: BigInt(0), usd: 0 };
  }
}

export default async function TokenPage() {
  const burns = await fetchBurnTotals();
  const stats = await getTokenStats(burns.baseUnits, burns.usd);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "$VIBE Token", item: `${siteUrl}/token` },
    ],
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is the $VIBE contract address?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `$VIBE is live on Solana at contract address ${VIBE_MINT}. It has 9 decimals and trades on Bags. It is not routable on Jupiter, so buy it through Bags directly.`,
        },
      },
      {
        "@type": "Question",
        name: "How do I buy $VIBE?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Buy $VIBE with SOL or USDC on Solana through Bags at ${VIBE_BUY_URL}. Connect a Solana wallet such as Phantom, Solflare or Backpack, then swap SOL or USDC for $VIBE. $VIBE is not listed on Jupiter, so it cannot be swapped through Jupiter-based aggregators.`,
        },
      },
      {
        "@type": "Question",
        name: "What is $VIBE used for?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `$VIBE has three uses on VibeTalent. Burn it to vouch for a builder, which shows publicly on their profile and adds up to ${VOUCH.perProfileCapPoints} points to their vibe score. Burn it to restore a coding streak you broke. Hold it to earn extra free streak freezes every month. Burning permanently destroys the tokens. Nobody receives them.`,
        },
      },
      {
        "@type": "Question",
        name: "What does burning $VIBE mean?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Burning permanently destroys tokens and removes them from the total supply. They are not sent to VibeTalent, and not sent to the builder being vouched for. Nobody receives them. A burn cannot be undone, reversed or refunded, and every burn is a Solana transaction you can verify yourself on Solscan.",
        },
      },
    ],
  };

  // The root layout already wraps children in <main>, so this page must not
  // render another one: nested <main> is invalid HTML and left this whole
  // subtree unhydrated, which silently broke the copy button. Root element
  // and spacing match roadmap/about/pricing.
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqLd) }} />

      {/* Hero */}
      <h1 className="text-4xl sm:text-5xl font-extrabold uppercase leading-none tracking-tight">
        <span className="block text-[var(--foreground)]">$VIBE</span>
        <span className="block" style={{ color: "var(--accent)" }}>
          Burn to Back Builders
        </span>
      </h1>
      <p className="mt-4 text-sm sm:text-base font-medium leading-relaxed max-w-2xl" style={{ color: "var(--text-secondary)" }}>
        $VIBE is VibeTalent&apos;s token on Solana. Burn it to vouch for a builder you rate, or to
        bring back a streak you broke. Hold it and your free streak freezes go up every month.
        Every burn destroys supply permanently.
      </p>

      {/* Contract address + buy */}
      <section className="mt-8" aria-labelledby="ca-heading">
        <h2
          id="ca-heading"
          className="text-[10px] font-bold uppercase tracking-wider mb-2"
          style={{ color: "var(--text-muted)" }}
        >
          Contract Address (Solana)
        </h2>
        <CopyAddress address={VIBE_MINT} />

        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={VIBE_BUY_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Buy $VIBE on Bags (opens in new tab)"
            className="btn-brutal btn-brutal-primary btn-notched text-sm flex items-center gap-2"
          >
            Buy $VIBE on Bags <ExternalLink size={14} aria-hidden="true" />
          </a>
          <a
            href={VIBE_CHART_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="$VIBE chart on DexScreener (opens in new tab)"
            className="btn-brutal text-sm flex items-center gap-2"
          >
            Chart <ExternalLink size={14} aria-hidden="true" />
          </a>
          <a
            href={VIBE_EXPLORER_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="$VIBE on Solscan (opens in new tab)"
            className="btn-brutal text-sm flex items-center gap-2"
          >
            Solscan <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>

        <p className="mt-2.5 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Buy with SOL or USDC on Solana. $VIBE trades on a Bags bonding curve and isn&apos;t
          routable on Jupiter, so use the link above.
        </p>
      </section>

      {/* Live stats */}
      <section className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3" aria-label="Token statistics">
        <Stat label="Price" value={stats.priceUsd != null ? formatTokenPrice(stats.priceUsd): ": "} />
        <Stat
          label="Market Cap"
          value={
            stats.marketCapUsd != null
              ? `$${Math.round(stats.marketCapUsd).toLocaleString("en-US")}`
: ": "
          }
        />
        <Stat label="Supply" value={stats.supply != null ? formatTokenCount(stats.supply): ": "} />
        <Stat label="Burned Forever" value={formatTokenCount(stats.burnedTotal)} accent />
      </section>

      {/* Utility */}
      <section className="mt-12" aria-labelledby="utility-heading">
        <h2 id="utility-heading" className="text-2xl font-extrabold uppercase text-[var(--foreground)] mb-4">
          What $VIBE Does
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          <UtilityCard
            icon={Fire}
            title="Burn to Vouch"
            text={`Put $VIBE behind a builder you rate. Your name and the amount show publicly on their profile, and it adds up to ${VOUCH.perProfileCapPoints} points to their vibe score. From $${VOUCH.minUsd}.`}
          />
          <UtilityCard
            icon={Shield}
            title="Burn to Protect"
            text={`Broke a streak? Burn about $${STREAK_PROTECT.usdPrice} of $VIBE within ${STREAK_PROTECT.graceHours} hours to bring it back. Protected days stay marked on your heatmap.`}
          />
          <UtilityCard
            icon={TrendUp}
            title="Hold for Freezes"
            text={`Every builder gets ${BASE_FREEZES} free streak freezes a month. Hold $VIBE and that goes up, no burning needed.`}
          />
        </div>
      </section>

      {/* Holder tiers */}
      <section className="mt-12" aria-labelledby="tiers-heading">
        <h2 id="tiers-heading" className="text-2xl font-extrabold uppercase text-[var(--foreground)] mb-4">
          Holder Tiers
        </h2>
        <div className="card-brutal overflow-hidden">
          <TierRow tier="No holding" hold="$0" freezes={BASE_FREEZES} />
          {[...HOLDER_TIERS].reverse().map((t) => (
            <TierRow key={t.key} tier={t.label} hold={`$${t.minUsd}+`} freezes={t.freezes} />
          ))}
        </div>
        <p className="mt-3 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Your tier is checked on the 1st of each month when freezes are granted, and holds for the
          whole month whatever the price does after. Link a Solana wallet in{" "}
          <Link href="/settings" className="underline underline-offset-2" style={{ color: "var(--accent)" }}>
            Settings
          </Link>{" "}
          to qualify.
        </p>
      </section>

      {/* Burn explainer */}
      <section className="card-brutal mt-12 p-5" aria-labelledby="burn-heading">
        <h2 id="burn-heading" className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-2">
          What burning means
        </h2>
        <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {/* Explicit {" "} after each <strong>: JSX drops the leading space of a
              text node in this position, which rendered "notsent to the builder". */}
          Burning permanently destroys tokens. They are{" "}
          <strong className="text-[var(--foreground)]">not</strong>{" "}
          sent to VibeTalent, and{" "}
          <strong className="text-[var(--foreground)]">not</strong>{" "}
          sent to the builder you&apos;re backing. Nobody receives them. They&apos;re removed from
          the total supply and can&apos;t be recovered. Every burn is a Solana transaction you can
          check yourself on Solscan.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card-brutal p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div
        className="mt-1 font-mono text-sm font-extrabold break-all"
        style={{ color: accent ? "var(--accent)" : "var(--foreground)" }}
      >
        {value}
      </div>
    </div>
  );
}

function UtilityCard({
  icon: Icon,
  title,
  text,
}: {
  icon: PhosphorIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="card-brutal p-5" style={{ backgroundColor: "var(--bg-surface)" }}>
      <Icon weight="fill" size={20} style={{ color: "var(--accent)" }} />
      <h3 className="mt-3 text-base font-extrabold uppercase text-[var(--foreground)]">{title}</h3>
      <p className="mt-2 text-xs font-medium leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {text}
      </p>
    </div>
  );
}

function TierRow({ tier, hold, freezes }: { tier: string; hold: string; freezes: number }) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      <span className="text-xs font-extrabold uppercase text-[var(--foreground)]">{tier}</span>
      <span className="font-mono text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
        {hold}
      </span>
      <span className="font-mono text-xs font-bold text-right" style={{ color: "var(--accent)" }}>
        {freezes} freezes/mo
      </span>
    </div>
  );
}
