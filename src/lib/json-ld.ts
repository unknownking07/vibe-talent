/**
 * Safely serialize a JSON-LD object for embedding in a
 * `<script type="application/ld+json" dangerouslySetInnerHTML>` tag.
 *
 * `JSON.stringify` does NOT escape the HTML-significant characters `<`, `>`
 * and `&`, so any user-controlled value in the object (e.g. a profile bio or
 * project title) containing the literal `</script>` could close the script
 * element and inject attacker-supplied markup — a stored XSS. Escaping those
 * characters to their `\uXXXX` forms keeps the JSON byte-for-byte equivalent
 * when parsed, while making script-context breakout impossible.
 *
 * Always use this instead of `JSON.stringify` when feeding
 * `dangerouslySetInnerHTML` for structured-data scripts.
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
