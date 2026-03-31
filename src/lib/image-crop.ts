/**
 * Shared helper to parse image crop parameters (position + zoom) from URL query params.
 * Used by project-card, profile-project-card, and the dashboard editor.
 */
export function parseImageCrop(url: string): { objectPosition: string; scale: number } {
  try {
    const u = new URL(url);
    const y = Math.min(100, Math.max(0, parseInt(u.searchParams.get("y") || "50") || 50));
    const z = Math.min(2, Math.max(1, parseFloat(u.searchParams.get("z") || "1") || 1));
    return { objectPosition: `center ${y}%`, scale: z };
  } catch {
    return { objectPosition: "center 50%", scale: 1 };
  }
}
