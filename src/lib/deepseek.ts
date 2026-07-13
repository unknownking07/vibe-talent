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
const MODEL = "deepseek-chat"; // V3: fast + cheap. deepseek-reasoner is overkill for support.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Whether the DeepSeek API key is configured on the server. */
export function hasDeepSeekKey(): boolean {
  return !!process.env.DEEPSEEK_API_KEY;
}

/**
 * Stream a chat completion from DeepSeek.
 *
 * Returns a ReadableStream of plain-text tokens (the assistant's message
 * deltas), so the browser can append them directly without parsing SSE.
 *
 * Throws if the key is missing or DeepSeek returns a non-OK status.
 */
export async function streamDeepSeekChat(
  messages: ChatMessage[]
): Promise<ReadableStream<Uint8Array>> {
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
      messages,
      stream: true,
      temperature: 0.3, // factual, low creativity for support answers
      max_tokens: 800,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(
      `DeepSeek request failed (${upstream.status}): ${detail.slice(0, 200)}`
    );
  }

  // Transform DeepSeek's SSE stream into a plain-text token stream.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return upstream.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep any trailing partial line for the next chunk

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const token = json.choices?.[0]?.delta?.content;
            if (typeof token === "string" && token) {
              controller.enqueue(encoder.encode(token));
            }
          } catch {
            // Ignore keep-alive pings / non-JSON lines.
          }
        }
      },
    })
  );
}
