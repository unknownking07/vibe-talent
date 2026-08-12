import Image from "next/image";
import Link from "next/link";
import { Fire } from "@phosphor-icons/react/dist/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTokenCount } from "@/lib/token-stats";
import { toWholeVibe } from "@/lib/vibe-balance";

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
  lastAt: string;
};

/**
 * "Backed by" — the public, UNCAPPED record of $VIBE burned behind a builder.
 *
 * The score contribution is capped hard so rank can't be bought; this display
 * deliberately is not, because unbounded conviction is the actual signal a
 * hiring manager wants to see.
 */
export async function BackedBy({ builderId }: { builderId: string }) {
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
    if (rows.length === 0) return null;

    // Aggregate per voucher — someone can back the same builder more than once.
    const byVoucher = new Map<string, { tokens: bigint; usd: number; lastAt: string }>();
    for (const r of rows) {
      const prev = byVoucher.get(r.voucher_id);
      const tokens = BigInt(r.vibe_burned ?? 0);
      const usd = Number(r.usd_at_burn ?? 0);
      byVoucher.set(r.voucher_id, {
        tokens: (prev?.tokens ?? BigInt(0)) + tokens,
        usd: (prev?.usd ?? 0) + usd,
        lastAt: !prev || r.created_at > prev.lastAt ? r.created_at : prev.lastAt,
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
          lastAt: agg.lastAt,
        };
      })
      .filter((b): b is Backer => b !== null)
      .sort((a, b) => b.tokens - a.tokens);

    totalTokens = backers.reduce((s, b) => s + b.tokens, 0);
    totalUsd = backers.reduce((s, b) => s + b.usd, 0);
  } catch {
    // Vouches are additive social proof; never break a profile over them.
    return null;
  }

  if (backers.length === 0) return null;

  return (
    <section className="card-brutal p-5" aria-labelledby="backed-by-heading">
      <div className="flex items-center gap-2">
        <Fire weight="fill" size={18} style={{ color: "var(--accent)" }} />
        <h2
          id="backed-by-heading"
          className="text-sm font-extrabold uppercase tracking-wide text-[var(--foreground)]"
        >
          Backed by {backers.length} {backers.length === 1 ? "builder" : "builders"}
        </h2>
      </div>

      <p className="mt-2 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        <strong className="font-mono text-[var(--foreground)]">
          {formatTokenCount(totalTokens)} $VIBE
        </strong>{" "}
        (~${totalUsd.toFixed(2)}) burned permanently to back this builder.
      </p>

      <ul className="mt-4 space-y-2.5">
        {backers.map((b) => (
          <li key={b.username} className="flex items-center gap-2.5">
            {/* Most production users have no avatar; fall back to an initial
                chip rather than a broken image. */}
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
            <span className="ml-auto font-mono text-xs font-bold" style={{ color: "var(--accent)" }}>
              {formatTokenCount(b.tokens)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
