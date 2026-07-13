"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot } from "lucide-react";
import { ChatMessage } from "@/components/agent/chat-message";
import { ChatInput } from "@/components/agent/chat-input";

interface Msg {
  id: string;
  role: "user" | "agent";
  content: string;
}

const GREETING =
  "Hi! I'm VibeFinder Support. Ask me anything about VibeTalent — vibe scores, streaks, adding projects, hiring, badges, or your account.";

const SUGGESTIONS = [
  "How does my vibe score work?",
  "Why hasn't my streak updated?",
  "How do I add a project?",
  "How does hiring work?",
];

export function SupportChat() {
  const [messages, setMessages] = useState<Msg[]>([
    { id: "greeting", role: "agent", content: GREETING },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  const send = useCallback(
    async (text: string) => {
      if (isStreaming) return;

      const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: text };
      const agentId = `a-${Date.now()}`;

      // Build the API payload BEFORE mutating state: full history + this turn,
      // minus the client-only greeting, mapped to the API's role names.
      const payload = [...messages, userMsg]
        .filter((m) => m.id !== "greeting")
        .map((m) => ({
          role: m.role === "agent" ? "assistant" : "user",
          content: m.content,
        }));

      // Optimistically render the user message + an empty agent bubble to stream into.
      setMessages((prev) => [...prev, userMsg, { id: agentId, role: "agent", content: "" }]);
      setIsStreaming(true);

      const setAgent = (content: string) =>
        setMessages((prev) => prev.map((m) => (m.id === agentId ? { ...m, content } : m)));

      try {
        const res = await fetch("/api/support/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: payload }),
        });

        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setAgent(data?.error || "Something went wrong. Please try again.");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setAgent(acc);
        }
        if (!acc.trim()) {
          setAgent("Sorry, I didn't catch that. Could you rephrase?");
        }
      } catch {
        setAgent("Connection issue. Please try again.");
      } finally {
        setIsStreaming(false);
      }
    },
    [messages, isStreaming]
  );

  const showSuggestions = messages.length === 1 && !isStreaming;

  return (
    <div
      className="mx-auto max-w-3xl px-4 sm:px-6 py-4 sm:py-6 flex flex-col"
      style={{ height: "calc(100dvh - 64px)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <div
          className="w-10 h-10 flex items-center justify-center"
          style={{
            backgroundColor: "var(--bg-inverted)",
            border: "2px solid var(--border-hard)",
            boxShadow: "3px 3px 0 var(--accent)",
          }}
        >
          <Bot size={20} className="text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold uppercase text-[var(--foreground)]">Support</h1>
          <p className="text-xs text-[var(--text-muted)] font-bold uppercase">VibeFinder Support Bot</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg) => {
          // An empty agent bubble only exists transiently while we wait for the
          // first streamed token — render it as the animated "thinking" state.
          const thinking = msg.role === "agent" && msg.content === "" && isStreaming;
          return <ChatMessage key={msg.id} role={msg.role} content={msg.content} isThinking={thinking} />;
        })}

        {showSuggestions && (
          <div className="flex flex-wrap gap-2 ml-11 mt-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="btn-brutal text-xs py-2 px-4"
                style={{ backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-brutal-sm)" }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 pt-4" style={{ borderTop: "2px solid var(--border-hard)" }}>
        <ChatInput onSend={send} disabled={isStreaming} placeholder="Ask a support question..." />
      </div>
    </div>
  );
}
