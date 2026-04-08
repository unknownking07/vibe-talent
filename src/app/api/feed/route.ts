import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { feedLimiter, checkRateLimit, getIP } from "@/lib/rate-limit";

function getPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type FeedItem = {
  id: string;
  type: "push" | "pr" | "create" | "issue" | "project" | "streak" | "joined";
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  badge_level: string;
  streak: number;
  github_verified: boolean;
  date: string;
  repo_name?: string;
  message?: string;
  github_url?: string;
  project_title?: string;
  project_description?: string;
  tech_stack?: string[];
  live_url?: string;
};

export async function GET(request: NextRequest) {
  const rawLimit = parseInt(request.nextUrl.searchParams.get("limit") || "100");
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 100 : rawLimit, 1), 200);

  const { success } = await checkRateLimit(feedLimiter, getIP(request));
  if (!success) {
    return NextResponse.json({ feed: [], error: "Rate limited" }, { status: 429 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getPublicClient() as any;
    const feed: FeedItem[] = [];

    // Run all queries in parallel instead of sequentially
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [usersResult, eventsResult, streakResult, projectsResult, recentUsersResult] = await Promise.all([
      supabase.from("users").select("id, username, display_name, avatar_url, badge_level, streak, github_username").order("vibe_score", { ascending: false }).limit(200),
      supabase.from("feed_events").select("id, event_type, repo_name, message, github_url, created_at, user_id").order("created_at", { ascending: false }).limit(200).then(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any) => r, () => ({ data: null, error: "feed_events not available" })
      ),
      supabase.from("streak_logs").select("id, activity_date, user_id").order("activity_date", { ascending: false }).limit(100),
      supabase.from("projects").select("id, title, description, tech_stack, live_url, github_url, created_at, user_id").eq("flagged", false).order("created_at", { ascending: false }).limit(30),
      supabase.from("users").select("id, username, display_name, avatar_url, badge_level, streak, created_at, github_username").order("created_at", { ascending: false }).limit(50),
    ]);

    // Build user lookup map
    const userMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null; badge_level: string; streak: number; github_verified: boolean }>();
    for (const u of (usersResult.data || [])) {
      userMap.set(u.id, { username: u.username, display_name: u.display_name || null, avatar_url: u.avatar_url, badge_level: u.badge_level || "none", streak: u.streak || 0, github_verified: Boolean(u.github_username) });
    }

    // 1. Process GitHub events
    if (eventsResult.data && !eventsResult.error) {
      for (const event of eventsResult.data) {
        const user = userMap.get(event.user_id);
        if (!user) continue;
        feed.push({
          id: `event-${event.id}`,
          type: event.event_type || "push",
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          badge_level: user.badge_level,
          streak: user.streak,
          github_verified: user.github_verified,
          date: event.created_at,
          repo_name: event.repo_name,
          message: event.message,
          github_url: event.github_url,
        });
      }
    }

    // 2. Process streak logs (dedup against feed_events)
    const coveredDates = new Set(
      feed.map(f => f.username + "|" + f.date.slice(0, 10))
    );

    for (const log of (streakResult.data || [])) {
      const user = userMap.get(log.user_id);
      if (!user) continue;
      const key = user.username + "|" + log.activity_date;
      if (coveredDates.has(key)) continue;
      coveredDates.add(key);
      feed.push({
        id: `streak-${log.id}`,
        type: "streak",
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        badge_level: user.badge_level,
        streak: user.streak,
        github_verified: user.github_verified,
        date: log.activity_date,
        message: "logged a day of coding",
      });
    }

    // 3. Process projects
    for (const project of (projectsResult.data || [])) {
      const user = userMap.get(project.user_id);
      if (!user) continue;
      feed.push({
        id: `project-${project.id}`,
        type: "project",
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        badge_level: user.badge_level,
        streak: user.streak,
        github_verified: user.github_verified,
        date: project.created_at,
        project_title: project.title,
        project_description: project.description,
        tech_stack: project.tech_stack || [],
        live_url: project.live_url || undefined,
        github_url: project.github_url || undefined,
      });
    }

    // 4. Process recent signups
    for (const user of (recentUsersResult.data || [])) {
      feed.push({
        id: `joined-${user.id}`,
        type: "joined",
        username: user.username,
        display_name: user.display_name || null,
        avatar_url: user.avatar_url,
        badge_level: user.badge_level || "none",
        streak: user.streak || 0,
        github_verified: Boolean(user.github_username),
        date: user.created_at,
        message: "joined VibeTalent",
      });
    }

    feed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json(
      { feed: feed.slice(0, limit) },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
    );
  } catch (err) {
    console.error("Feed API error:", err);
    return NextResponse.json({ feed: [], error: "Failed to load feed" });
  }
}
