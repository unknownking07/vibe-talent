import { NextRequest, NextResponse } from "next/server";
import { supportLimiter, checkRateLimit, getIP } from "@/lib/rate-limit";
import { streamDeepSeekChat, type ChatMessage } from "@/lib/deepseek";
import { SUPPORT_SYSTEM_PROMPT, SUPPORT_EMAIL } from "@/lib/support-knowledge";

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

export async function POST(req: NextRequest) {
  const { success } = await checkRateLimit(supportLimiter, getIP(req));
  if (!success) {
    return NextResponse.json(
      { error: "You're sending messages too quickly. Give it a few seconds and try again." },
      { status: 429 }
    );
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json(
      { error: `Support chat isn't set up yet. Please email ${SUPPORT_EMAIL} and we'll help you directly.` },
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

  try {
    const stream = await streamDeepSeekChat([
      { role: "system", content: SUPPORT_SYSTEM_PROMPT },
      ...messages,
    ]);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Support chat error:", err);
    return NextResponse.json(
      { error: "The assistant is having trouble right now. Please try again in a moment." },
      { status: 502 }
    );
  }
}
