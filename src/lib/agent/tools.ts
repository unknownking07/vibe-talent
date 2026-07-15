// Server-side tools for the VibeFinder agent.
//
// Division of labor: the LLM only handles language. Every builder fact and
// every ranking here is computed deterministically from live public platform
// data (same tables RLS already exposes to anonymous visitors), reusing the
// existing agent-scoring engine. Each tool returns a compact JSON payload for
// the model plus optional `AgentBuilderCard`s the UI renders directly.

import { matchUsers, evaluateUser } from "@/lib/agent-scoring";
import type { ToolDefinition } from "@/lib/deepseek";
import type { UserWithSocials } from "@/lib/types/database";
import type { TaskRequest } from "@/lib/types/agent";
import type { AgentBuilderCard } from "./types";

// Mirrors the public column sets used by lib/supabase/queries.ts, minus
// fields the scorer never reads. All public data — never select email-like
// or private columns here.
const USER_FIELDS =
  "id, username, display_name, bio, avatar_url, github_username, vibe_score, streak, longest_streak, badge_level, created_at";
const PROJECT_FIELDS =
  "id, user_id, title, description, tech_stack, live_url, live_url_ok, github_url, tags, verified, quality_score, quality_metrics, endorsement_count";

// How many builders one search can return / how big the ranking pool is.
const MAX_RESULTS = 6;
const DEFAULT_RESULTS = 3;
const POOL_SIZE = 200;
const MAX_SKILLS = 10;
const BIO_PREVIEW = 140;
const TECH_PREVIEW = 6;

export const SEARCH_SORTS = ["best_match", "vibe_score", "streak", "projects"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export interface SearchBuilderArgs {
  skills: string[];
  projectDescription: string;
  minVibeScore: number | null;
  activeOnly: boolean;
  sort: SearchSort;
  limit: number;
}

/** Clamp + sanitize whatever argument JSON the model produced. */
export function normalizeSearchArgs(raw: unknown): SearchBuilderArgs {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const skills = Array.isArray(obj.skills)
    ? obj.skills
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, MAX_SKILLS)
    : [];

  const minVibeScoreRaw = Number(obj.min_vibe_score);
  const limitRaw = Number(obj.limit);

  return {
    skills,
    projectDescription:
      typeof obj.project_description === "string" ? obj.project_description.slice(0, 300) : "",
    minVibeScore: Number.isFinite(minVibeScoreRaw) && minVibeScoreRaw > 0 ? minVibeScoreRaw : null,
    activeOnly: obj.active_only === true,
    sort: SEARCH_SORTS.includes(obj.sort as SearchSort) ? (obj.sort as SearchSort) : "best_match",
    limit: Number.isFinite(limitRaw)
      ? Math.min(MAX_RESULTS, Math.max(1, Math.round(limitRaw)))
      : DEFAULT_RESULTS,
  };
}

/** "@Some_User " → "some_user"; rejects anything that can't be a username. */
export function normalizeUsername(raw: unknown): string | null {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (typeof obj.username !== "string") return null;
  const name = obj.username.trim().replace(/^@/, "");
  if (!name || name.length > 60 || !/^[a-zA-Z0-9_.-]+$/.test(name)) return null;
  return name;
}

/** Short verifiable facts for a builder — same spirit as matchUsers reasons. */
export function buildReasons(user: UserWithSocials): string[] {
  const reasons: string[] = [];
  if (user.streak > 30) reasons.push(`${user.streak}-day active streak`);
  if (user.badge_level !== "none") {
    reasons.push(`${user.badge_level.charAt(0).toUpperCase() + user.badge_level.slice(1)} badge holder`);
  }
  const projects = user.projects ?? [];
  const verified = projects.filter((p) => p.verified).length;
  if (verified > 0) reasons.push(`${verified} GitHub-verified project${verified > 1 ? "s" : ""}`);
  else if (projects.length > 0) reasons.push(`Shipped ${projects.length} project${projects.length > 1 ? "s" : ""}`);
  if (user.vibe_score > 0) reasons.push(`Vibe score: ${user.vibe_score}`);
  return reasons.slice(0, 4);
}

function aggregateTech(user: UserWithSocials): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const project of user.projects ?? []) {
    for (const tech of project.tech_stack ?? []) {
      const key = tech.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tech);
    }
  }
  return out;
}

function toCard(
  user: UserWithSocials,
  matchScore: number | null,
  reasons: string[]
): AgentBuilderCard {
  const projects = user.projects ?? [];
  return {
    username: user.username,
    avatar_url: user.avatar_url,
    badge_level: user.badge_level,
    vibe_score: user.vibe_score,
    streak: user.streak,
    projects_count: projects.length,
    verified_projects_count: projects.filter((p) => p.verified).length,
    tech_stack: aggregateTech(user).slice(0, TECH_PREVIEW),
    match_score: matchScore,
    reasons,
  };
}

/** Compact per-builder JSON the model reasons over (kept small: token cost). */
function toLLMBuilder(card: AgentBuilderCard, bio: string | null) {
  return {
    username: card.username,
    profile_path: `/profile/${card.username}`,
    vibe_score: card.vibe_score,
    streak: card.streak,
    badge: card.badge_level,
    projects: card.projects_count,
    verified_projects: card.verified_projects_count,
    tech: card.tech_stack,
    match_score: card.match_score,
    reasons: card.reasons,
    bio: bio ? bio.slice(0, BIO_PREVIEW) : null,
  };
}

// ---------------------------------------------------------------------------
// Tool definitions (OpenAI-compatible JSON schema for DeepSeek)
// ---------------------------------------------------------------------------

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "search_builders",
      description:
        "Search and rank VibeTalent builders from live platform data. Ranking is deterministic — computed from verified GitHub activity, streaks, project quality, and reputation — and results come back in ranked order. Use whenever the user wants to find, hire, compare, or browse builders.",
      parameters: {
        type: "object",
        properties: {
          skills: {
            type: "array",
            items: { type: "string" },
            description:
              'Tech skills the project needs, e.g. ["next.js", "typescript"]. Omit to rank on overall reputation instead.',
          },
          project_description: {
            type: "string",
            description: "One-line summary of what the user is building, used for relevance matching.",
          },
          min_vibe_score: {
            type: "number",
            description: "Only include builders at or above this vibe score.",
          },
          active_only: {
            type: "boolean",
            description: "Only include builders with an active daily coding streak.",
          },
          sort: {
            type: "string",
            enum: [...SEARCH_SORTS],
            description:
              "best_match (default) blends skill overlap with the reputation evaluation; the others are simple sorts on one stat.",
          },
          limit: {
            type: "number",
            description: `How many builders to return, 1-${MAX_RESULTS} (default ${DEFAULT_RESULTS}).`,
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_builder",
      description:
        "Fetch one builder's full public profile and VibeFinder's deterministic evaluation: overall score, dimension breakdown, strengths, risks, and their top projects with GitHub quality scores. Use when a specific builder is being discussed or compared.",
      parameters: {
        type: "object",
        properties: {
          username: {
            type: "string",
            description: "The builder's VibeTalent username, without the @.",
          },
        },
        required: ["username"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_platform_stats",
      description:
        "Live VibeTalent totals: builders, projects, GitHub-verified projects, builders on an active streak, and the current top builder by vibe score.",
      parameters: { type: "object", properties: {} },
    },
  },
];

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export interface ToolExecution {
  /** JSON-serializable payload returned to the model. */
  forLLM: unknown;
  /** Card data streamed to the UI (only for builder-producing tools). */
  builders?: AgentBuilderCard[];
}

// The generated Database types don't cover every column we select (mirrors
// the `as any` idiom used by the v1 API routes).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

async function fetchBuilderPool(supabase: AnyClient): Promise<UserWithSocials[]> {
  const { data: users, error } = await supabase
    .from("users")
    .select(USER_FIELDS)
    .not("username", "is", null)
    .order("vibe_score", { ascending: false })
    .limit(POOL_SIZE);
  if (error) throw error;
  if (!users?.length) return [];

  const userIds = users.map((u: { id: string }) => u.id);
  const [{ data: projects }, { data: socials }] = await Promise.all([
    supabase
      .from("projects")
      .select(PROJECT_FIELDS)
      .in("user_id", userIds)
      .eq("flagged", false)
      .eq("is_private", false),
    supabase.from("social_links").select("user_id, telegram").in("user_id", userIds),
  ]);

  return users.map((user: UserWithSocials) => ({
    ...user,
    projects: (projects || []).filter((p: { user_id: string }) => p.user_id === user.id),
    social_links:
      (socials || []).find((s: { user_id: string }) => s.user_id === user.id) || null,
  }));
}

async function searchBuilders(supabase: AnyClient, rawArgs: unknown): Promise<ToolExecution> {
  const args = normalizeSearchArgs(rawArgs);
  let pool = await fetchBuilderPool(supabase);

  if (args.minVibeScore !== null) pool = pool.filter((u) => u.vibe_score >= args.minVibeScore!);
  if (args.activeOnly) pool = pool.filter((u) => u.streak > 0);

  let cards: AgentBuilderCard[];
  let bios: Array<string | null>;

  if (args.sort === "best_match") {
    const task: TaskRequest = {
      description: args.projectDescription || args.skills.join(" ") || "general project",
      tech_stack: args.skills,
      project_type: "mvp",
      timeline: "flexible",
      budget: "500_2k",
    };
    const matches = matchUsers(pool, task).slice(0, args.limit);
    cards = matches.map((m) => toCard(m.user, m.match_score, m.match_reasons));
    bios = matches.map((m) => m.user.bio);
  } else {
    const sorted = [...pool].sort((a, b) => {
      if (args.sort === "streak") return b.streak - a.streak;
      if (args.sort === "projects") return (b.projects?.length ?? 0) - (a.projects?.length ?? 0);
      return b.vibe_score - a.vibe_score;
    });
    const top = sorted.slice(0, args.limit);
    cards = top.map((u) => toCard(u, null, buildReasons(u)));
    bios = top.map((u) => u.bio);
  }

  return {
    forLLM: {
      query: {
        skills: args.skills,
        sort: args.sort,
        min_vibe_score: args.minVibeScore,
        active_only: args.activeOnly,
      },
      pool_considered: pool.length,
      results: cards.map((c, i) => toLLMBuilder(c, bios[i])),
    },
    builders: cards,
  };
}

async function getBuilder(supabase: AnyClient, rawArgs: unknown): Promise<ToolExecution> {
  const username = normalizeUsername(rawArgs);
  if (!username) return { forLLM: { error: "A valid username is required." } };

  // ilike with no wildcards = case-insensitive exact match.
  const { data: user, error } = await supabase
    .from("users")
    .select(USER_FIELDS)
    .ilike("username", username)
    .maybeSingle();
  if (error) throw error;
  if (!user) {
    return {
      forLLM: {
        error: `No builder named "${username}" on VibeTalent. Suggest checking the spelling or searching /explore.`,
      },
    };
  }

  const [{ data: projects }, { data: social }] = await Promise.all([
    supabase
      .from("projects")
      .select(PROJECT_FIELDS)
      .eq("user_id", user.id)
      .eq("flagged", false)
      .eq("is_private", false),
    supabase.from("social_links").select("user_id, telegram").eq("user_id", user.id).maybeSingle(),
  ]);

  const full: UserWithSocials = {
    ...user,
    projects: projects || [],
    social_links: social || null,
  };
  const evaluation = evaluateUser(full);
  const card = toCard(full, evaluation.overall_score, evaluation.strengths.slice(0, 3));

  const topProjects = [...(projects || [])]
    .sort((a, b) => (b.quality_score ?? 0) - (a.quality_score ?? 0))
    .slice(0, 3)
    .map((p) => ({
      title: p.title,
      tech: (p.tech_stack ?? []).slice(0, TECH_PREVIEW),
      quality_score: p.quality_score,
      verified: p.verified,
      has_live_url: !!p.live_url,
      endorsements: p.endorsement_count ?? 0,
    }));

  return {
    forLLM: {
      profile: toLLMBuilder(card, full.bio),
      longest_streak: full.longest_streak,
      evaluation: {
        overall_score: evaluation.overall_score,
        dimensions: evaluation.dimensions,
        strengths: evaluation.strengths,
        risks: evaluation.risks,
      },
      top_projects: topProjects,
      evaluate_page: `/agent/evaluate/${full.username}`,
      hire_page: `/agent/contact/${full.username}`,
    },
    builders: [card],
  };
}

async function getPlatformStats(supabase: AnyClient): Promise<ToolExecution> {
  const count = async (table: string, filter: (q: AnyClient) => AnyClient) => {
    const { count: n, error } = await filter(
      supabase.from(table).select("id", { count: "exact", head: true })
    );
    if (error) throw error;
    return n ?? 0;
  };

  const [builders, activeStreaks, projects, verifiedProjects, topRes] = await Promise.all([
    count("users", (q) => q.not("username", "is", null)),
    count("users", (q) => q.not("username", "is", null).gt("streak", 0)),
    count("projects", (q) => q.eq("flagged", false).eq("is_private", false)),
    count("projects", (q) => q.eq("flagged", false).eq("is_private", false).eq("verified", true)),
    supabase
      .from("users")
      .select("username, vibe_score")
      .not("username", "is", null)
      .order("vibe_score", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    forLLM: {
      total_builders: builders,
      builders_on_active_streak: activeStreaks,
      total_projects: projects,
      verified_projects: verifiedProjects,
      top_builder: topRes?.data
        ? { username: topRes.data.username, vibe_score: topRes.data.vibe_score }
        : null,
    },
  };
}

/**
 * Run one tool call from the model. Argument JSON is parsed defensively and
 * failures come back as an error payload for the model to relay — a broken
 * tool call should degrade the answer, not kill the stream.
 */
export async function executeAgentTool(
  supabase: AnyClient,
  name: string,
  argsJson: string
): Promise<ToolExecution> {
  let args: unknown = {};
  try {
    args = argsJson ? JSON.parse(argsJson) : {};
  } catch {
    args = {};
  }

  try {
    switch (name) {
      case "search_builders":
        return await searchBuilders(supabase, args);
      case "get_builder":
        return await getBuilder(supabase, args);
      case "get_platform_stats":
        return await getPlatformStats(supabase);
      default:
        return { forLLM: { error: `Unknown tool: ${name}` } };
    }
  } catch (err) {
    console.error(`Agent tool ${name} failed:`, err);
    return {
      forLLM: { error: "Live platform data is unavailable right now. Answer from general facts and say live data couldn't be reached." },
    };
  }
}
