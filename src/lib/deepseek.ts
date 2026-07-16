// Server-only DeepSeek client.
//
// DeepSeek exposes an OpenAI-compatible Chat Completions API, so we call it
// with plain `fetch` — no SDK, no added bundle weight, and it runs cleanly on
// the Cloudflare Workers runtime (WHATWG streams are native there).
//
// Swapping providers later (e.g. Cloudflare Workers AI once the DeepSeek
// credit runs out) is a change to this one file — nothing else imports the
// provider directly.

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat"; // V3: fast + cheap, supports function calling.

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface CompletionResult {
  content: string;
  toolCalls: ToolCall[];
}

/** Whether the DeepSeek API key is configured on the server. */
export function hasDeepSeekKey(): boolean {
  return !!process.env.DEEPSEEK_API_KEY;
}

// Tool calls stream as fragments: the first delta for an index carries id +
// name, later ones append to the JSON `arguments` string. Exported for tests.
export interface ToolCallDelta {
  index: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

export function mergeToolCallDelta(acc: ToolCall[], delta: ToolCallDelta): void {
  const i = delta.index;
  if (!acc[i]) {
    acc[i] = { id: "", type: "function", function: { name: "", arguments: "" } };
  }
  if (delta.id) acc[i].id = delta.id;
  if (delta.function?.name) acc[i].function.name += delta.function.name;
  if (delta.function?.arguments) acc[i].function.arguments += delta.function.arguments;
}

/**
 * Stream one chat completion from DeepSeek.
 *
 * Assistant text deltas are pushed to `onToken` as they arrive; tool-call
 * fragments are assembled silently. Resolves once the stream ends with the
 * full text and any completed tool calls, so the caller can run the tools and
 * loop, or finish.
 *
 * Throws if the key is missing or DeepSeek returns a non-OK status.
 */
export async function streamDeepSeekCompletion(opts: {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  toolChoice?: "auto" | "none";
  maxTokens?: number;
  temperature?: number;
  onToken: (token: string) => void;
}): Promise<CompletionResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured");

  const upstream = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: opts.messages,
      stream: true,
      temperature: opts.temperature ?? 0.3, // factual, low creativity
      max_tokens: opts.maxTokens ?? 700,
      ...(opts.tools?.length
        ? { tools: opts.tools, tool_choice: opts.toolChoice ?? "auto" }
        : {}),
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(
      `DeepSeek request failed (${upstream.status}): ${detail.slice(0, 200)}`
    );
  }

  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();
  let buffer = "";
  let content = "";
  const toolCalls: ToolCall[] = [];

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const data = trimmed.slice(5).trim();
    if (data === "[DONE]") return;
    try {
      const json = JSON.parse(data);
      const delta = json.choices?.[0]?.delta;
      if (!delta) return;
      if (typeof delta.content === "string" && delta.content) {
        content += delta.content;
        opts.onToken(delta.content);
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) mergeToolCallDelta(toolCalls, tc);
      }
    } catch {
      // Ignore keep-alive pings / non-JSON lines.
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep any trailing partial line for the next chunk
    for (const line of lines) handleLine(line);
  }
  if (buffer) handleLine(buffer);

  // Sparse slots are possible if the provider skips an index — drop them.
  return { content, toolCalls: toolCalls.filter(Boolean) };
}
