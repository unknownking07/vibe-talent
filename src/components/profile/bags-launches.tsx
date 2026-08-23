import { Rocket, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

type LaunchRow = {
  token_mint: string;
  twitter_username: string | null;
  royalty_bps: number | null;
  first_seen_at: string;
};

/**
 * "Launched on Bags" — tokens this builder verifiably created.
 *
 * The point of the section is the pairing: a GitHub-verified shipping record
 * sitting next to a real token launch. On Bags a launch is a wallet and an X
 * handle, neither of which shows whether that person actually builds. This does.
 *
 * Reads the cached table only, never Bags directly, so an upstream outage
 * cannot slow or break a profile. Renders nothing when the builder has no
 * launches — an empty "no launches" card would imply a shortcoming on a
 * platform where most builders have never launched a token at all.
 */
export async function BagsLaunches({ builderId }: { builderId: string }) {
  let launches: LaunchRow[] = [];

  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from("bags_launches")
      .select("token_mint, twitter_username, royalty_bps, first_seen_at")
      .eq("user_id", builderId)
      .order("first_seen_at", { ascending: false });
    launches = (data as LaunchRow[] | null) ?? [];
  } catch {
    // The table may not exist yet in an environment where the migration has
    // not been applied. A profile must still render.
    return null;
  }

  if (launches.length === 0) return null;

  return (
    <section
      className="card-brutal p-5"
      aria-labelledby="bags-launches-heading"
    >
      <div className="flex items-center gap-2">
        <Rocket weight="fill" size={18} style={{ color: "var(--accent)" }} />
        <h2
          id="bags-launches-heading"
          className="text-sm font-extrabold uppercase tracking-wide text-[var(--foreground)]"
        >
          {launches.length === 1
            ? "Launched on Bags"
            : `${launches.length} launches on Bags`}
        </h2>
      </div>

      <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
        Verified against the Bags creator record for this builder&apos;s linked
        wallet.
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {launches.map((launch) => (
          <li key={launch.token_mint}>
            <a
              href={`https://bags.fm/${launch.token_mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-[var(--bg-surface-light)]"
              style={{ border: "1px solid var(--border-subtle)" }}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-mono text-xs font-bold text-[var(--foreground)]">
                  {launch.token_mint.slice(0, 6)}…{launch.token_mint.slice(-4)}
                </span>
                {launch.royalty_bps ? (
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {launch.royalty_bps / 100}% creator fee share
                  </span>
                ) : null}
              </span>
              <ArrowSquareOut
                size={14}
                className="shrink-0 text-[var(--text-muted)]"
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
