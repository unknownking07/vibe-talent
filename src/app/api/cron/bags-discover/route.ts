import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bagsConfigured, fetchTokenCreators } from "@/lib/bags";
import { fetchBagsDexPools } from "@/lib/token-market";

/**
 * Cron job: discover Bags launches we have no wallet for.
 *
 * bags-sync answers "what did our builders launch". This answers the opposite
 * question, "who is launching on Bags that we do not know yet", so a launcher
 * can find their own coin sitting unclaimed and has a reason to link a wallet.
 *
 * The pairing that matters: a row written here has user_id NULL, and NOTHING
 * here may set it from anything a launcher controls. It is set only when the
 * creator wallet Bags reports already belongs to a signature-verified profile,
 * which means the builder proved that wallet before this job ever ran.
 *
 * Protected by CRON_SECRET.
 */

/** Pages of twenty. Three keeps the run near sixty Bags calls. */
const PAGES = 3;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  // Fail closed: this writes the table backing a public credibility claim.
  if (!cronSecret && process.env.NODE_ENV === "production") {
    console.error("CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Cron secret not configured" },
      { status: 500 },
    );
  }
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!bagsConfigured()) {
    return NextResponse.json({ skipped: "BAGS_API_KEY not configured" });
  }

  const sb = createAdminClient();

  // Every wallet a builder has actually proved. A launch is only ever attributed
  // through this map, never through a handle or anything else self-reported.
  const { data: verified, error: verifiedError } = await sb
    .from("users")
    .select("id, solana_wallet")
    .not("solana_wallet", "is", null)
    .not("solana_wallet_verified_at", "is", null);

  if (verifiedError) {
    console.error(
      "bags-discover: failed to load verified wallets:",
      verifiedError.message,
    );
    return NextResponse.json(
      { error: "Failed to load wallets" },
      { status: 500 },
    );
  }

  const walletToUser = new Map<string, string>();
  for (const row of (verified ?? []) as {
    id: string;
    solana_wallet: string;
  }[]) {
    walletToUser.set(row.solana_wallet, row.id);
  }

  let seen = 0;
  let written = 0;
  let claimed = 0;
  let unattributable = 0;

  for (let page = 1; page <= PAGES; page++) {
    const listings = await fetchBagsDexPools(page);
    if (listings.length === 0) break;

    for (const listing of listings) {
      seen += 1;

      const creators = await fetchTokenCreators(listing.mint);
      // No creator record means Bags cannot say who made it. A launch we cannot
      // even name a creator for tells a reader nothing, so it is not listed.
      if (!creators) {
        unattributable += 1;
        continue;
      }

      const creator = creators.find(
        (c) => c.isCreator === true && typeof c.wallet === "string" && c.wallet,
      );
      if (!creator) {
        unattributable += 1;
        continue;
      }

      const wallet = creator.wallet as string;
      const userId = walletToUser.get(wallet);

      // Names and tickers are whatever the launcher minted. They are stored raw
      // and sanitised where they are rendered, so the record stays faithful and
      // a change to the sanitiser does not need a re-sync.
      const row: Record<string, unknown> = {
        token_mint: listing.mint,
        creator_wallet: wallet,
        twitter_username:
          typeof creator.twitterUsername === "string"
            ? creator.twitterUsername
            : null,
        bags_username:
          typeof creator.bagsUsername === "string"
            ? creator.bagsUsername
            : null,
        royalty_bps:
          typeof creator.royaltyBps === "number" ? creator.royaltyBps : 0,
        token_name: listing.name,
        token_symbol: listing.symbol,
        token_image_url: listing.imageUrl,
        fdv_usd: listing.fdvUsd,
        volume_24h_usd: listing.volume24hUsd,
        market_synced_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
      };

      // user_id is written ONLY when a proved wallet matches. Omitting the key
      // leaves an existing claim untouched, so a discovery pass can never
      // unclaim a launch a builder already verified.
      if (userId) row.user_id = userId;

      const { error: upsertError } = await sb
        .from("bags_launches")
        .upsert(row, { onConflict: "token_mint" });

      if (upsertError) {
        console.error(
          `bags-discover: upsert failed for ${listing.mint}:`,
          upsertError.message,
        );
        continue;
      }

      written += 1;
      if (userId) claimed += 1;
    }
  }

  return NextResponse.json({ seen, written, claimed, unattributable });
}
