import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Throttle: only trigger sync every 30 min per serverless instance
let lastSyncTrigger = 0;
const SYNC_INTERVAL = 30 * 60 * 1000;

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
  const rawLimit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);

  try {
    // Trigger github-sync in background if stale (fire-and-forget)
    const now = Date.now();
    if (now - lastSyncTrigger > SYNC_INTERVAL) {
      lastSyncTrigger = now;
      const baseUrl = request.nextUrl.origin || "https://www.vibetalent.work";
      const cronSecret = process.env.CRON_SECRET;
      if (cronSecret) {
        fetch(`${baseUrl}/api/cron/github-sync`, {
          headers: { Authorization: `Bearer ${cronSecret}` },
        }).catch(() => {});
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getPublicClient() as any;
    const feed: FeedItem[] = [];

    // Build user lookup map
    const { data: allUsers } = await supabase
      .from("users")
      .select("id, username, avatar_url, badge_level, streak");
    const userMap = new Map<string, { username: string; avatar_url: string | null; badge_level: string; streak: number }>();
    for (const u of (allUsers || [])) {
      userMap.set(u.id, { username: u.username, avatar_url: u.avatar_url, badge_level: u.badge_level || "none", streak: u.streak || 0 });
    }

    // Try feed_events first (may not exist yet or be empty)
    let hasFeedEvents = false;
    try {
      const { data: events, error: eventsError } = await supabase
        .from("feed_events")
        .select("id, event_type, repo_name, message, github_url, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!eventsError && events && events.length > 0) {
        hasFeedEvents = true;
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

    // Fallback: if no feed_events, use streak_logs
    if (!hasFeedEvents) {
      const { data: streakLogs } = await supabase
        .from("streak_logs")
        .select("id, activity_date, user_id")
        .order("activity_date", { ascending: false })
        .limit(100);

      for (const log of (streakLogs || [])) {
        const user = userMap.get(log.user_id);
        if (!user) continue;
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
    }

    // Always include recent projects
    const { data: projects } = await supabase
      .from("projects")
      .select("id, title, description, tech_stack, live_url, github_url, created_at, user_id")
      .eq("flagged", false)
      .order("created_at", { ascending: false })
      .limit(20);

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
