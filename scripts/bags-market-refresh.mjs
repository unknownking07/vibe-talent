#!/usr/bin/env node
/**
 * Ask GeckoTerminal about the mints /api/cron/bags-market names, and post the
 * answers back.
 *
 * WHY THIS RUNS ON THE RUNNER AND NOT IN THE ROUTE: GeckoTerminal rate-limits by
 * IP, and the Worker egresses from Cloudflare's shared pool — the same lookup
 * that answers 200 here answers 429 there. This script exists only to make the
 * request from an IP that is ours, so it deliberately does no parsing: it
 * forwards GeckoTerminal's own token objects and lets the route parse them with
 * the function the rest of the codebase already uses.
 *
 * Env: SITE_URL, CRON_SECRET.
 */

const SITE = (process.env.SITE_URL || "https://www.vibetalent.work").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET;
const ENDPOINT = `${SITE}/api/cron/bags-market`;

const GECKO = "https://api.geckoterminal.com/api/v2/networks/solana";
/** GeckoTerminal accepts at most 30 addresses per multi lookup. */
const CHUNK = 30;
/** The free tier tolerates a burst and then refuses; this keeps us under it. */
const PACING_MS = 4000;
/** A rate limit is not worth retrying into — the window stays shut. */
const RATE_LIMITED = 429;
const UA = "vibetalent/1.0 (+https://www.vibetalent.work)";

if (!SECRET) {
  console.error("CRON_SECRET is not set");
  process.exit(1);
}

const auth = { Authorization: `Bearer ${SECRET}` };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const listed = await fetch(ENDPOINT, { headers: auth });
if (!listed.ok) {
  console.error(`GET ${ENDPOINT} -> HTTP ${listed.status}`);
  process.exit(1);
}
const { mints } = await listed.json();
console.log(`mints to refresh: ${mints.length}`);

const answered = [];
const entries = [];

for (let i = 0; i < mints.length; i += CHUNK) {
  if (i > 0) await sleep(PACING_MS);

  const chunk = mints.slice(i, i + CHUNK);
  const url = `${GECKO}/tokens/multi/${chunk.map(encodeURIComponent).join(",")}?include=top_pools`;

  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    console.log(`  chunk ${i / CHUNK}: request failed (${err.message}) — left untouched`);
    continue;
  }

  // Once the window is shut every later call fails too, so stop rather than
  // spend the rest. Unasked mints keep their prices and sort first next run.
  if (res.status === RATE_LIMITED) {
    console.log(`  chunk ${i / CHUNK}: rate limited — stopping here`);
    break;
  }
  if (!res.ok) {
    console.log(`  chunk ${i / CHUNK}: HTTP ${res.status} — left untouched`);
    continue;
  }

  // A 2xx carrying malformed JSON is still a failed chunk, not a failed run:
  // letting it reject here would throw away every chunk already collected.
  let body;
  try {
    body = await res.json();
  } catch (err) {
    console.log(`  chunk ${i / CHUNK}: unreadable body (${err.message}) — left untouched`);
    continue;
  }
  const data = Array.isArray(body?.data) ? body.data : [];
  answered.push(...chunk);
  entries.push(...data);
  console.log(`  chunk ${i / CHUNK}: asked ${chunk.length}, indexed ${data.length}`);
}

console.log(`answered ${answered.length}, entries ${entries.length}`);
if (answered.length === 0) {
  console.log("nothing to post");
  process.exit(0);
}

const posted = await fetch(ENDPOINT, {
  method: "POST",
  headers: { ...auth, "Content-Type": "application/json" },
  body: JSON.stringify({ answered, entries }),
});
const result = await posted.text();
console.log(`POST -> HTTP ${posted.status} ${result.slice(0, 300)}`);
if (!posted.ok) process.exit(1);
