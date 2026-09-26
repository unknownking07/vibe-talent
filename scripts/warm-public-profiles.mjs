/**
 * Populate OpenNext's shared ISR cache for public builder profiles after a
 * Cloudflare deploy. The deploy intentionally skips OpenNext's cache-populate
 * step, which otherwise makes the first visitor generate each profile.
 *
 * The sitemap is the source of truth for indexable profiles. Four concurrent
 * requests keep this bounded for our small pre-revenue database.
 */
const site = new URL("https://www.vibetalent.work");
const deployment = process.env.GITHUB_SHA;
const concurrency = 4;
const timeoutMs = 30_000;

if (!deployment) {
  throw new Error("GITHUB_SHA is required to bypass the previous deploy's edge cache");
}

function warmUrl(url) {
  const target = new URL(url);
  target.searchParams.set("deploy_warm", deployment);
  return target;
}

async function request(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  // The ISR render completes before the response stream closes. Consuming it
  // also lets the connection return to Node's pool for the next profile.
  await response.arrayBuffer();
}

const sitemapResponse = await fetch(warmUrl(new URL("/sitemap.xml", site)), {
  signal: AbortSignal.timeout(timeoutMs),
});
if (!sitemapResponse.ok) {
  throw new Error(`Sitemap fetch failed: ${sitemapResponse.status}`);
}
const sitemap = await sitemapResponse.text();
const profiles = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((match) => new URL(match[1]))
  .filter((url) => url.origin === site.origin && /^\/profile\/[^/]+$/.test(url.pathname));
const uniqueProfiles = [...new Map(profiles.map((url) => [url.pathname, url])).values()];

if (uniqueProfiles.length === 0) {
  throw new Error("Sitemap returned no public profiles; cache warmup cannot proceed");
}

let nextIndex = 0;
let warmed = 0;
const failures = [];

async function worker() {
  while (nextIndex < uniqueProfiles.length) {
    const url = uniqueProfiles[nextIndex++];
    try {
      await request(warmUrl(url));
      warmed++;
    } catch (error) {
      failures.push(`${url.pathname}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
console.log(`Warmed ${warmed}/${uniqueProfiles.length} public profiles`);
for (const failure of failures) {
  console.error(`Profile warmup failed: ${failure}`);
}
if (failures.length > 0) {
  process.exitCode = 1;
}
