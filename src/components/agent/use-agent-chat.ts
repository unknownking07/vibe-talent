"use client";

// Shared client for the VibeFinder agent stream (/api/agent/chat).
// Consumes NDJSON events: text tokens, tool status updates, and builder
// cards, and folds them into the message list.

import { useCallback, useState } from "react";
import { decodeAgentEvents } from "@/lib/agent/events";
import type { AgentBuilderCard } from "@/lib/agent/types";

export interface AgentChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  builders?: AgentBuilderCard[];
  /**
   * False for bubbles that contain transport/tool error text. They render in
   * the UI but are excluded from the history sent upstream, so a 429/503 or
   * connection hiccup never reads as something the model actually said.
   */
  includeInHistory?: boolean;
}

export function useAgentChat(greeting: string) {
  const [messages, setMessages] = useState<AgentChatMessage[]>([
    { id: "greeting", role: "agent", content: greeting },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  /** Live tool activity ("Searching builders…") shown while the model works. */
  const [status, setStatus] = useState<string | null>(null);

  const send = useCallback(
    async (text: string) => {
      if (isStreaming) return;

      const userMsg: AgentChatMessage = { id: `u-${Date.now()}`, role: "user", content: text };
      const agentId = `a-${Date.now()}`;

      // Build the API payload BEFORE mutating state: full history + this turn,
      // minus the client-only greeting, mapped to the API's role names.
      const payload = [...messages, userMsg]
        .filter((m) => m.id !== "greeting" && m.includeInHistory !== false)
        .map((m) => ({
          role: m.role === "agent" ? "assistant" : "user",
          content: m.content,
        }));

      // Optimistically render the user message + an empty agent bubble to stream into.
      setMessages((prev) => [...prev, userMsg, { id: agentId, role: "agent", content: "" }]);
      setIsStreaming(true);

      let content = "";
      let builders: AgentBuilderCard[] = [];
      let includeInHistory = true;
      const apply = () =>
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentId
              ? {
                  ...m,
                  content,
                  builders: builders.length ? builders : undefined,
                  includeInHistory,
                }
              : m
          )
        );

      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: payload }),
        });

        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          content = data?.error || "Something went wrong. Please try again.";
          includeInHistory = false;
          apply();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let rest = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const decoded = decodeAgentEvents(rest + decoder.decode(value, { stream: true }));
          rest = decoded.rest;
          for (const event of decoded.events) {
            if (event.type === "token") {
              content += event.text;
              setStatus(null);
            } else if (event.type === "status") {
              setStatus(event.label);
            } else if (event.type === "builders") {
              // Newest results lead in their exact tool order (the ranks the
              // deterministic engine just produced); earlier cards that
              // weren't re-returned trail behind, deduped by username.
              const incoming = new Set(event.builders.map((b) => b.username));
              builders = [
                ...event.builders,
                ...builders.filter((b) => !incoming.has(b.username)),
              ];
            } else if (event.type === "error") {
              content = content ? `${content}\n\n${event.message}` : event.message;
              includeInHistory = false;
            }
          }
          apply();
        }

        if (!content.trim() && builders.length === 0) {
          content = "Sorry, I didn't catch that. Could you rephrase?";
          includeInHistory = false; // UI-fabricated, not something the model said
          apply();
        }
      } catch {
        content = content
          ? `${content}\n\nConnection issue — please try again.`
          : "Connection issue. Please try again.";
        includeInHistory = false;
        apply();
      } finally {
        setIsStreaming(false);
        setStatus(null);
      }
    },
    [messages, isStreaming]
  );

  return { messages, send, isStreaming, status };
}
