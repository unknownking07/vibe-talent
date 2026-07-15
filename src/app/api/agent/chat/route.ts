import { NextRequest, NextResponse } from "next/server";
import { agentLimiter, checkRateLimit, getIP } from "@/lib/rate-limit";
import { hasDeepSeekKey, type ChatMessage } from "@/lib/deepseek";
import { runAgentTurn } from "@/lib/agent/run";
import type { ViewerContext } from "@/lib/agent/prompt";
import { SUPPORT_EMAIL } from "@/lib/support-knowledge";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MAX_MESSAGES = 20; // cap conversation turns sent upstream (cost control)
const MAX_CONTENT = 2000; // cap each message length

/** Validate + trim the client-supplied conversation. Drops anything malformed. */
function parseMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  const out: ChatMessage[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const role = (item as Record<string, unknown>).role;
    const content = (item as Record<string, unknown>).content;
    if (
      (role === "user" || role === "assistant") &&
      typeof content === "string" &&
      content.trim()
    ) {
      out.push({ role, content: content.slice(0, MAX_CONTENT) });
    }
  }
  return out.slice(-MAX_MESSAGES);
}

/**
 * Best-effort viewer context: if the request carries a session, the agent
 * gets the user's own public stats so "how do I improve my score?" can be
 * answered with real numbers. Anonymous chat works exactly the same minus
 * personalization.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getViewerContext(supabase: any): Promise<ViewerContext | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: row } = await supabase
      .from("users")
      .select("username, vibe_score, streak, longest_streak, badge_level")
      .eq("id", user.id)
      .maybeSingle();
    if (!row?.username) return null;

    const { count } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("flagged", false);

    return { ...row, projects_count: count ?? 0 };
  } catch {
    return null; // personalization is optional — never block the chat on it
  }
}

export async function POST(req: NextRequest) {
  const { success } = await checkRateLimit(agentLimiter, getIP(req));
  if (!success) {
    return NextResponse.json(
      { error: "You're sending messages too quickly. Give it a few seconds and try again." },
      { status: 429 }
    );
  }

  if (!hasDeepSeekKey()) {
    return NextResponse.json(
      { error: `The assistant isn't set up yet. Please email ${SUPPORT_EMAIL} and we'll help you directly.` },
      { status: 503 }
    );
  }

  let messages: ChatMessage[];
  try {
    const body = await req.json();
    messages = parseMessages(body?.messages);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (messages.length === 0) {
    return NextResponse.json({ error: "No message provided." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const viewer = await getViewerContext(supabase);

  return new Response(runAgentTurn({ supabase, history: messages, viewer }), {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
