// Client-safe staging flag.
//
// The server gate (lib/staging.ts) reads the Cloudflare env, which client
// components cannot do. NEXT_PUBLIC_VIBE_STAGING is inlined at BUILD time and
// set only by the staging deploy workflow, so production bundles carry "false"
// and the unreleased UI is not merely hidden — it is compiled out of the
// branch that renders it.
//
// This governs DISPLAY only. The server gate is what actually protects the
// write paths; never rely on this alone.

export const IS_STAGING_CLIENT = process.env.NEXT_PUBLIC_VIBE_STAGING === "1";
