/**
 * Dev-only preview page for the onboarding tour.
 *
 * Lets us see and click through the modal without going through the full
 * signup → profile-setup → dashboard flow. Auto-disabled in production via
 * `notFound()` so a stray deploy can't expose it.
 *
 * Usage: `npm run dev` then visit http://localhost:3000/dev/tour-preview
 *
 * Optional query: `?username=<name>` to test the `/profile/${username}` deep
 * links on cards 4 and 6. Defaults to "preview-user".
 */

import { notFound } from "next/navigation";
import { ReopenableTour } from "./reopenable-tour";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ username?: string }>;
}

export default async function TourPreviewPage({ searchParams }: PageProps) {
  // Hard gate: never serve this in production. The page literally returns a
  // 404 if NODE_ENV isn't development, so it can't be probed even if the
  // route stays in the build output.
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { username } = await searchParams;
  const previewUsername = username?.trim() || "preview-user";

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: "var(--background)" }}>
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-extrabold uppercase text-[var(--foreground)] mb-2">
          Onboarding Tour Preview
        </h1>
        <p className="text-sm text-[var(--text-secondary)] font-medium">
          Dev-only. Renders the modal with `forceOpen` so it shows regardless
          of the env flag or the seen-state.
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-3">
          Username deep-link: <code>/profile/{previewUsername}</code>
        </p>
      </div>

      <ReopenableTour username={previewUsername} />
    </div>
  );
}
