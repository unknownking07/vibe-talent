import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { BagSimple, SealCheck } from "@phosphor-icons/react/dist/ssr";

import {
  buildBagsBoard,
  type BagsBuilderRow,
  type BagsLaunchRow,
} from "@/lib/bags-board";
import { BagsBuilderRow as BoardRow } from "@/components/bags/bags-builder-row";
import { jsonLdHtml } from "@/lib/json-ld";
import { siteUrl, buildBreadcrumbList } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Bags Builders: Verified Token Launches by Vibe Coders",
  description:
    "Every Bags launch on VibeTalent, matched to the builder behind it. See who launched a token, how many they have shipped, and the vibe score their GitHub-verified building record earned them.",
  alternates: { canonical: `${siteUrl}/bags` },
  openGraph: {
    title: "Bags Builders: Verified Token Launches by Vibe Coders",
    description:
      "Who is actually behind these token launches? Bags launches matched to GitHub-verified builders and their vibe scores.",
    url: `${siteUrl}/bags`,
    siteName: "VibeTalent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bags Builders: Verified Token Launches by Vibe Coders",
    description:
      "Who is actually behind these token launches? Bags launches matched to GitHub-verified builders and their vibe scores.",
  },
};

// The board only changes when the daily bags-sync cron writes to the table, so
// an hour of staleness costs nothing and keeps this page off the ISR treadmill.
export const revalidate = 3600;

/** PostgREST caps a response anyway; this is the page size we read in. */
const LAUNCH_PAGE_SIZE = 1000;

/**
 * Absolute ceiling on rows read for one board render, so a runaway table cannot
 * hang the page. Truncating BELOW this would be worse than a slow page: the
 * board groups and ranks after reading, so a cut-off read silently drops whole
 * builders and understates the launch counts of the ones that survive.
 */
const MAX_LAUNCHES = 20_000;

const BUILDER_FIELDS =
  "id, username, display_name, avatar_url, github_username, vibe_score, streak";

/** Cookie-free client: both tables read publicly, and there is no viewer context here. */
function getPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * Every cached launch, read in pages.
 *
 * Ordered by token_mint as well as time so page boundaries stay deterministic
 * when rows share a first_seen_at, which they do whenever one sync writes
 * several launches at once.
 */
async function fetchAllLaunches(
  sb: ReturnType<typeof getPublicClient>,
): Promise<BagsLaunchRow[] | null> {
  const rows: BagsLaunchRow[] = [];

  for (let from = 0; from < MAX_LAUNCHES; from += LAUNCH_PAGE_SIZE) {
    const { data, error } = await sb
      .from("bags_launches")
      .select("token_mint, user_id, royalty_bps, first_seen_at")
      .order("first_seen_at", { ascending: false })
      .order("token_mint", { ascending: true })
      .range(from, from + LAUNCH_PAGE_SIZE - 1);

    if (error) return null;
    if (!data?.length) break;

    rows.push(...(data as BagsLaunchRow[]));
    if (data.length < LAUNCH_PAGE_SIZE) break;
  }

  return rows;
}

async function loadBoard() {
  try {
    const sb = getPublicClient();

    const rows = await fetchAllLaunches(sb);

    // A missing table (migration not applied in this environment) must not take
    // the page down: the claim CTA below is useful even with no rows at all.
    if (!rows?.length) return [];

    const userIds = [...new Set(rows.map((r) => r.user_id))];

    const { data: builders } = await sb
      .from("users")
      .select(BUILDER_FIELDS)
      .in("id", userIds);

    return buildBagsBoard(rows, (builders as BagsBuilderRow[] | null) ?? []);
  } catch {
    return [];
  }
}

/** Bags' own stat treatment: a small dimmed label over a big value. */
function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{
        backgroundColor: "var(--bags-surface)",
        border: "1px solid var(--bags-border)",
      }}
    >
      <div className="bags-label text-[10px] font-semibold text-[var(--bags-text-faint)]">
        {label}
      </div>
      <div className="mt-1.5 font-mono text-3xl font-extrabold tracking-[-0.03em] text-[var(--bags-text)]">
        {value}
      </div>
    </div>
  );
}

export default async function BagsPage() {
  const board = await loadBoard();
  const launchCount = board.reduce((sum, entry) => sum + entry.launchCount, 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      buildBreadcrumbList([
        { name: "Home", path: "/" },
        { name: "Bags Builders", path: "/bags" },
      ]),
      {
        "@type": "ItemList",
        name: "Bags launches by VibeTalent builders",
        description:
          "Builders with a cryptographically linked Solana wallet that Bags confirms as the creator of a token launch, ranked by vibe score.",
        numberOfItems: board.length,
        itemListElement: board.slice(0, 25).map((entry, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: entry.username,
          url: `${siteUrl}/bags/${entry.username}`,
        })),
      },
    ],
  };

  return (
    <div className="bags-theme min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />

      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
        <header className="mb-10">
          <div
            className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "var(--bags-green-soft)" }}
          >
            <BagSimple
              weight="fill"
              size={28}
              style={{ color: "var(--bags-green)" }}
            />
          </div>
          <h1 className="text-4xl font-bold tracking-[-0.035em] text-[var(--bags-text)] sm:text-5xl">
            Who&apos;s behind
            <br />
            the <span style={{ color: "var(--bags-green)" }}>bags</span>?
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--bags-text-muted)]">
            On Bags, a launch is a wallet and an X handle. Neither tells you
            whether that person ships anything. These builders linked their
            launching wallet to a GitHub-verified VibeTalent profile, so every
            row carries a real shipping record: projects, streaks, and a vibe
            score earned from work rather than from minting.
          </p>
        </header>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4">
          <StatChip
            label={launchCount === 1 ? "verified launch" : "verified launches"}
            value={launchCount}
          />
          <StatChip
            label={board.length === 1 ? "builder" : "builders"}
            value={board.length}
          />
        </div>

        {board.length > 0 ? (
          <section aria-labelledby="board-heading">
            <h2
              id="board-heading"
              className="bags-label mb-3 text-[11px] font-semibold text-[var(--bags-text-faint)]"
            >
              Ranked by vibe score
            </h2>
            <ul className="flex flex-col gap-3">
              {board.map((entry, i) => (
                <BoardRow key={entry.username} entry={entry} position={i + 1} />
              ))}
            </ul>
          </section>
        ) : (
          <section
            className="rounded-[20px] p-10 text-center"
            style={{
              backgroundColor: "var(--bags-surface)",
              border: "1px solid var(--bags-border)",
            }}
          >
            <h2 className="text-lg font-bold tracking-[-0.02em] text-[var(--bags-text)]">
              No verified launches yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--bags-text-muted)]">
              A launch only appears here once its wallet has been
              signature-linked to a builder profile. Nothing is listed on trust.
            </p>
          </section>
        )}

        <section
          className="mt-10 rounded-[20px] p-6 sm:p-8"
          style={{
            backgroundColor: "var(--bags-surface)",
            border: "1px solid var(--bags-border)",
          }}
        >
          <div className="flex items-start gap-3">
            <SealCheck
              weight="fill"
              size={22}
              className="mt-0.5 shrink-0"
              style={{ color: "var(--bags-green)" }}
            />
            <div>
              <h2 className="text-lg font-bold tracking-[-0.02em] text-[var(--bags-text)]">
                Launched on Bags? Claim it
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--bags-text-muted)]">
                Link the wallet you launched from and your tokens show up here
                and on your profile. Linking takes a signature in your wallet —
                no transaction, no fee, and no permission to move anything.
              </p>
              <Link
                href="/settings#wallet"
                className="mt-5 inline-flex items-center rounded-xl px-6 py-3 text-sm font-bold transition-opacity hover:opacity-85"
                style={{
                  backgroundColor: "var(--bags-green)",
                  color: "var(--bags-bg)",
                }}
              >
                link your wallet
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="bags-label text-[11px] font-semibold text-[var(--bags-text-faint)]">
            How a row gets here
          </h2>
          <ol className="mt-4 flex flex-col gap-4">
            {[
              {
                title: "The builder proves the wallet.",
                body: "Linking requires signing a server-issued nonce, so only the keyholder can bind a wallet to a profile.",
              },
              {
                title: "Bags confirms the launch.",
                body: "Holding fee-share authority over a token is not the same as having launched it, so every mint is checked against the Bags creator record and only confirmed creators count.",
              },
              {
                title: "The score comes from GitHub.",
                body: "Vibe score is earned from verified projects, commit streaks and endorsements — it is unaffected by anything token-related.",
              },
            ].map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span
                  className="mt-0.5 shrink-0 font-mono text-sm font-bold"
                  style={{ color: "var(--bags-green)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-sm leading-relaxed text-[var(--bags-text-muted)]">
                  <strong className="font-bold text-[var(--bags-text)]">
                    {step.title}
                  </strong>{" "}
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs leading-relaxed text-[var(--bags-text-faint)]">
            Self-reported X handles are never used to match a launch to a
            builder. Nothing here is financial advice or an endorsement of any
            token. VibeTalent is not affiliated with Bags.
          </p>
        </section>
      </div>
    </div>
  );
}
