import { NextRequest, NextResponse } from "next/server";
import { CHAIN_CONFIGS, isSolanaChain } from "@/lib/chains-config";
import {
  isValidPackageId,
  expectedTokenAmount,
  fetchContractPricesCached,
  fetchVibeUsdCached,
  type PaymentToken,
} from "@/lib/promotion-pricing";

// GET /api/solana/quote?package_id=2&token=vibe
// Returns the exact on-chain amount (base units) the client should transfer,
// from the SAME price source the verifier uses — so the payment passes
// verification (within the 60s price cache + 90% slippage floor).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pkg = Number(searchParams.get("package_id"));
    const tok: PaymentToken = searchParams.get("token") === "vibe" ? "vibe" : "usdc";

    if (!Number.isInteger(pkg) || !isValidPackageId(pkg)) {
      return NextResponse.json({ error: "Invalid package_id" }, { status: 400 });
    }
    const solana = CHAIN_CONFIGS.solana;
    if (!isSolanaChain(solana)) {
      return NextResponse.json({ error: "Solana not configured" }, { status: 500 });
    }

    const prices = await fetchContractPricesCached();
    const usdcPrice = prices[pkg];
    if (usdcPrice == null) {
      return NextResponse.json({ error: "Price unavailable" }, { status: 500 });
    }

    if (tok === "usdc") {
      return NextResponse.json(
        {
          token: "usdc",
          amount: usdcPrice.toString(),
          decimals: solana.usdcDecimals,
          usd: Number(usdcPrice) / 1e6,
        },
        { headers: { "Cache-Control": "public, s-maxage=30" } }
      );
    }

    let vibeUsd: number;
    try {
      vibeUsd = await fetchVibeUsdCached();
    } catch {
      return NextResponse.json({ error: "Couldn't price $VIBE right now." }, { status: 503 });
    }
    const amount = expectedTokenAmount(usdcPrice, "vibe", vibeUsd, solana.vibeDecimals);
    return NextResponse.json(
      {
        token: "vibe",
        amount: amount.toString(),
        decimals: solana.vibeDecimals,
        vibeUsd,
        usd: Number(usdcPrice) / 1e6,
      },
      { headers: { "Cache-Control": "public, s-maxage=30" } }
    );
  } catch {
    return NextResponse.json({ error: "Quote failed" }, { status: 400 });
  }
}
