import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const FETCH_TIMEOUT_MS = 8000;

function parseContributions(html: string): { contributions: Record<string, number>; total: number } {
  const contributions: Record<string, number> = {};

  // Step 1: collect every day cell, capturing both date and data-level (the
  // 0-4 color bucket). Iterating opening <td> tags first then extracting
  // attributes from each tag handles any attribute ordering GitHub uses.
  const cellInfo = new Map<string, { date: string; level: number }>();
  const tdRe = /<td\b[^>]*\bdata-date="\d{4}-\d{2}-\d{2}"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = tdRe.exec(html)) !== null) {
    const tag = m[0];
    const dateMatch = tag.match(/\bdata-date="(\d{4}-\d{2}-\d{2})"/);
    const idMatch = tag.match(/\bid="(contribution-day-component-\d+-\d+)"/);
    const levelMatch = tag.match(/\bdata-level="(\d)"/);
    if (dateMatch && idMatch) {
      cellInfo.set(idMatch[1], {
        date: dateMatch[1],
        level: levelMatch ? parseInt(levelMatch[1], 10) : 0,
      });
    }
  }

  // Step 2: pull real per-day counts from the sibling <tool-tip> blocks.
  // GitHub renders one per cell: "8 contributions on May 4th." or
  // "No contributions on April 30th." The td's data-level is only a color
  // bucket and is wrong as a count — so prefer tool-tip when available.
  const tooltipCounts = new Map<string, number>();
  const tipRe = /<tool-tip\b[^>]*\sfor="(contribution-day-component-\d+-\d+)"[^>]*>([^<]+)</g;
  while ((m = tipRe.exec(html)) !== null) {
    const numMatch = m[2].trim().match(/^(\d[\d,]*|No)\s+contribution/i);
    if (!numMatch) continue;
    tooltipCounts.set(
      m[1],
      numMatch[1].toLowerCase() === "no"
        ? 0
        : parseInt(numMatch[1].replace(/,/g, ""), 10)
    );
  }

  // Step 3: per-cell merge. If a cell has a tool-tip count, use it (real
  // number). Otherwise fall back to that specific cell's data-level — wrong
  // scale but at least preserves heatmap shading. This makes partial parse
  // failures degrade per-cell instead of either-or-nothing.
  for (const [id, { date, level }] of cellInfo.entries()) {
    const tipCount = tooltipCounts.get(id);
    contributions[date] = tipCount !== undefined ? tipCount : level;
  }

  // Step 4: last-resort fallback if no <td data-date> matched at all
  // (GitHub HTML structure changed). Old date-level regex.
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://github.com/users/${encodeURIComponent(githubUsername)}/contributions`,
      {
        headers: {
          Accept: "text/html",
          "User-Agent": "VibeTalent/1.0",
        },
        signal: controller.signal,
      }
    );

    if (!res.ok) {
      console.error(`GitHub contributions fetch failed for ${githubUsername}: ${res.status}`);
      return { contributions: {}, total: 0 };
    }

    return parseContributions(await res.text());
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`GitHub contributions fetch timed out for ${githubUsername} after ${FETCH_TIMEOUT_MS}ms`);
    } else {
      console.error(`GitHub contributions fetch errored for ${githubUsername}:`, err);
    }
    return { contributions: {}, total: 0 };
  } finally {
    clearTimeout(timeoutId);
  }
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
