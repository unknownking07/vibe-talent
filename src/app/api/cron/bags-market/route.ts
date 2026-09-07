import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseTokenMarket, type TokenMarket } from "@/lib/token-market";
import { buildMarketUpdates, type ExistingLaunch } from "@/lib/bags-market";

/**
 * Cron job: refresh the market data on stored Bags launches.
 *
 * WHY THIS IS TWO HALVES INSTEAD OF ONE ROUTE THAT JUST FETCHES: GeckoTerminal
 * rate-limits by IP, and this Worker egresses from Cloudflare's shared pool. The
 * same multi lookup that answers 200 from a laptop answers 429 here, so the
 * refresh inside bags-discover was starving — one chunk on its best run, zero on
 * the two after. The lookups therefore happen on the GitHub Actions runner that
 * already schedules our crons, which has an IP of its own, and this route is the
 * half that decides what to ask about and writes what comes back.
 *
 * GET  hands out the mints most in need of a refresh.
 * POST takes the answers and stores them.
 *
 * Both are protected by CRON_SECRET.
 */

/**
 * How many mints one run refreshes.
 *
 * Sized to cover the table in a single pass now that the caller is not fighting
 * a shared rate limit. Still bounded: stalest-first ordering means a table that
 * outgrows this cycles rather than starving its tail.
 */
const REFRESH_SLICE = 500;

/** Guard rail on the POST body, which is parsed before anything is trusted. */
const MAX_ENTRIES = 1000;

function unauthorized(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  // Fail closed: this writes the table behind a public credibility claim.
  if (!cronSecret && process.env.NODE_ENV === "production") {
    console.error("CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Cron secret not configured" },
      { status: 500 },
    );
  }
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** The mints worth asking about, never-priced first and then stalest. */
export async function GET(req: NextRequest) {
  const denied = unauthorized(req);
  if (denied) return denied;

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("bags_launches")
    .select("token_mint")
    .order("market_synced_at", { ascending: true, nullsFirst: true })
    .limit(REFRESH_SLICE);

  if (error) {
    console.error("bags-market: select failed:", error.message);
    return NextResponse.json({ error: "Select failed" }, { status: 500 });
  }

  const mints = (data ?? []).map((r) => (r as { token_mint: string }).token_mint);
  return NextResponse.json({ mints, count: mints.length });
}

/**
 * Store what the runner got back.
 *
 * The body carries GeckoTerminal's own token objects, unmodified, so the parsing
 * stays here in the function the single lookup already uses rather than being
 * reimplemented in a shell script. `answered` is the list of mints the runner
 * actually got a response for: a mint in it but absent from the entries was
 * asked about and is genuinely unindexed, so its null is stored, while a mint
 * missing from both was never successfully asked about and is left alone.
 *
 * NOTHING in the body may name a row that does not already exist, and nothing in
 * it may set a column other than the four market ones. Both are enforced by
 * reading the affected rows back out of our own table first: the identity that
 * goes into the write is ours, and only the numbers come from the payload.
 */
export async function POST(req: NextRequest) {
  const denied = unauthorized(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed body" }, { status: 400 });
  }

  // `null` parses as valid JSON, so this has to be checked before any property
  // is read off it.
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Malformed body" }, { status: 400 });
  }

  const payload = body as { answered?: unknown; entries?: unknown };
  if (!Array.isArray(payload.answered) || !Array.isArray(payload.entries)) {
    return NextResponse.json(
      { error: "Expected { answered: string[], entries: object[] }" },
      { status: 400 },
    );
  }
  if (
    payload.answered.length > MAX_ENTRIES ||
    payload.entries.length > MAX_ENTRIES
  ) {
    return NextResponse.json({ error: "Body too large" }, { status: 413 });
  }

  const answered = new Set(
    payload.answered.filter((m): m is string => typeof m === "string"),
  );
  if (answered.size === 0) {
    return NextResponse.json({ considered: 0, refreshed: 0, priced: 0 });
  }

  const markets = new Map<string, TokenMarket>();
  for (const entry of payload.entries) {
    const market = parseTokenMarket(entry, null);
    if (market) markets.set(market.mint, market);
  }

  const sb = createAdminClient();

  // Identity comes from our own table, so a payload can neither invent a launch
  // nor rewrite whose launch it is. Anything it names that is not already here
  // is simply not written.
  const { data: existing, error: readError } = await sb
    .from("bags_launches")
    .select("token_mint, creator_wallet")
    .in("token_mint", [...answered]);

  if (readError) {
    console.error("bags-market: read-back failed:", readError.message);
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }

  const rows = (existing ?? []) as ExistingLaunch[];
  if (rows.length === 0) {
    return NextResponse.json({ considered: answered.size, refreshed: 0, priced: 0 });
  }

  const updates = buildMarketUpdates(
    answered,
    markets,
    rows,
    new Date().toISOString(),
  );

  // Columns absent from the payload are left alone by the conflict update, so
  // this cannot disturb user_id, the Bags identity fields or last_verified_at.
  const { error: writeError } = await sb
    .from("bags_launches")
    .upsert(updates, { onConflict: "token_mint" });

  if (writeError) {
    console.error("bags-market: write failed:", writeError.message);
    return NextResponse.json({ error: "Write failed" }, { status: 500 });
  }

  return NextResponse.json({
    considered: answered.size,
    refreshed: updates.length,
    priced: updates.filter((u) => u.fdv_usd !== null).length,
  });
}
