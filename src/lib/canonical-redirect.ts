/** Canonicalize production URLs before the Worker serves or caches a page. */
export function canonicalProductionRedirect(url: URL): Response | null {
  const isProductionHost = url.hostname === "vibetalent.work" ||
    url.hostname === "www.vibetalent.work";
  if (!isProductionHost || (url.hostname === "www.vibetalent.work" && url.protocol === "https:")) {
    return null;
  }

  const canonical = new URL(url);
  canonical.protocol = "https:";
  canonical.hostname = "www.vibetalent.work";
  canonical.port = "";
  // 308 is permanent and retains the method/body for API requests too.
  return Response.redirect(canonical.href, 308);
}
