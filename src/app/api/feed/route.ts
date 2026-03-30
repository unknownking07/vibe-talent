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
  type: "push" | "pr" | "create" | "issue" | "project";
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
    const supabase = getPublicClient();

    // Fetch GitHub events from feed_events table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: events, error: eventsError } = await (supabase as any)
      .from("feed_events")
      .select("id, event_type, repo_name, message, github_url, created_at, user_id, users!inner(username, avatar_url, badge_level, streak)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (eventsError) console.error("Feed: feed_events fetch error:", eventsError);

    // Fetch recent projects with user info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: projects, error: projectError } = await (supabase as any)
      .from("projects")
      .select("id, title, description, tech_stack, live_url, github_url, created_at, user_id, users!inner(username, avatar_url, badge_level, streak)")
      .eq("flagged", false)
      .order("created_at", { ascending: false })
      .limit(20);

    if (projectError) console.error("Feed: projects fetch error:", projectError);

    const feed: FeedItem[] = [];

    // Map GitHub events to feed items
    if (events) {
      for (const event of events) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = event.users as any;
        if (!user?.username) continue;
        feed.push({
          id: `event-${event.id}`,
          type: event.event_type || "push",
          username: user.username,
          avatar_url: user.avatar_url || null,
          badge_level: user.badge_level || "none",
          streak: user.streak || 0,
          date: event.created_at,
          repo_name: event.repo_name,
          message: event.message,
          github_url: event.github_url,
        });
      }
    }

    // Map projects to feed items
    if (projects) {
      for (const project of projects) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = project.users as any;
        if (!user?.username) continue;
        feed.push({
          id: `project-${project.id}`,
          type: "project",
          username: user.username,
          avatar_url: user.avatar_url || null,
          badge_level: user.badge_level || "none",
          streak: user.streak || 0,
          date: project.created_at,
          project_title: project.title,
          project_description: project.description,
          tech_stack: project.tech_stack || [],
          live_url: project.live_url || undefined,
          github_url: project.github_url || undefined,
        });
      }
    }

    // Fallback: if no feed_events yet, use streak_logs
    if (!events || events.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: streakLogs } = await (supabase as any)
        .from("streak_logs")
        .select("id, activity_date, user_id, users!inner(username, avatar_url, badge_level, streak)")
        .order("activity_date", { ascending: false })
        .limit(50);

      if (streakLogs) {
        for (const log of streakLogs) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const user = log.users as any;
          if (!user?.username) continue;
          feed.push({
            id: `streak-${log.id}`,
            type: "push",
            username: user.username,
            avatar_url: user.avatar_url || null,
            badge_level: user.badge_level || "none",
            streak: user.streak || 0,
            date: log.activity_date,
            message: "logged a coding day",
          });
        }
      }
    }

    feed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json(
      { feed: feed.slice(0, limit) },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
    );
  } catch (err) {
    console.error("Feed API error:", err);
    return NextResponse.json({ feed: [] });
  }
}
