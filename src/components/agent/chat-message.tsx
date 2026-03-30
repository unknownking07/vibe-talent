"use client";

import { Bot, User } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "agent";
  content: string;
  isThinking?: boolean;
}

export function ChatMessage({ role, content, isThinking }: ChatMessageProps) {
  if (role === "agent") {
    return (
      <div className="flex gap-3 items-start animate-fade-in-up">
        <div
          className="w-8 h-8 shrink-0 flex items-center justify-center"
          style={{
            backgroundColor: "var(--bg-inverted)",
            border: "2px solid var(--border-hard)",
          }}
        >
          <Bot size={16} className="text-[var(--accent)]" />
        </div>
        <div
          className="max-w-[80%] p-4 font-mono text-sm"
          style={{
            backgroundColor: "var(--bg-inverted)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
            color: "#F5F5F5",
          }}
        >
          {isThinking ? (
            <span className="inline-flex gap-1">
              <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
            </span>
          ) : (
            <span className="whitespace-pre-wrap">{content}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-start justify-end animate-fade-in-up">
      <div
        className="max-w-[80%] p-4 text-sm font-medium"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal-sm)",
        }}
      >
        <span className="whitespace-pre-wrap">{content}</span>
      </div>
      <div
        className="w-8 h-8 shrink-0 flex items-center justify-center"
        style={{
          backgroundColor: "var(--accent)",
          border: "2px solid var(--border-hard)",
        }}
      >
        <User size={16} className="text-white" />
      </div>
    </div>
  );
}
