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
  type: "streak" | "project";
  username: string;
  avatar_url: string | null;
  badge_level: string;
  streak: number;
  date: string;
  project_title?: string;
  project_description?: string;
  tech_stack?: string[];
  live_url?: string;
  github_url?: string;
};

export async function GET(request: NextRequest) {
  const rawLimit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);

  try {
    const supabase = getPublicClient();

    const { data: streakLogs, error: streakError } = await supabase
      .from("streak_logs")
      .select("id, activity_date, user_id, users!inner(username, avatar_url, badge_level, streak)")
      .order("activity_date", { ascending: false })
      .limit(100);

    if (streakError) console.error("Feed: streak_logs fetch error:", streakError);

    const { data: projects, error: projectError } = await supabase
      .from("projects")
      .select("id, title, description, tech_stack, live_url, github_url, created_at, user_id, users!inner(username, avatar_url, badge_level, streak)")
      .eq("flagged", false)
      .order("created_at", { ascending: false })
      .limit(20);

    if (projectError) console.error("Feed: projects fetch error:", projectError);

    const feed: FeedItem[] = [];

    if (streakLogs) {
      for (const log of streakLogs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = log.users as any;
        if (!user?.username) continue;
        feed.push({
          id: `streak-${log.id}`,
          type: "streak",
          username: user.username,
          avatar_url: user.avatar_url || null,
          badge_level: user.badge_level || "none",
          streak: user.streak || 0,
          date: log.activity_date,
        });
      }
    }

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
