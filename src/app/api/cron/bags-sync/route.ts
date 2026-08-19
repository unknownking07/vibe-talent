import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bagsConfigured, fetchCreatedLaunches } from "@/lib/bags";

/**
 * Cron job: resolve each verified builder's Bags launches into bags_launches.
 *
 * Bags is an upstream we do not control, so profile pages must never call it
 * live. This is the only thing that talks to Bags; profiles read the table.
 *
 * Only wallets that were cryptographically linked are used — binding one
 * requires an ed25519 signature over a server-issued nonce, so a row here means
 * the same person controls both the GitHub-verified profile and the launching
 * wallet. That chain is the entire product claim; nothing self-reported (a
 * typed-in X handle, say) may ever produce a row.
 *
 * Protected by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  // Fail closed: without a secret in production this route would be open, and
  // it writes the table that backs a public credibility claim.
  if (!cronSecret && process.env.NODE_ENV === "production") {
    console.error("CRON_SECRET is not configured");
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!bagsConfigured()) {
    // Not an error: the integration is simply not switched on yet.
    return NextResponse.json({ skipped: "BAGS_API_KEY not configured" });
  }

  const sb = createAdminClient();

  const { data: builders, error } = await sb
    .from("users")
    .select("id, solana_wallet")
    .not("solana_wallet", "is", null)
    .not("solana_wallet_verified_at", "is", null);

  if (error) {
    console.error("bags-sync: failed to load builders:", error.message);
    return NextResponse.json({ error: "Failed to load builders" }, { status: 500 });
  }

  let checked = 0;
  let upserted = 0;
  let unreachable = 0;

  for (const builder of builders ?? []) {
    const wallet = (builder as { solana_wallet: string }).solana_wallet;
    const userId = (builder as { id: string }).id;

    const launches = await fetchCreatedLaunches(wallet);
    checked += 1;

    // null means Bags could not answer. Leave existing rows untouched: a
    // builder's launches must not disappear from their profile because an
    // upstream had a bad minute.
    if (launches === null) {
      unreachable += 1;
      continue;
    }

    for (const launch of launches) {
      const { error: upsertError } = await sb
        .from("bags_launches")
        .upsert(
          {
            token_mint: launch.tokenMint,
            user_id: userId,
            creator_wallet: wallet,
            twitter_username: launch.twitterUsername,
            royalty_bps: launch.royaltyBps,
            last_verified_at: new Date().toISOString(),
          },
          { onConflict: "token_mint" },
        );
      if (upsertError) {
        console.error(`bags-sync: upsert failed for ${launch.tokenMint}:`, upsertError.message);
        continue;
      }
      upserted += 1;
    }
  }

  return NextResponse.json({ checked, upserted, unreachable });
}
