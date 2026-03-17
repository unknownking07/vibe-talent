import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// GET /api/projects — List projects
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ projects: [] });
    }

    return NextResponse.json({ projects: data || [] });
  } catch {
    return NextResponse.json({ projects: [] });
  }
}

// POST /api/projects — Create a project
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const body = await request.json();
    const { user_id, title, description, tech_stack, live_url, github_url, build_time, tags } = body;

    if (!user_id || !title || !description) {
      return NextResponse.json(
        { error: "user_id, title, and description are required" },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from("projects").insert({
      user_id,
      title,
      description,
      tech_stack: tech_stack || [],
      live_url: live_url || null,
      github_url: github_url || null,
      build_time: build_time || null,
      tags: tags || [],
    }).select().single();

    if (error) {
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }

    return NextResponse.json({ project: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
