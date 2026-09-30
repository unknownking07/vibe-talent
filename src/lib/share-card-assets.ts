import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Load the site's actual logo from the static asset binding on Cloudflare. */
let logoPromise: Promise<string> | undefined;
const FALLBACK_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export function getShareCardLogo(baseUrl = "https://www.vibetalent.work"): Promise<string> {
  logoPromise ??= (async () => {
      // Next emits this import as a hashed /_next/static/media path. Resolve it
      // to an absolute URL for local/Vercel; Workers can read their asset
      // binding directly and avoid a slow edge-to-own-hostname request.
      const url = new URL(new URL("../../public/logo.png", import.meta.url).toString(), baseUrl);
      let response: Response | undefined;
      try {
        const { env } = getCloudflareContext();
        const assets = (env as { ASSETS?: { fetch: (input: Request) => Promise<Response> } }).ASSETS;
        if (assets) response = await assets.fetch(new Request(url));
      } catch {
        // Local Next and other hosts have no Cloudflare asset binding.
      }
      response ??= await fetch(url);
      if (!response.ok) throw new Error(`VibeTalent logo HTTP ${response.status}`);
      return `data:image/png;base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
    })().catch((error) => {
      logoPromise = undefined;
      console.error("Share card logo failed:", error);
      return FALLBACK_LOGO;
    });
  return logoPromise;
}
