import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";

import { shortMint, type UnverifiedLaunch } from "@/lib/bags-board";
import {
  sanitizeDisplayText,
  sanitizeSymbol,
  sanitizeImageUrl,
} from "@/lib/safe-text";
import { formatTokenCount } from "@/lib/token-stats";

/**
 * A launch the board lists without vouching for whoever made it.
 *
 * EVERY untrusted string is sanitised here rather than upstream, so no future
 * caller can route around it: names and tickers come straight from whoever
 * minted the token, and the board is the one page where a reversed or padded
 * string would do real damage.
 *
 * The styling is deliberately quieter than a verified row and never uses the
 * green reserved for verification. Someone scanning this page must not be able
 * to mistake "we could not check this" for "we checked this".
 */
export function UnverifiedLaunchRow({ launch }: { launch: UnverifiedLaunch }) {
  const name = sanitizeDisplayText(launch.name);
  const symbol = sanitizeSymbol(launch.symbol);
  const imageUrl = sanitizeImageUrl(launch.imageUrl);
  const bagsHandle = sanitizeDisplayText(launch.bagsUsername, 20);
  const twitterHandle = sanitizeDisplayText(launch.twitterUsername, 20);
  const creatorHandle = bagsHandle ?? twitterHandle;

  const claimed = launch.profileUsername !== null;

  return (
    <li
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl p-4"
      style={{
        backgroundColor: "var(--bags-surface)",
        border: "1px solid var(--bags-border)",
      }}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 rounded-full object-cover"
          style={{ border: "1px solid var(--bags-border)" }}
        />
      ) : (
        <div
          className="h-9 w-9 shrink-0 rounded-full"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.06)" }}
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[14px] font-bold text-[var(--bags-text)]">
            {name ?? shortMint(launch.mint)}
          </span>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]"
            style={
              claimed
                ? {
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    color: "var(--bags-text-muted)",
                  }
                : {
                    backgroundColor: "rgba(255, 200, 0, 0.14)",
                    color: "#ffc800",
                  }
            }
          >
            {claimed ? "unverified" : "unclaimed"}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--bags-text-muted)]">
          {symbol ? <span className="font-mono">${symbol}</span> : null}
          {creatorHandle ? <span>by {creatorHandle}</span> : null}
          {launch.volume24hUsd ? (
            <span>${formatTokenCount(launch.volume24hUsd)} 24h vol</span>
          ) : null}
          {launch.fdvUsd ? (
            <span>${formatTokenCount(launch.fdvUsd)} fdv</span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {claimed ? (
          <Link
            href={`/profile/${launch.profileUsername}`}
            className="text-[11px] font-bold text-[var(--bags-text-muted)] transition-colors hover:text-[var(--bags-text)]"
          >
            @{launch.profileUsername}
          </Link>
        ) : (
          <Link
            href="/settings#wallet"
            className="text-[11px] font-bold text-[var(--bags-text-muted)] transition-colors hover:text-[var(--bags-green)]"
          >
            is this you?
          </Link>
        )}

        <a
          href={`https://bags.fm/${launch.mint}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View ${name ?? shortMint(launch.mint)} on Bags (opens in new tab)`}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold text-[var(--bags-text-muted)] transition-colors hover:text-[var(--bags-text)]"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.06)" }}
        >
          {shortMint(launch.mint)}
          <ArrowUpRight size={10} weight="bold" />
        </a>
      </div>
    </li>
  );
}
