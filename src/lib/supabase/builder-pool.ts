import type { Project, UserWithSocials } from "@/lib/types/database";

// Matches existing Supabase callers whose generated types lag the live schema.
interface PublicDataClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export const PUBLIC_BUILDER_FIELDS = "id, username, display_name, bio, avatar_url, github_username, vibe_score, streak, longest_streak, badge_level, created_at";
export const PUBLIC_PROJECT_FIELDS = "id, user_id, title, description, tech_stack, live_url, live_url_ok, github_url, image_url, build_time, tags, is_private, verified, quality_score, quality_metrics, endorsement_count, created_at";
const PAGE_SIZE = 200;

/** Read the entire public candidate pool before applying a hiring rank. */
export async function fetchPublicBuilderPool(supabase: PublicDataClient): Promise<UserWithSocials[]> {
  const pool: UserWithSocials[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data: users, error } = await supabase
      .from("users")
      .select(PUBLIC_BUILDER_FIELDS)
      .not("username", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!users?.length) break;

    const userIds = users.map((u: { id: string }) => u.id);
    // Page project rows too: one builder can have many projects.
    const projects: Project[] = [];
    for (let projectOffset = 0; ; projectOffset += PAGE_SIZE) {
      const { data, error: projectError } = await supabase
        .from("projects").select(PUBLIC_PROJECT_FIELDS).in("user_id", userIds)
        .eq("flagged", false).eq("is_private", false)
        .order("id", { ascending: true })
        .range(projectOffset, projectOffset + PAGE_SIZE - 1);
      if (projectError) throw projectError;
      projects.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
    }
    const { data: socials, error: socialError } = await supabase
      .from("social_links").select("id, user_id, twitter, telegram, github, website, farcaster").in("user_id", userIds);
    // Failed reads must never silently turn into empty portfolios.
    if (socialError) throw socialError;
    pool.push(...users.map((user: UserWithSocials) => ({
      ...user,
      projects: projects.filter((p: { user_id: string }) => p.user_id === user.id),
      social_links: (socials || []).find((s: { user_id: string }) => s.user_id === user.id) || null,
    })));
    if (users.length < PAGE_SIZE) break;
  }
  return pool;
}
