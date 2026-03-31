import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type FeedItem = {
  id: string;
  type: "push" | "pr" | "create" | "issue" | "project" | "streak";
  username: string;
  avatar_url: string | null;
  badge_level: string;
  streak: number;
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

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getPublicClient() as any;
    const feed: FeedItem[] = [];

    // Build user lookup map — limit to recent/active users to reduce DB load
    const { data: allUsers } = await supabase
      .from("users")
      .select("id, username, avatar_url, badge_level, streak")
      .order("vibe_score", { ascending: false })
      .limit(200);
    const userMap = new Map<string, { username: string; avatar_url: string | null; badge_level: string; streak: number }>();
    for (const u of (allUsers || [])) {
      userMap.set(u.id, { username: u.username, avatar_url: u.avatar_url, badge_level: u.badge_level || "none", streak: u.streak || 0 });
    }

    // 1. Fetch detailed GitHub events from feed_events
    try {
      const { data: events, error: eventsError } = await supabase
        .from("feed_events")
        .select("id, event_type, repo_name, message, github_url, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!eventsError && events) {
        for (const event of events) {
          const user = userMap.get(event.user_id);
          if (!user) continue;
          feed.push({
            id: `event-${event.id}`,
            type: event.event_type || "push",
            username: user.username,
            avatar_url: user.avatar_url,
            badge_level: user.badge_level,
            streak: user.streak,
            date: event.created_at,
            repo_name: event.repo_name,
            message: event.message,
            github_url: event.github_url,
          });
        }
      }
    } catch {
      // feed_events table may not exist yet
    }

    // 2. ALWAYS include streak_logs for historical depth
    // These go back weeks while feed_events only has data since today
    const { data: streakLogs } = await supabase
      .from("streak_logs")
      .select("id, activity_date, user_id")
      .order("activity_date", { ascending: false })
      .limit(100);

    // Build set of user+date combos from feed_events to avoid duplicates
    const coveredDates = new Set(
      feed.map(f => f.username + "|" + f.date.slice(0, 10))
    );

    for (const log of (streakLogs || [])) {
      const user = userMap.get(log.user_id);
      if (!user) continue;
      // Skip if feed_events already covers this user on this date
      const key = user.username + "|" + log.activity_date;
      if (coveredDates.has(key)) continue;
      coveredDates.add(key); // also dedup within streak_logs
      feed.push({
        id: `streak-${log.id}`,
        type: "streak",
        username: user.username,
        avatar_url: user.avatar_url,
        badge_level: user.badge_level,
        streak: user.streak,
        date: log.activity_date,
        message: "logged a coding day",
      });
    }

    // 3. Always include recent projects
    const { data: projects } = await supabase
      .from("projects")
      .select("id, title, description, tech_stack, live_url, github_url, created_at, user_id")
      .eq("flagged", false)
      .order("created_at", { ascending: false })
      .limit(30);

    for (const project of (projects || [])) {
      const user = userMap.get(project.user_id);
      if (!user) continue;
      feed.push({
        id: `project-${project.id}`,
        type: "project",
        username: user.username,
        avatar_url: user.avatar_url,
        badge_level: user.badge_level,
        streak: user.streak,
        date: project.created_at,
        project_title: project.title,
        project_description: project.description,
        tech_stack: project.tech_stack || [],
        live_url: project.live_url || undefined,
        github_url: project.github_url || undefined,
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
