import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  ArrowLeft,
  ArrowRight,
  GithubLogo,
  Flame,
  XLogo,
} from "@phosphor-icons/react/dist/ssr";

import { shortMint } from "@/lib/bags-board";
import { fetchCreatorProfile, type BagsCreatorProfile } from "@/lib/bags";
import { assessBuilderTrust } from "@/lib/builder-trust";
import { BuilderTrustCard } from "@/components/bags/builder-trust-card";
import { BagsAttribution } from "@/components/bags/bags-attribution";
import { openRunde } from "../fonts";
import {
  fetchTokenMarket,
  fetchDailyCloses,
  type TokenMarket,
} from "@/lib/token-market";
import { TokenCard } from "@/components/bags/token-card";
import { jsonLdHtml } from "@/lib/json-ld";
import { siteUrl, buildBreadcrumbList } from "@/lib/seo";

// Market data is cached for the same five minutes upstream; matching it here
// keeps the page and its numbers on one clock.
export const revalidate = 300;

/**
 * Cap on how many launches get live market data in one render. Each costs two
 * GeckoTerminal calls, and their free tier is rate-limited per minute; past
 * this the remaining coins still render, just without price or chart.
 */
const MAX_TOKENS_WITH_MARKET = 12;

const BUILDER_FIELDS =
  "id, username, display_name, avatar_url, github_username, vibe_score, streak, longest_streak, lifetime_contributions, created_at";

type Builder = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  github_username: string | null;
  vibe_score: number | null;
  streak: number | null;
  longest_streak: number | null;
  lifetime_contributions: number | null;
  created_at: string;
};

type Launch = {
  token_mint: string;
  creator_wallet: string;
  royalty_bps: number | null;
  first_seen_at: string;
};

function getPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * The builder and their verified launches, or null when either is missing.
 *
 * Wrapped in React's cache so generateMetadata and the page body share one
 * result: without it every request runs the same two queries twice, and this
 * database is egress-bound rather than CPU-bound.
 */
const loadBuilder = cache(
  async (
    username: string,
  ): Promise<{ builder: Builder; launches: Launch[] } | null> => {
    try {
      const sb = getPublicClient();

      const { data: builder } = await sb
        .from("users")
        .select(BUILDER_FIELDS)
        .eq("username", username)
        .maybeSingle();

      if (!builder) return null;

      // Same bar as the board: this page states the builder is GitHub-verified,
      // and wallet linking does not require GitHub. Without a handle there is no
      // verified identity to show, so there is no page.
      if (!(builder as Builder).github_username?.trim()) return null;

      const { data: launches } = await sb
        .from("bags_launches")
        .select("token_mint, creator_wallet, royalty_bps, first_seen_at")
        .eq("user_id", (builder as Builder).id)
        .order("first_seen_at", { ascending: false });

      if (!launches?.length) return null;

      return { builder: builder as Builder, launches: launches as Launch[] };
    } catch {
      return null;
    }
  },
);

/**
 * The two extra reads a trust assessment needs: how much of this builder's work
 * is GitHub-verified, and the score distribution to rank them against.
 *
 * Both fail soft to a zero-evidence assessment, which withholds the rank rather
 * than inventing one.
 */
async function loadTrustInputs(userId: string): Promise<{
  verifiedProjects: number;
  allScores: number[];
}> {
  try {
    const sb = getPublicClient();
    const [projects, scores] = await Promise.all([
      sb
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("verified", true),
      sb.from("users").select("vibe_score"),
    ]);

    return {
      verifiedProjects: projects.count ?? 0,
      allScores: (
        (scores.data as { vibe_score: number | null }[] | null) ?? []
      ).map((row) => row.vibe_score ?? 0),
    };
  } catch {
    return { verifiedProjects: 0, allScores: [] };
  }
}

/** Price, artwork and chart for one launch. Every part of this may be absent. */
async function loadMarket(
  mint: string,
): Promise<{ market: TokenMarket | null; closes: number[] }> {
  const market = await fetchTokenMarket(mint);
  const closes = market?.poolAddress
    ? await fetchDailyCloses(market.poolAddress)
    : [];
  return { market, closes };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const data = await loadBuilder(username);

  if (!data) {
    return {
      title: "Builder not found",
      robots: { index: false, follow: false },
    };
  }

  const count = data.launches.length;
  const title = `@${username}'s Bags launches: ${count} verified ${count === 1 ? "coin" : "coins"}`;
  const description = `Every token @${username} launched on Bags, verified against the Bags creator record for their signature-linked wallet, with live price and their VibeTalent vibe score.`;

  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/bags/${username}` },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/bags/${username}`,
      type: "profile",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function BagsBuilderPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const data = await loadBuilder(username);
  if (!data) notFound();

  const { builder, launches } = data;

  const { verifiedProjects, allScores } = await loadTrustInputs(builder.id);
  const trust = assessBuilderTrust(
    {
      vibeScore: builder.vibe_score ?? 0,
      verifiedProjects,
      lifetimeContributions: builder.lifetime_contributions ?? 0,
      longestStreak: builder.longest_streak ?? 0,
    },
    allScores,
  );

  const enriched = await Promise.all(
    launches.slice(0, MAX_TOKENS_WITH_MARKET).map(async (launch) => ({
      launch,
      ...(await loadMarket(launch.token_mint)),
    })),
  );
  const remaining = launches.slice(MAX_TOKENS_WITH_MARKET).map((launch) => ({
    launch,
    market: null as TokenMarket | null,
    closes: [] as number[],
  }));
  const cards = [...enriched, ...remaining];

  // A builder can relink a different wallet later, and old rows keep the wallet
  // that actually made them. So nothing here may assume one wallet made
  // everything: identity is read from the newest launch's own (mint, wallet)
  // pair, and the footer counts the wallets it really found.
  const creatorWallets = [...new Set(launches.map((l) => l.creator_wallet))];

  // Bags' own record of who this is. Fails soft — the page is about verified
  // launches, and the handle is a nice-to-have on top.
  let creator: BagsCreatorProfile | null = null;
  const firstLaunch = launches[0];
  if (firstLaunch) {
    creator = await fetchCreatorProfile(
      firstLaunch.token_mint,
      firstLaunch.creator_wallet,
    );
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      buildBreadcrumbList([
        { name: "Home", path: "/" },
        { name: "Bags Builders", path: "/bags" },
        { name: `@${builder.username}`, path: `/bags/${builder.username}` },
      ]),
      {
        "@type": "ItemList",
        name: `Bags launches by @${builder.username}`,
        numberOfItems: launches.length,
        itemListElement: launches.slice(0, 25).map((launch, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: launch.token_mint,
          url: `https://bags.fm/${launch.token_mint}`,
        })),
      },
    ],
  };

  return (
    <div className={`bags-theme min-h-screen ${openRunde.variable}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <Link
          href="/bags"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--bags-text-muted)] transition-colors hover:text-[var(--bags-green)]"
        >
          <ArrowLeft size={14} weight="bold" />
          All Bags builders
        </Link>

        <header className="mt-6 flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 items-center gap-4">
            {builder.avatar_url ? (
              <Image
                src={builder.avatar_url}
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 shrink-0 rounded-full object-cover"
                style={{ border: "1px solid var(--bags-border)" }}
              />
            ) : (
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-[var(--bags-bg)]"
                style={{ backgroundColor: "var(--bags-green)" }}
              >
                {builder.username[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-bold tracking-[-0.03em] text-[var(--bags-text)]">
                @{builder.username}
              </h1>
              {builder.display_name ? (
                <p className="mt-0.5 truncate text-sm text-[var(--bags-text-muted)]">
                  {builder.display_name}
                </p>
              ) : null}
            </div>
          </div>

          <div className="text-right">
            <div
              className="font-mono text-4xl font-extrabold leading-none tracking-[-0.03em]"
              style={{ color: "var(--bags-green)" }}
            >
              {builder.vibe_score ?? 0}
            </div>
            <div className="bags-label mt-1.5 text-[10px] font-semibold text-[var(--bags-text-faint)]">
              vibe score
            </div>
          </div>
        </header>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-[var(--bags-text-muted)]">
          {builder.github_username ? (
            <span className="inline-flex items-center gap-1.5">
              <GithubLogo size={14} weight="fill" />
              {builder.github_username}
            </span>
          ) : null}
          {builder.streak ? (
            <span className="inline-flex items-center gap-1.5">
              <Flame size={14} weight="fill" />
              {builder.streak}-day streak
            </span>
          ) : null}
          {creator?.twitterUsername ? (
            <span className="inline-flex items-center gap-1.5">
              <XLogo size={13} weight="fill" />
              {creator.twitterUsername}
            </span>
          ) : null}
          {creator?.bagsUsername ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="bags-label text-[10px] font-semibold text-[var(--bags-text-faint)]">
                bags
              </span>
              {creator.bagsUsername}
            </span>
          ) : null}
        </div>

        <BuilderTrustCard
          trust={trust}
          verifiedProjects={verifiedProjects}
          lifetimeContributions={builder.lifetime_contributions ?? 0}
          longestStreak={builder.longest_streak ?? 0}
          memberSince={builder.created_at}
        />

        <Link
          href={`/profile/${builder.username}`}
          className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-opacity hover:opacity-85"
          style={{
            backgroundColor: "var(--bags-green)",
            color: "var(--bags-bg)",
          }}
        >
          view full profile
          <ArrowRight size={14} weight="bold" />
        </Link>

        <section className="mt-10" aria-labelledby="launches-heading">
          <h2
            id="launches-heading"
            className="bags-label mb-4 text-[11px] font-semibold text-[var(--bags-text-faint)]"
          >
            {launches.length} verified{" "}
            {launches.length === 1 ? "launch" : "launches"}
          </h2>
          <ul className="flex flex-col gap-4">
            {cards.map(({ launch, market, closes }) => (
              <TokenCard
                key={launch.token_mint}
                mint={launch.token_mint}
                royaltyBps={launch.royalty_bps}
                market={market}
                closes={closes}
              />
            ))}
          </ul>
        </section>

        <p className="mt-8 text-xs leading-relaxed text-[var(--bags-text-faint)]">
          {creatorWallets.length === 1 ? (
            <>
              Launched from{" "}
              <span className="font-mono text-[var(--bags-text-muted)]">
                {shortMint(creatorWallets[0]!)}
              </span>
              , a wallet bound to this profile by signature.
            </>
          ) : (
            <>
              Launched from {creatorWallets.length} wallets bound to this
              profile by signature over time.
            </>
          )}{" "}
          Each coin is confirmed against the Bags creator record for the wallet
          that made it. Prices and charts come from GeckoTerminal and are
          indicative only. Nothing here is financial advice or an endorsement of
          any token. Launch data from <BagsAttribution />, which VibeTalent is
          not affiliated with.
        </p>
      </div>
    </div>
  );
}
