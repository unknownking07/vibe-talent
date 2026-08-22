import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { SealCheck } from "@phosphor-icons/react/dist/ssr";

import {
  buildBagsBoard,
  buildUnverifiedLaunches,
  type BagsBuilderRow,
  type BagsLaunchRow,
} from "@/lib/bags-board";
import { BagsBuilderRow as BoardRow } from "@/components/bags/bags-builder-row";
import { UnverifiedLaunchRow } from "@/components/bags/unverified-launch-row";
import { BagsAttribution } from "@/components/bags/bags-attribution";
import { BagsMark } from "@/components/bags/bags-mark";
import { BoardViewToggle } from "@/components/bags/board-view-toggle";
import {
  HackathonRoster,
  type RosterEntry,
} from "@/components/bags/hackathon-roster";
import { HACKATHON_PROJECTS } from "@/lib/hackathon-projects";
import { openRunde } from "./fonts";
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

/** How many unverified launches the board renders. The rest are counted, not listed. */
const MAX_UNVERIFIED_SHOWN = 25;

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
/** Columns present on every deployment, migration applied or not. */
const BASE_LAUNCH_COLUMNS = "token_mint, user_id, royalty_bps, first_seen_at";

/** Everything the unclaimed section needs, added by 20260822_bags_unclaimed_launches. */
const FULL_LAUNCH_COLUMNS =
  `${BASE_LAUNCH_COLUMNS}, bags_username, twitter_username, token_name, ` +
  "token_symbol, token_image_url, fdv_usd, volume_24h_usd";

async function fetchAllLaunches(
  sb: ReturnType<typeof getPublicClient>,
): Promise<BagsLaunchRow[] | null> {
  // Migrations here are applied by hand, so there is a window where this code
  // is live and the new columns are not. PostgREST rejects the whole query over
  // one unknown column, which would blank the verified board as well, so a
  // failure retries with the columns that have always existed. Removable once
  // the migration is applied everywhere.
  for (const columns of [FULL_LAUNCH_COLUMNS, BASE_LAUNCH_COLUMNS]) {
    const rows: BagsLaunchRow[] = [];
    let failed = false;

    for (let from = 0; from < MAX_LAUNCHES; from += LAUNCH_PAGE_SIZE) {
      const { data, error } = await sb
        .from("bags_launches")
        .select(columns)
        .order("first_seen_at", { ascending: false })
        .order("token_mint", { ascending: true })
        .range(from, from + LAUNCH_PAGE_SIZE - 1);

      if (error) {
        if (columns === FULL_LAUNCH_COLUMNS) {
          console.warn(
            "bags board: falling back to base columns:",
            error.message,
          );
        }
        failed = true;
        break;
      }
      if (!data?.length) break;

      rows.push(...(data as unknown as BagsLaunchRow[]));
      if (data.length < LAUNCH_PAGE_SIZE) break;
    }

    if (!failed) return rows;
  }

  return null;
}

/** Shape returned when there is nothing to show, so callers never branch on null. */
const EMPTY_BOARD = {
  verified: [] as ReturnType<typeof buildBagsBoard>,
  unverified: [] as ReturnType<typeof buildUnverifiedLaunches>,
};

async function loadBoard() {
  try {
    const sb = getPublicClient();

    const rows = await fetchAllLaunches(sb);

    // A missing table (migration not applied in this environment) must not take
    // the page down: the claim CTA below is useful even with no rows at all.
    if (!rows?.length) return EMPTY_BOARD;

    const userIds = [
      ...new Set(
        rows.map((r) => r.user_id).filter((id): id is string => Boolean(id)),
      ),
    ];

    // Skip the lookup entirely when every launch is unclaimed: `.in()` with an
    // empty list is a query that can only return nothing.
    const { data: builders } = userIds.length
      ? await sb.from("users").select(BUILDER_FIELDS).in("id", userIds)
      : { data: [] };

    const builderRows = (builders as BagsBuilderRow[] | null) ?? [];

    return {
      verified: buildBagsBoard(rows, builderRows),
      unverified: buildUnverifiedLaunches(rows, builderRows),
    };
  } catch {
    return EMPTY_BOARD;
  }
}

/**
 * The hackathon cohort, with each entry matched to a builder where one exists.
 *
 * Matched in memory rather than with an `in` filter: GitHub usernames are
 * case-insensitive and PostgREST's `in` is not, so a builder stored as
 * "IAm25th1" would silently miss a submission owned by "iam25th1". The user
 * table is small and only three columns are read.
 */
async function loadHackathonRoster(): Promise<RosterEntry[]> {
  let builders: {
    username: string;
    github_username: string;
    vibe_score: number | null;
  }[] = [];

  try {
    const sb = getPublicClient();
    const { data } = await sb
      .from("users")
      .select("username, github_username, vibe_score")
      .not("github_username", "is", null)
      .not("username", "is", null);
    builders = (data as typeof builders | null) ?? [];
  } catch {
    // The roster is still worth showing unmatched.
  }

  const byOwner = new Map<string, { username: string; vibeScore: number }>();
  for (const b of builders) {
    if (!b.github_username?.trim()) continue;
    byOwner.set(b.github_username.trim().toLowerCase(), {
      username: b.username,
      vibeScore: b.vibe_score ?? 0,
    });
  }

  return HACKATHON_PROJECTS.map((project) => ({
    project,
    // Winners announced without a repository cannot be matched to anyone.
    builder: project.githubOwner
      ? (byOwner.get(project.githubOwner.toLowerCase()) ?? null)
      : null,
  }));
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
  const [{ verified: board, unverified }, roster] = await Promise.all([
    loadBoard(),
    loadHackathonRoster(),
  ]);
  const matchedHackathon = roster.filter((r) => r.builder).length;
  // Bounded render: the discovery cron adds rows every day, and an unbounded
  // list would grow the page without limit. The full count is still stated.
  const shownUnverified = unverified.slice(0, MAX_UNVERIFIED_SHOWN);
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
    <div className={`bags-theme min-h-screen ${openRunde.variable}`}>
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
            <BagsMark size={30} />
          </div>
          <h1 className="text-4xl font-bold tracking-[-0.035em] text-[var(--bags-text)] sm:text-5xl">
            Who&apos;s behind
            <br />
            the <span style={{ color: "var(--bags-green)" }}>bags</span>?
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--bags-text-muted)]">
            On Bags, a launch is a wallet and an X handle. Neither tells you
            whether that person ships anything. The builders at the top proved
            their launching wallet by signature against a GitHub-verified
            profile, so each of those rows carries a real shipping record. The
            rest are launches we are tracking but cannot vouch for, each
            labelled with exactly how much we know.
          </p>
          <p className="mt-4 text-[12px] text-[var(--bags-text-faint)]">
            Launch data from <BagsAttribution />. VibeTalent is a Bags Hackathon
            project building on the Bags ecosystem.
          </p>
        </header>

        <BoardViewToggle
          launchCount={launchCount + unverified.length}
          hackathonCount={roster.length}
          launches={
            <>
              {/* Inside the panel, not above the toggle: these count launches,
                  and displayed page-wide they read as totals for a view the
                  reader may not be looking at. */}
              <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4">
                <StatChip
                  label={
                    launchCount === 1 ? "verified launch" : "verified launches"
                  }
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
                    Verified builders, ranked by vibe score
                  </h2>
                  <ul className="flex flex-col gap-3">
                    {board.map((entry, i) => (
                      <BoardRow
                        key={entry.username}
                        entry={entry}
                        position={i + 1}
                      />
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
                    signature-linked to a builder profile. Nothing is listed on
                    trust.
                  </p>
                </section>
              )}

              {unverified.length > 0 ? (
                <section className="mt-10" aria-labelledby="unverified-heading">
                  <h2
                    id="unverified-heading"
                    className="bags-label mb-2 text-[11px] font-semibold text-[var(--bags-text-faint)]"
                  >
                    {unverified.length} tracked{" "}
                    {unverified.length === 1 ? "launch" : "launches"}, not
                    verified
                  </h2>
                  <p className="mb-4 max-w-xl text-[13px] leading-relaxed text-[var(--bags-text-muted)]">
                    Busiest first. Each row is labelled with what we actually
                    know: unclaimed means nobody has proved the wallet behind
                    it, and unverified means a VibeTalent profile owns it but
                    has no GitHub-verified record yet. Either way, no claim is
                    being made about the person. If one of them is yours, link
                    the wallet and it moves up.
                  </p>
                  <ul className="flex flex-col gap-2">
                    {shownUnverified.map((launch) => (
                      <UnverifiedLaunchRow key={launch.mint} launch={launch} />
                    ))}
                  </ul>
                  {unverified.length > shownUnverified.length ? (
                    <p className="mt-3 text-[12px] text-[var(--bags-text-faint)]">
                      Showing the {shownUnverified.length} busiest of{" "}
                      {unverified.length} tracked launches.
                    </p>
                  ) : null}
                </section>
              ) : null}
            </>
          }
          hackathon={
            <section aria-labelledby="hackathon-heading">
              <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4">
                <StatChip label="projects tracked" value={roster.length} />
                <StatChip label="on VibeTalent" value={matchedHackathon} />
              </div>
              <h2
                id="hackathon-heading"
                className="bags-label mb-2 text-[11px] font-semibold text-[var(--bags-text-faint)]"
              >
                The Bags Hackathon cohort
              </h2>
              <p className="mb-4 max-w-xl text-[13px] leading-relaxed text-[var(--bags-text-muted)]">
                All {roster.length} entries submitted through DoraHacks, matched
                to a builder wherever a VibeTalent profile is GitHub-verified as
                the owner of the submitted repository. {matchedHackathon} of
                them are. Bags runs its own ranking of hackathon apps
                separately, so this is the submission list rather than every
                project in the programme. A badge here is not a placement, and
                says nothing about any token.
              </p>
              <HackathonRoster entries={roster} />
            </section>
          }
        />

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
            token.
          </p>
        </section>
      </div>
    </div>
  );
}
