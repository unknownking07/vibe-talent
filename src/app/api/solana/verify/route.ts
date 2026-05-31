import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateUUID } from "@/lib/validation";
import { CHAIN_CONFIGS, isSolanaChain } from "@/lib/chains-config";
import {
  isValidPackageId,
  expiresAtFor,
  expectedTokenAmount,
  passesSlippage,
  pickReceivedDelta,
  extractMemos,
  fetchContractPricesCached,
  fetchVibeUsdCached,
  type PaymentToken,
} from "@/lib/promotion-pricing";

// Verifies a Solana USDC/$VIBE payment and records the featured promotion.
// Unlike Base (where the contract binds the payment to a projectId), a Solana
// transfer is bare — so the payer must stamp the project_id into the tx MEMO,
// which we require here. Combined with the owner gate + replay check, that
// binds each payment to one project and one submitter.

const SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    // 2. Validate input
    const body = await req.json();
    const { project_id, signature, package_id, token } = body ?? {};

    if (!project_id || !validateUUID(project_id)) {
      return NextResponse.json({ error: "Invalid project_id" }, { status: 400 });
    }
    if (typeof signature !== "string" || !SIGNATURE_RE.test(signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    const pkg = Number(package_id);
    if (!Number.isInteger(pkg) || !isValidPackageId(pkg)) {
      return NextResponse.json({ error: "Invalid package_id" }, { status: 400 });
    }
    if (token !== "usdc" && token !== "vibe") {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    const tok: PaymentToken = token;

    const solana = CHAIN_CONFIGS.solana;
    if (!isSolanaChain(solana)) {
      return NextResponse.json({ error: "Solana not configured" }, { status: 500 });
    }

    const sb = createAdminClient();

    // 3. Owner gate — only the project's owner may promote it.
    const { data: project, error: projErr } = await sb
      .from("projects")
      .select("id, user_id")
      .eq("id", project_id)
      .single();
    if (projErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.user_id !== user.id) {
      return NextResponse.json(
        { error: "You can only promote your own project." },
        { status: 403 }
      );
    }

    // 4. Replay — a signature can only ever be used once.
    const { data: existing } = await sb
      .from("featured_promotions")
      .select("id")
      .eq("tx_ref", signature)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "This transaction was already used." }, { status: 409 });
    }

    // 5. Fetch the finalized transaction.
    const txRes = await fetch(solana.rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [
          signature,
          // 'confirmed' (not 'finalized') so verification works seconds after the
          // wallet returns; confirmed-depth reorgs are vanishingly rare on Solana.
          { commitment: "confirmed", maxSupportedTransactionVersion: 0, encoding: "jsonParsed" },
        ],
      }),
    });
    if (!txRes.ok) {
      return NextResponse.json(
        { error: "Couldn't reach the Solana network. Please retry." },
        { status: 503 }
      );
    }
    const txJson = await txRes.json();
    if (txJson?.error) {
      // JSON-RPC error from the node — a provider failure, not a missing tx.
      return NextResponse.json({ error: "Solana RPC error. Please retry." }, { status: 503 });
    }
    const tx = txJson?.result;
    if (!tx) {
      return NextResponse.json(
        { error: "Transaction not found or not confirmed yet." },
        { status: 404 }
      );
    }
    if (tx.meta?.err) {
      return NextResponse.json({ error: "That transaction failed on-chain." }, { status: 400 });
    }

    // 6. Memo binding — the payer must have stamped this project_id into the tx.
    const memos = extractMemos(tx.transaction?.message?.instructions ?? []);
    if (!memos.includes(project_id)) {
      return NextResponse.json(
        { error: "Payment is not bound to this project." },
        { status: 400 }
      );
    }

    // 7. Expected amount for the package.
    let prices: bigint[];
    try {
      prices = await fetchContractPricesCached();
    } catch {
      return NextResponse.json(
        { error: "Pricing unavailable right now. Please retry." },
        { status: 503 }
      );
    }
    const usdcPrice = prices[pkg];
    if (usdcPrice == null) {
      return NextResponse.json({ error: "Price unavailable" }, { status: 500 });
    }

    const mint = tok === "vibe" ? solana.vibeMint : solana.usdcMint;
    let expected: bigint;
    if (tok === "vibe") {
      let vibeUsd: number;
      try {
        vibeUsd = await fetchVibeUsdCached();
      } catch {
        return NextResponse.json(
          { error: "Couldn't price $VIBE right now — try USDC or retry." },
          { status: 503 }
        );
      }
      expected = expectedTokenAmount(usdcPrice, "vibe", vibeUsd, solana.vibeDecimals);
    } else {
      expected = expectedTokenAmount(usdcPrice, "usdc", 0);
    }

    // 8. Amount via balance delta to the receiving wallet (proves mint + dest + amount).
    const received = pickReceivedDelta(
      tx.meta?.preTokenBalances ?? [],
      tx.meta?.postTokenBalances ?? [],
      solana.receivingWallet,
      mint
    );
    if (!passesSlippage(received, expected)) {
      return NextResponse.json(
        { error: "Payment amount is too low for this package." },
        { status: 400 }
      );
    }

    // 9. Record (idempotent on tx_ref). promoter_wallet = fee payer.
    const keys = tx.transaction?.message?.accountKeys ?? [];
    const sender = (keys[0]?.pubkey ?? keys[0] ?? "").toString();

    const { error: insErr } = await sb.from("featured_promotions").upsert(
      {
        project_id,
        user_id: user.id,
        promoter_wallet: sender,
        chain: "solana",
        tx_ref: signature,
        package_id: pkg,
        paid_amount: received.toString(),
        expires_at: expiresAtFor(pkg, Date.now()),
      },
      { onConflict: "tx_ref" }
    );
    if (insErr) {
      console.error("Failed to record Solana promotion:", insErr);
      return NextResponse.json({ error: "Failed to record promotion." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
