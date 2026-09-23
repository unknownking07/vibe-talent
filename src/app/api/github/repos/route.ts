import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { readGithubIdentity } from "@/lib/github-identity";
import { toRepoPickerOptions } from "@/lib/github-repo-picker";
import { checkRateLimit, getIP, projectsLimiter } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Sign in to see your repositories." }, { status: 401 });
  }

  const identity = readGithubIdentity(user);
  if (!identity) {
    return NextResponse.json({ error: "Connect GitHub to browse your repositories." }, { status: 409 });
  }

  const { success } = await checkRateLimit(projectsLimiter, getIP(request));
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "VibeTalent/1.0",
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(
      `https://api.github.com/users/${encodeURIComponent(identity.username)}/repos?type=owner&sort=updated&direction=desc&per_page=100`,
      { headers, signal: AbortSignal.timeout(8000), cache: "no-store" },
    );
    if (response.status === 403 || response.status === 429) {
      return NextResponse.json({ error: "GitHub is busy. Try again in a moment." }, { status: 503 });
    }
    if (!response.ok) {
      return NextResponse.json({ error: "Could not load GitHub repositories." }, { status: 502 });
    }

    const raw: unknown = await response.json();
    if (!Array.isArray(raw)) {
      return NextResponse.json({ error: "Unexpected response from GitHub." }, { status: 502 });
    }
    return NextResponse.json({ repos: toRepoPickerOptions(raw, identity) });
  } catch (error) {
    console.error("GitHub repo picker failed", error);
    return NextResponse.json({ error: "Could not load GitHub repositories." }, { status: 502 });
  }
}
