import { ImageResponse } from "next/og";
import { ActivitySocialCard, ProjectSocialCard, SOCIAL_CARD_SIZE, WeeklySocialCard } from "@/components/share/social-card-image";
import { fetchUserByUsernameCached } from "@/lib/supabase/server-queries";
import { fetchActivityDays, rollingWindow, weeklyWindow } from "@/lib/share-card-data";
import { mondayOf } from "@/lib/cron-jobs/weekly-snapshot";
import { getShareCardLogo } from "@/lib/share-card-assets";

type Params = { params: Promise<{ type: string; username: string }> };

export async function GET(request: Request, { params }: Params) {
  const { type, username } = await params;
  if (type !== "weekly" && type !== "shipped" && type !== "custom") {
    return new Response("Not found", { status: 404 });
  }
  const user = await fetchUserByUsernameCached(username);
  if (!user) return new Response("Not found", { status: 404 });
  const logoSrc = await getShareCardLogo(request.url);

  const url = new URL(request.url);
  let card: React.ReactElement;
  let cacheControl = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

  if (type === "weekly") {
    const week = url.searchParams.get("w") ?? mondayOf(new Date()).toISOString().slice(0, 10);
    const window = weeklyWindow(week);
    if (!window) return new Response("Invalid week", { status: 400 });
    let activeDays: number;
    try {
      activeDays = await fetchActivityDays(user.id, window.start, window.end);
    } catch (error) {
      console.error("Weekly card activity failed:", error);
      return new Response("Activity unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    const projects = (user.projects ?? []).filter((project) => project.created_at.slice(0, 10) >= window.start && project.created_at.slice(0, 10) < window.end).length;
    card = <WeeklySocialCard logoSrc={logoSrc} username={user.username} weekLabel={window.label} activeDays={activeDays} projects={projects} streak={user.streak} vibeScore={user.vibe_score} />;
    // The week window is fixed, while the current score and projects can still
    // change. A short TTL also lets a late GitHub sync fill its missed days.
    cacheControl = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";
  } else if (type === "shipped") {
    const slug = url.searchParams.get("slug");
    const project = (user.projects ?? []).find((item) => item.id === slug && item.verified);
    if (!project) return new Response("Project not found", { status: 404 });
    card = <ProjectSocialCard logoSrc={logoSrc} username={user.username} title={project.title} qualityScore={project.quality_score && project.quality_score > 0 ? project.quality_score : null} stack={project.tech_stack ?? []} />;
  } else {
    const range = url.searchParams.get("range") ?? "30d";
    if (range !== "7d" && range !== "30d" && range !== "all") return new Response("Invalid range", { status: 400 });
    const window = range === "all" ? null : rollingWindow(range === "7d" ? 7 : 30);
    let activeDays: number;
    try {
      activeDays = await fetchActivityDays(user.id, window?.start, window?.end);
    } catch (error) {
      console.error("Activity card data failed:", error);
      return new Response("Activity unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    const projects = (user.projects ?? []).filter((project) => !window || (project.created_at.slice(0, 10) >= window.start && project.created_at.slice(0, 10) < window.end)).length;
    card = <ActivitySocialCard logoSrc={logoSrc} username={user.username} period={range === "all" ? "All time" : `Last ${range.slice(0, -1)} days`} activeDays={activeDays} projects={projects} vibeScore={user.vibe_score} streak={user.streak} />;
    cacheControl = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";
  }

  return new ImageResponse(card, {
    ...SOCIAL_CARD_SIZE,
    headers: { "Cache-Control": cacheControl },
  });
}
