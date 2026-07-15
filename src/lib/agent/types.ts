// Client-safe types shared between the agent API stream and the chat UIs.
// Keep this module free of server-only imports.

import type { BadgeLevel } from "@/lib/types/database";

/**
 * A builder result produced by an agent tool call, trimmed to exactly what
 * the UI card renders. Built server-side from live public platform data —
 * the model never fabricates these.
 */
export interface AgentBuilderCard {
  username: string;
  avatar_url: string | null;
  badge_level: BadgeLevel;
  vibe_score: number;
  streak: number;
  projects_count: number;
  verified_projects_count: number;
  /** Aggregated from the builder's projects, capped for display. */
  tech_stack: string[];
  /** Deterministic 0–100 score (match or evaluation); null for plain sorts. */
  match_score: number | null;
  /** Short verifiable facts: streak, badge, matched skills, etc. */
  reasons: string[];
}
