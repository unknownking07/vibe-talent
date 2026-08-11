"use client";

// One chat surface for the unified VibeFinder assistant. Both /agent/chat and
// /support render this panel with different copy — same brain underneath.

import { useEffect, useRef } from "react";
import { ChatMessage } from "@/components/agent/chat-message";
import { ChatInput } from "@/components/agent/chat-input";
import { BuilderCard } from "@/components/agent/builder-card";
import { useAgentChat } from "@/components/agent/use-agent-chat";
import { Robot } from "@phosphor-icons/react";

interface AgentChatPanelProps {
  title: string;
  subtitle: string;
  greeting: string;
  suggestions: string[];
  placeholder: string;
}

export function AgentChatPanel({
  title,
  subtitle,
  greeting,
  suggestions,
  placeholder,
}: AgentChatPanelProps) {
  const { messages, send, isStreaming, status } = useAgentChat(greeting);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Whether the user is reading at the bottom. Auto-scroll only then — a
  // smooth scroll restarted on every streamed chunk would drag them back
  // down while they're reading earlier messages.
  const pinnedRef = useRef(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
    }
  }, [messages, isStreaming, status]);

  const showSuggestions = messages.length === 1 && !isStreaming;

  return (
    <div
      className="mx-auto max-w-3xl px-4 sm:px-6 py-4 sm:py-6 flex flex-col"
      style={{ height: "calc(100dvh - 64px)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <div
          className="w-10 h-10 flex items-center justify-center rounded-xl"
          style={{
            backgroundColor: "var(--bg-inverted)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-brutal-accent)",
          }}
        >
          <Robot weight="fill" size={20} className="text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">{title}</h1>
          <p className="text-xs text-[var(--text-muted)] font-semibold">{subtitle}</p>
        </div>
      </div>

      {/* Messages — role="log" announces streamed replies politely to
          assistive tech; tabIndex makes the history keyboard-scrollable. */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-label="Conversation"
        aria-busy={isStreaming}
        tabIndex={0}
        className="flex-1 overflow-y-auto space-y-4 pb-4 focus:outline-none"
      >
        {messages.map((msg) => {
          // An empty agent bubble only exists transiently while we wait for the
          // first streamed token — render it as the animated "thinking" state.
          const thinking =
            msg.role === "agent" && msg.content === "" && !msg.builders && isStreaming;
          return (
            <div key={msg.id}>
              <ChatMessage role={msg.role} content={msg.content} isThinking={thinking} />
              {msg.builders && msg.builders.length > 0 && (
                <div className="ml-11 mt-3 space-y-3">
                  {msg.builders.map((builder, i) => (
                    <BuilderCard key={builder.username} builder={builder} rank={i + 1} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Live tool activity — the agent is reading real platform data */}
        {status && (
          <div
            role="status"
            className="ml-11 flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] animate-pulse"
          >
            <Robot weight="fill" size={12} className="text-[var(--accent)]" />
            {status}
          </div>
        )}

        {showSuggestions && (
          <div className="flex flex-wrap gap-2 ml-11 mt-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="btn-brutal text-xs py-2 px-4 text-left"
                style={{ backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-brutal-sm)" }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <ChatInput onSend={send} disabled={isStreaming} placeholder={placeholder} />
      </div>
    </div>
  );
}
