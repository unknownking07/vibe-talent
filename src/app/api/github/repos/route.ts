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

    const options = { headers, signal: AbortSignal.timeout(8000), cache: "no-store" as const };
    let currentIdentity = identity;
    if (identity.id !== null) {
      // The OAuth username can be stale after a GitHub rename. Numeric IDs
      // remain stable, and also prevent a reclaimed handle listing the wrong
      // account's repositories.
      const ownerResponse = await fetch(`https://api.github.com/user/${identity.id}`, options);
      if (!ownerResponse.ok) {
        return NextResponse.json({ error: "Could not verify your GitHub account." }, { status: 502 });
      }
      const owner: unknown = await ownerResponse.json();
      if (
        !owner || typeof owner !== "object" ||
        (owner as Record<string, unknown>).id !== identity.id ||
        typeof (owner as Record<string, unknown>).login !== "string"
      ) {
        return NextResponse.json({ error: "Could not verify your GitHub account." }, { status: 502 });
      }
      currentIdentity = { ...identity, username: (owner as { login: string }).login };
    }

    const response = await fetch(
      `https://api.github.com/users/${encodeURIComponent(currentIdentity.username)}/repos?type=owner&sort=updated&direction=desc&per_page=100`,
      options,
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
    return NextResponse.json({ repos: toRepoPickerOptions(raw, currentIdentity) });
  } catch (error) {
    console.error("GitHub repo picker failed", error);
    return NextResponse.json({ error: "Could not load GitHub repositories." }, { status: 502 });
  }
}
