// NDJSON event protocol between /api/agent/chat and the chat UIs.
// One JSON object per line. Client-safe module (used on both sides).

import type { AgentBuilderCard } from "./types";

export type AgentStreamEvent =
  | { type: "token"; text: string }
  | { type: "status"; label: string }
  | { type: "builders"; builders: AgentBuilderCard[] }
  | { type: "error"; message: string }
  | { type: "done" };

export function encodeAgentEvent(event: AgentStreamEvent): string {
  return JSON.stringify(event) + "\n";
}

/**
 * Parse complete NDJSON lines out of a stream buffer. Returns the decoded
 * events plus the trailing partial line to carry into the next chunk.
 * Malformed lines are skipped rather than aborting the stream.
 */
export function decodeAgentEvents(buffer: string): {
  events: AgentStreamEvent[];
  rest: string;
} {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events: AgentStreamEvent[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed.type === "string") {
        events.push(parsed as AgentStreamEvent);
      }
    } catch {
      // Skip malformed lines — better to drop one event than kill the chat.
    }
  }
  return { events, rest };
}
