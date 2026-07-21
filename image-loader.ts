// Custom next/image loader → Cloudflare Image Transformations.
//
// Routes every <Image> through /cdn-cgi/image/<opts>/<src>, which Cloudflare's
// edge CDN transforms ONCE and then serves from cache (cf-cache-status: HIT).
// The previous path (@opennextjs/cloudflare's IMAGES binding) re-transformed
// remote images on every request and set no Cache-Control — the root cause of
// the slow, uncached image loads.
//
// Requires (Cloudflare dashboard → Images → Transformations):
//   1. Transformations enabled on the vibetalent.work zone.
//   2. Source hosts allow-listed under "Sources": okxjdenxztzuqqlekqdb.supabase.co,
//      avatars.githubusercontent.com, lh3.googleusercontent.com, unavatar.io.
// Until both are done, /cdn-cgi/image/... 404s — do not deploy this before then.

interface CloudflareLoaderArgs {
  src: string;
  width: number;
  quality?: number;
}

// The segment after the options is an absolute path OR a full URL. Strip the
// leading slash on local /public paths; leave remote https:// URLs (Supabase +
// avatar hosts, query string included) untouched.
function normalizeSrc(src: string): string {
  return src.startsWith("/") ? src.slice(1) : src;
}

export default function cloudflareImageLoader({ src, width, quality }: CloudflareLoaderArgs): string {
  // data:/blob: images can't be transformed — pass through untouched.
  if (src.startsWith("data:") || src.startsWith("blob:")) return src;

  // Local dev has no /cdn-cgi/ endpoint — load the original source directly so
  // `next dev` still works.
  if (process.env.NODE_ENV === "development") return src;

  const params = [`width=${width}`, "format=auto"];
  if (quality) params.push(`quality=${quality}`);
  return `/cdn-cgi/image/${params.join(",")}/${normalizeSrc(src)}`;
}
