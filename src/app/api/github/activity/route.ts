import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { messagesLimiter, getIP, checkRateLimit } from "@/lib/rate-limit";

const QUALIFYING_EVENTS = ["PushEvent", "CreateEvent", "PullRequestEvent", "IssuesEvent"];

export async function POST(req: NextRequest) {
  // Rate limit GitHub sync: 60/min per IP (prevents hammering GitHub API)
  const { success } = await checkRateLimit(messagesLimiter, getIP(req));
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only use OAuth-verified github_username. Never trust social_links.github
    // for streak sync — it's a free-text field and could be spoofed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from("users")
      .select("github_username")
      .eq("id", user.id)
      .single();

    const githubUsername = profile?.github_username;

    if (!githubUsername) {
      return NextResponse.json(
        { error: "GitHub ownership not verified. Connect your GitHub account in settings to enable streak sync." },
        { status: 400 }
      );
    }

    // Clean the username (remove @ prefix or URL)
    const cleanUsername = githubUsername
      .replace(/^@/, "")
      .replace(/^https?:\/\/github\.com\//, "")
      .replace(/\/$/, "")
      .trim();

    if (!cleanUsername) {
      return NextResponse.json({ error: "Invalid GitHub username" }, { status: 400 });
    }

    // Fetch public events from GitHub API (no auth needed, 60 req/hr limit)
    const response = await fetch(
      `https://api.github.com/users/${encodeURIComponent(cleanUsername)}/events/public?per_page=100`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "VibeTalent/1.0",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: `GitHub user "${cleanUsername}" not found` },
          { status: 404 }
        );
      }
      if (response.status === 403) {
        return NextResponse.json(
          { error: "GitHub API rate limit exceeded. Try again later." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch GitHub activity" },
        { status: 502 }
      );
    }

    const events = await response.json();

    // Filter qualifying events from the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEvents = events.filter(
      (event: { type: string; created_at: string }) =>
        QUALIFYING_EVENTS.includes(event.type) &&
        new Date(event.created_at) > oneDayAgo
    );

    if (recentEvents.length === 0) {
      return NextResponse.json({
        synced: false,
        events_found: 0,
        message: "No qualifying GitHub activity found in the last 24 hours.",
      });
    }

    // Extract unique activity dates from events
    const activityDates = [
      ...new Set(
        recentEvents.map((event: { created_at: string }) =>
          new Date(event.created_at).toISOString().split("T")[0]
        )
      ),
    ];

    // Upsert streak_logs for each activity date
    let loggedCount = 0;
    for (const activityDate of activityDates) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("streak_logs")
        .upsert(
          { user_id: user.id, activity_date: activityDate },
          { onConflict: "user_id,activity_date" }
        );

      if (!error) loggedCount++;
    }

    return NextResponse.json({
      synced: true,
      events_found: recentEvents.length,
      dates_logged: loggedCount,
      activity_dates: activityDates,
      message: `Found ${recentEvents.length} GitHub events. Logged activity for ${loggedCount} day(s).`,
    });
  } catch (error) {
    console.error("GitHub activity sync error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
