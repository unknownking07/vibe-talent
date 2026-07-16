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

/** Shape-check one decoded line so a malformed event can't crash a consumer. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAgentEvent(parsed: any): parsed is AgentStreamEvent {
  if (!parsed || typeof parsed !== "object") return false;
  switch (parsed.type) {
    case "token":
      return typeof parsed.text === "string";
    case "status":
      return typeof parsed.label === "string";
    case "builders":
      return Array.isArray(parsed.builders);
    case "error":
      return typeof parsed.message === "string";
    case "done":
      return true;
    default:
      return false;
  }
}

/**
 * Parse complete NDJSON lines out of a stream buffer. Returns the decoded
 * events plus the trailing partial line to carry into the next chunk.
 * Malformed or unknown-shaped lines are skipped rather than aborting the
 * stream.
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
      if (isAgentEvent(parsed)) events.push(parsed);
    } catch {
      // Skip malformed lines — better to drop one event than kill the chat.
    }
  }
  return { events, rest };
}
