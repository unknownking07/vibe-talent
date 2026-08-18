import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Fire } from "@phosphor-icons/react/dist/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTokenCount } from "@/lib/token-stats";
import { toWholeVibe } from "@/lib/vibe-balance";
import { VOUCH } from "@/lib/vibe-config";

// ~60 web3 chunks — only pulled in when the vouch action is actually shown.
const VouchButton = dynamic(() =>
  import("@/components/token/vouch-button").then((m) => ({ default: m.VouchButton })),
);

type VouchRow = {
  voucher_id: string;
  vibe_burned: string | number;
  usd_at_burn: string | number;
  created_at: string;
};

type Backer = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  tokens: number;
  usd: number;
};

export type BackedByViewer = { id: string; vibeScore: number } | null;

/**
 * "Backed by" — the public, UNCAPPED record of $VIBE burned behind a builder.
 *
 * The score contribution is capped hard so rank can't be bought; this display
 * deliberately is not, because unbounded conviction is the signal a hiring
 * manager actually wants.
 *
 * Always renders when a viewer could vouch, even with zero backers — otherwise
 * the feature is unreachable on a platform where nobody has vouched yet.
 */
export async function BackedBy({
  builderId,
  builderUsername,
  viewer,
}: {
  builderId: string;
  builderUsername: string;
  viewer: BackedByViewer;
}) {
  let backers: Backer[] = [];
  let totalTokens = 0;
  let totalUsd = 0;

  try {
    const sb = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb as any)
      .from("vouches")
      .select("voucher_id, vibe_burned, usd_at_burn, created_at")
      .eq("builder_id", builderId);

    const rows = (data ?? []) as VouchRow[];

    if (rows.length > 0) {
      // Aggregate per voucher — someone can back the same builder more than once.
      const byVoucher = new Map<string, { tokens: bigint; usd: number }>();
      for (const r of rows) {
        const prev = byVoucher.get(r.voucher_id);
        byVoucher.set(r.voucher_id, {
          tokens: (prev?.tokens ?? BigInt(0)) + BigInt(r.vibe_burned ?? 0),
          usd: (prev?.usd ?? 0) + Number(r.usd_at_burn ?? 0),
        });
      }

      const { data: users } = await sb
        .from("users")
        .select("id, username, display_name, avatar_url")
        .in("id", [...byVoucher.keys()]);

      const userMap = new Map(
        ((users ?? []) as Array<{
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
        }>).map((u) => [u.id, u]),
      );

      backers = [...byVoucher.entries()]
        .map(([id, agg]) => {
          const u = userMap.get(id);
          if (!u) return null;
          return {
            username: u.username,
            displayName: u.display_name,
            avatarUrl: u.avatar_url,
            tokens: toWholeVibe(agg.tokens),
            usd: agg.usd,
          };
        })
        .filter((b): b is Backer => b !== null)
        .sort((a, b) => b.tokens - a.tokens);

      totalTokens = backers.reduce((s, b) => s + b.tokens, 0);
      totalUsd = backers.reduce((s, b) => s + b.usd, 0);
    }
  } catch {
    // Vouches are additive social proof; never break a profile over them.
  }

  // Nobody can vouch for themselves, so the owner sees the block only once it
  // has content worth showing.
  const canVouch = viewer !== null && viewer.id !== builderId;
  if (backers.length === 0 && !canVouch) return null;

  return (
    <section className="card-brutal p-5" aria-labelledby="backed-by-heading">
      <div className="flex items-center gap-2">
        <Fire weight="fill" size={18} style={{ color: "var(--accent)" }} />
        <h2
          id="backed-by-heading"
          className="text-sm font-extrabold uppercase tracking-wide text-[var(--foreground)]"
        >
          {backers.length > 0
            ? `Backed by ${backers.length} ${backers.length === 1 ? "builder" : "builders"}`
            : "Back this builder"}
        </h2>
      </div>

      {backers.length > 0 ? (
        <>
          <p className="mt-2 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            <strong className="font-mono text-[var(--foreground)]">
              {formatTokenCount(totalTokens)} $VIBE
            </strong>{" "}
            (~${totalUsd.toFixed(2)}) burned permanently to back this builder.
          </p>

          <ul className="mt-4 space-y-2.5">
            {backers.map((b) => (
              <li key={b.username} className="flex items-center gap-2.5">
                {/* Most production users have no avatar; fall back to an
                    initial chip rather than a broken image. */}
                {b.avatarUrl ? (
                  <Image
                    src={b.avatarUrl}
                    alt=""
                    width={28}
                    height={28}
                    className="rounded-full object-cover shrink-0"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold"
                    style={{ backgroundColor: "var(--bg-pill)", color: "var(--text-secondary)" }}
                  >
                    {(b.displayName || b.username).charAt(0).toUpperCase()}
                  </span>
                )}
                <Link
                  href={`/profile/${b.username}`}
                  className="text-xs font-bold hover:underline text-[var(--foreground)]"
                >
                  @{b.username}
                </Link>
                <span
                  className="ml-auto font-mono text-xs font-bold"
                  style={{ color: "var(--accent)" }}
                >
                  {formatTokenCount(b.tokens)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Nobody has backed @{builderUsername} yet. Burn $VIBE to put real conviction behind them —
          your name and the amount show here permanently. From ${VOUCH.minUsd}.
        </p>
      )}

      {canVouch && (
        <div className="mt-4">
          <VouchButton
            viewerId={viewer!.id}
            viewerVibeScore={viewer!.vibeScore}
            builderUsername={builderUsername}
            builderId={builderId}
          />
        </div>
      )}
    </section>
  );
}
