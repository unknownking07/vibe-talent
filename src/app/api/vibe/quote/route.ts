import { NextRequest, NextResponse } from "next/server";
import { CHAIN_CONFIGS, isSolanaChain } from "@/lib/chains-config";
import { expectedTokenAmount, fetchVibeUsdCached } from "@/lib/promotion-pricing";
import { VOUCH } from "@/lib/vibe-config";

// GET /api/vibe/quote?usd=5
//
// How many base units of $VIBE a given USD amount is worth right now. Uses the
// SAME price source the burn verifier uses, so an amount quoted here clears
// verification (within the 60s price cache and the 10% slippage floor).
//
// The existing /api/solana/quote only prices the fixed contract packages; burns
// take an arbitrary amount, hence this.

// Guards a fat-fingered burn: nobody is destroying $10k of a token with $2.4k
// of liquidity through this UI by accident.
const MAX_QUOTE_USD = 500;

export async function GET(req: NextRequest) {
  try {
    const usd = Number(new URL(req.url).searchParams.get("usd"));
    if (!Number.isFinite(usd) || usd < VOUCH.minUsd) {
      return NextResponse.json(
        { error: `Amount must be at least $${VOUCH.minUsd}.` },
        { status: 400 },
      );
    }
    if (usd > MAX_QUOTE_USD) {
      return NextResponse.json(
        { error: `Amount must be $${MAX_QUOTE_USD} or less.` },
        { status: 400 },
      );
    }

    const solana = CHAIN_CONFIGS.solana;
    if (!isSolanaChain(solana)) {
      return NextResponse.json({ error: "Solana not configured" }, { status: 500 });
    }

    let vibeUsd: number;
    try {
      vibeUsd = await fetchVibeUsdCached();
    } catch {
      return NextResponse.json(
        { error: "Couldn't price $VIBE right now. Please retry." },
        { status: 503 },
      );
    }

    const amount = expectedTokenAmount(
      BigInt(Math.round(usd * 1e6)),
      "vibe",
      vibeUsd,
      solana.vibeDecimals,
    );

    return NextResponse.json(
      {
        usd,
        vibeUsd,
        amount: amount.toString(),
        decimals: solana.vibeDecimals,
        wholeTokens: Number(amount) / 10 ** solana.vibeDecimals,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Quote failed" }, { status: 400 });
  }
}
