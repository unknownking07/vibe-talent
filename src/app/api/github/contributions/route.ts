import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function parseContributions(html: string): { contributions: Record<string, number>; total: number } {
  const contributions: Record<string, number> = {};
  let total = 0;

  // GitHub contribution calendar uses <td> with data-date and data-level
  // Try multiple patterns to be resilient to GitHub HTML changes

  // Pattern 1: data-date="YYYY-MM-DD" ... data-level="N"
  const p1 = /data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"/g;
  let match;
  while ((match = p1.exec(html)) !== null) {
    contributions[match[1]] = parseInt(match[2], 10);
  }

  // Pattern 2: reversed attribute order
  if (Object.keys(contributions).length === 0) {
    const p2 = /data-level="(\d)"[^>]*data-date="(\d{4}-\d{2}-\d{2})"/g;
    while ((match = p2.exec(html)) !== null) {
      contributions[match[2]] = parseInt(match[1], 10);
    }
  }

  // Extract total from header text: "589 contributions in the last year"
  const totalMatch = html.match(/(\d[\d,]*)\s+contributions?\s+in\s+the\s+last\s+year/i);
  if (totalMatch) {
    total = parseInt(totalMatch[1].replace(/,/g, ""), 10);
  } else {
    total = Object.values(contributions).filter(v => v > 0).length;
  }

  return { contributions, total };
}

async function fetchGitHubContributions(githubUsername: string) {
  const res = await fetch(
    `https://github.com/users/${encodeURIComponent(githubUsername)}/contributions`,
    {
      headers: {
        Accept: "text/html",
        "User-Agent": "VibeTalent/1.0",
      },
    }
  );

  if (!res.ok) {
    console.error(`GitHub contributions fetch failed for ${githubUsername}: ${res.status}`);
    return { contributions: {}, total: 0 };
  }

  return parseContributions(await res.text());
}

/**
 * GET /api/github/contributions
 *
 * Two modes:
 * 1. No params → returns contributions for the logged-in user
 * 2. ?github=username → returns contributions for any public GitHub user (for profile pages)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let githubUsername = searchParams.get("github");

    if (githubUsername) {
      // Public mode: fetch for any GitHub username
      githubUsername = githubUsername
        .replace(/^@/, "")
        .replace(/^https?:\/\/(www\.)?github\.com\//, "")
        .replace(/\/+$/, "")
        .trim();

      if (!githubUsername || !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(githubUsername)) {
        return NextResponse.json({ contributions: {}, total: 0 });
      }

      const data = await fetchGitHubContributions(githubUsername);
      return NextResponse.json(data, {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
      });
    }

    // Authenticated mode: fetch for logged-in user
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sb = getServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: socials } = await (sb as any)
      .from("social_links")
      .select("github")
      .eq("user_id", user.id)
      .single();

    githubUsername = socials?.github;
    if (!githubUsername) {
      return NextResponse.json({ contributions: {}, total: 0 });
    }

    githubUsername = githubUsername
      .replace(/^@/, "")
      .replace(/^https?:\/\/(www\.)?github\.com\//, "")
      .replace(/\/+$/, "")
      .trim();

    if (!githubUsername) {
      return NextResponse.json({ contributions: {}, total: 0 });
    }

    const data = await fetchGitHubContributions(githubUsername);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, s-maxage=3600, stale-while-revalidate=7200" },
    });
  } catch (error) {
    console.error("GitHub contributions error:", error);
    return NextResponse.json({ contributions: {}, total: 0 });
  }
}
