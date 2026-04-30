import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function parseContributions(html: string): { contributions: Record<string, number>; total: number } {
  const contributions: Record<string, number> = {};

  // GitHub renders one <td> per day with a stable id, plus a sibling <tool-tip>
  // whose text contains the real count ("8 contributions on May 4th."). The
  // td's data-level is only a 0-4 color bucket — using it as the count is the
  // bug we're fixing here.
  const idToDate = new Map<string, string>();
  let m: RegExpExecArray | null;

  const td1 = /<td\b[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*id="(contribution-day-component-\d+-\d+)"/g;
  while ((m = td1.exec(html)) !== null) {
    idToDate.set(m[2], m[1]);
  }
  if (idToDate.size === 0) {
    const td2 = /<td\b[^>]*id="(contribution-day-component-\d+-\d+)"[^>]*data-date="(\d{4}-\d{2}-\d{2})"/g;
    while ((m = td2.exec(html)) !== null) {
      idToDate.set(m[1], m[2]);
    }
  }

  // <tool-tip for="ID" ...>N contributions on Month Dth.</tool-tip>
  const tipRe = /<tool-tip\b[^>]*\sfor="(contribution-day-component-\d+-\d+)"[^>]*>([^<]+)</g;
  while ((m = tipRe.exec(html)) !== null) {
    const date = idToDate.get(m[1]);
    if (!date) continue;
    const numMatch = m[2].trim().match(/^(\d[\d,]*|No)\s+contribution/i);
    if (!numMatch) continue;
    contributions[date] = numMatch[1].toLowerCase() === "no"
      ? 0
      : parseInt(numMatch[1].replace(/,/g, ""), 10);
  }

  // Fallback: if no tool-tip parse hit (GitHub HTML changed), degrade to the
  // old data-level scrape so the heatmap still renders colors — counts will
  // be wrong but the calendar won't go blank.
  if (Object.keys(contributions).length === 0) {
    const p1 = /data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"/g;
    while ((m = p1.exec(html)) !== null) {
      contributions[m[1]] = parseInt(m[2], 10);
    }
    if (Object.keys(contributions).length === 0) {
      const p2 = /data-level="(\d)"[^>]*data-date="(\d{4}-\d{2}-\d{2})"/g;
      while ((m = p2.exec(html)) !== null) {
        contributions[m[2]] = parseInt(m[1], 10);
      }
    }
  }

  let total = 0;
  const totalMatch = html.match(/(\d[\d,]*)\s+contributions?\s+in\s+the\s+last\s+year/i);
  if (totalMatch) {
    total = parseInt(totalMatch[1].replace(/,/g, ""), 10);
  } else {
    total = Object.values(contributions).reduce((sum, v) => sum + (v > 0 ? v : 0), 0);
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

    const sb = createAdminClient();
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
