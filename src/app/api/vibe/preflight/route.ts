import { NextRequest, NextResponse } from "next/server";
import { CHAIN_CONFIGS, isSolanaChain } from "@/lib/chains-config";
import { stagingOnlyResponse } from "@/lib/staging";

// POST /api/vibe/preflight
//
// Pre-check a burn request before the user signs anything. Returns the wallet's
// $VIBE balance and a recent blockhash so the client can build the transaction
// with a fresh blockhash (instead of fetching one inside the burn builder).
//
// Guards:
// - 400 for malformed input (invalid wallet, non-positive amount).
// - 409 when the wallet has less $VIBE than requested (raw base-unit strings).
// - 503 when Solana RPC is unavailable or returns garbage.

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type RpcResult = { result?: unknown; error?: unknown };
type BlockhashValue = { blockhash?: unknown };

/** Small helper: a safe 503 response for any Solana-side failure. */
function solanaUnavailable(): NextResponse {
  return NextResponse.json(
    {
      code: "SOLANA_UNAVAILABLE",
      error:
        "Solana is temporarily unavailable. Your tokens were not burned. Please try again.",
    },
    { status: 503 },
  );
}

/** Narrow an unknown value to a JSON-RPC result record. */
function toRpcResult(data: unknown): RpcResult | null {
  if (typeof data !== "object" || data === null) return null;
  return data as RpcResult;
}

/** Narrow an unknown value to a plain object record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Narrow an unknown value to a string-only digit string. */
function digitString(v: unknown): string | null {
  return typeof v === "string" && /^\d+$/.test(v) ? v : null;
}

/** Sum token account amounts as bigint; return null on any malformed entry. */
function sumAccountAmounts(
  data: unknown,
): bigint | null {
  const rpc = toRpcResult(data);
  if (!rpc) return null;
  // Explicitly reject RPC errors.
  if (rpc.error !== undefined && rpc.error !== null) return null;

  const result = rpc.result;
  if (typeof result !== "object" || result === null) return null;
  const value = (result as { value?: unknown }).value;
  if (!Array.isArray(value)) return null;

  let total = 0n;
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const account = (entry as { account?: unknown }).account;
    if (typeof account !== "object" || account === null) return null;
    const dataField = (account as { data?: unknown }).data;
    if (typeof dataField !== "object" || dataField === null) return null;
    const parsed = (dataField as { parsed?: unknown }).parsed;
    if (typeof parsed !== "object" || parsed === null) return null;
    const info = (parsed as { info?: unknown }).info;
    if (typeof info !== "object" || info === null) return null;
    const tokenAmount = (info as { tokenAmount?: unknown }).tokenAmount;
    if (typeof tokenAmount !== "object" || tokenAmount === null) return null;
    const amt = (tokenAmount as { amount?: unknown }).amount;
    const ds = digitString(amt);
    if (!ds) return null;
    try {
      total += BigInt(ds);
    } catch {
      return null;
    }
  }
  return total;
}

/** Extract a blockhash string from a getLatestBlockhash result. */
function extractBlockhash(data: unknown): string | null {
  const rpc = toRpcResult(data);
  if (!rpc) return null;
  if (rpc.error !== undefined && rpc.error !== null) return null;

  const result = rpc.result;
  if (typeof result !== "object" || result === null) return null;
  const value = (result as { value?: unknown }).value;
  if (typeof value !== "object" || value === null) return null;
  const bh = (value as BlockhashValue).blockhash;
  return typeof bh === "string" && bh ? bh : null;
}

export async function POST(req: NextRequest) {
  const gate = stagingOnlyResponse();
  if (gate) return gate;

  const solana = CHAIN_CONFIGS.solana;
  if (!isSolanaChain(solana)) {
    return NextResponse.json(
      { error: "Solana not configured" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 },
    );
  }

  if (!isRecord(body)) {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 },
    );
  }

  const { wallet, amount } = body;

  // Wallet: base58-like string, 32-44 chars.
  if (typeof wallet !== "string" || !BASE58_RE.test(wallet)) {
    return NextResponse.json(
      { error: "Invalid wallet address." },
      { status: 400 },
    );
  }

  // Amount: positive integer string parseable as bigint.
  if (typeof amount !== "string" || !/^\d+$/.test(amount)) {
    return NextResponse.json(
      { error: "Invalid amount." },
      { status: 400 },
    );
  }
  let requested: bigint;
  try {
    requested = BigInt(amount);
  } catch {
    return NextResponse.json(
      { error: "Invalid amount." },
      { status: 400 },
    );
  }
  if (requested <= 0n) {
    return NextResponse.json(
      { error: "Amount must be positive." },
      { status: 400 },
    );
  }

  // Query the wallet's $VIBE token accounts and a fresh blockhash in parallel.
  // Wrap the entire Promise.all and both JSON parses in one try/catch so any
  // network rejection yields the structured 503.
  let accountsRes: Response;
  let blockhashRes: Response;
  try {
    [accountsRes, blockhashRes] = await Promise.all([
      fetch(solana.rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenAccountsByOwner",
          params: [
            wallet,
            { mint: solana.vibeMint },
            { encoding: "jsonParsed", commitment: "confirmed" },
          ],
        }),
      }),
      fetch(solana.rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "getLatestBlockhash",
          params: [{ commitment: "confirmed" }],
        }),
      }),
    ]);
  } catch {
    return solanaUnavailable();
  }

  // Check both Response.ok explicitly.
  if (!accountsRes.ok || !blockhashRes.ok) {
    return solanaUnavailable();
  }

  let accountsData: unknown;
  let blockhashData: unknown;
  try {
    accountsData = await accountsRes.json();
    blockhashData = await blockhashRes.json();
  } catch {
    return solanaUnavailable();
  }

  // Parse total balance: sum every account's tokenAmount.amount as bigint.
  const total = sumAccountAmounts(accountsData);
  if (total === null) {
    return solanaUnavailable();
  }

  // Extract blockhash.
  const blockhash = extractBlockhash(blockhashData);
  if (!blockhash) {
    return solanaUnavailable();
  }

  if (total < requested) {
    // Return RAW base-unit decimal strings. The client formats them.
    return NextResponse.json(
      {
        code: "INSUFFICIENT_VIBE",
        error: "This wallet does not have enough $VIBE for this burn.",
        required: requested.toString(),
        available: total.toString(),
        shortfall: (requested - total).toString(),
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { ok: true, blockhash, available: total.toString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
