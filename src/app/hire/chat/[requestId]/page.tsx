"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Send, MessageCircle, User, Wrench, ArrowLeft } from "lucide-react";
import type { HireMessage } from "@/lib/types/database";
import Link from "next/link";

interface HireRequestData {
  id: string;
  builder_id: string;
  sender_name: string;
  sender_email: string;
  message: string;
  budget: string | null;
  status: string;
  created_at: string;
}

export default function HireChatPage() {
  const params = useParams();
  const requestId = params.requestId as string;

  const [hireRequest, setHireRequest] = useState<HireRequestData | null>(null);
  const [messages, setMessages] = useState<HireMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/hire/messages?hire_request_id=${requestId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("This conversation was not found.");
        } else {
          setError("Failed to load conversation.");
        }
        return;
      }
      const data = await res.json();
      setHireRequest(data.hire_request);
      setMessages(data.messages || []);
      setError("");
    } catch {
      setError("Failed to load conversation.");
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchMessages();
      setLoading(false);
    };
    init();

    // Poll for new messages every 15 seconds
    pollRef.current = setInterval(fetchMessages, 15000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);

    try {
      const res = await fetch("/api/hire/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hire_request_id: requestId,
          sender_type: "client",
          message: newMessage.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to send message.");
        setSending(false);
        return;
      }

      const { data: msg } = await res.json();
      setMessages((prev) => [...prev, msg]);
      setNewMessage("");
      setError("");
    } catch {
      setError("Failed to send message.");
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
        <div className="skeleton h-16 mb-4" />
        <div className="skeleton h-96 mb-4" />
        <div className="skeleton h-20" />
      </div>
    );
  }

  if (error && !hireRequest) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12 text-center">
        <div
          className="p-12"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <MessageCircle size={48} className="mx-auto text-[var(--text-muted-soft)] mb-4" />
          <h1 className="text-xl font-extrabold uppercase text-[var(--foreground)] mb-2">
            Conversation Not Found
          </h1>
          <p className="text-sm text-[var(--text-secondary)] font-medium">{error}</p>
          <Link
            href="/"
            className="btn-brutal btn-brutal-primary text-sm mt-6 inline-flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      {/* Header */}
      <div
        className="p-5 mb-6"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal-sm)",
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 flex items-center justify-center"
            style={{
              backgroundColor: "var(--accent)",
              border: "2px solid var(--border-hard)",
            }}
          >
            <MessageCircle size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold uppercase text-[var(--foreground)]">
              Hire Request Chat
            </h1>
            <p className="text-xs text-[var(--text-muted)] font-bold uppercase">
              Conversation with builder
            </p>
          </div>
        </div>

        {hireRequest && (
          <div className="text-sm text-[var(--text-secondary)]">
            <p>
              <span className="font-bold text-[var(--foreground)]">From:</span>{" "}
              {hireRequest.sender_name} ({hireRequest.sender_email})
            </p>
            {hireRequest.budget && (
              <p>
                <span className="font-bold text-[var(--foreground)]">Budget:</span>{" "}
                {hireRequest.budget}
              </p>
            )}
            <p className="text-xs text-[var(--text-muted-soft)] mt-1">
              Sent{" "}
              {new Date(hireRequest.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div
        className="mb-4"
        style={{
          backgroundColor: "var(--bg-surface-light)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal-sm)",
          minHeight: "400px",
          maxHeight: "60vh",
          overflowY: "auto",
        }}
      >
        <div className="p-4 space-y-4">
          {/* Original hire request message */}
          {hireRequest && (
            <div className="flex justify-start">
              <div className="max-w-[80%]">
                <div className="flex items-center gap-2 mb-1">
                  <User size={12} className="text-[var(--text-muted)]" />
                  <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
                    {hireRequest.sender_name} (You)
                  </span>
                </div>
                <div
                  className="p-3"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    border: "2px solid var(--border-hard)",
                    boxShadow: "var(--shadow-brutal-xs)",
                  }}
                >
                  <p className="text-sm text-[var(--text-tertiary)] whitespace-pre-wrap">
                    {hireRequest.message}
                  </p>
                </div>
                <p className="text-xs text-[var(--text-muted-soft)] mt-1">
                  {new Date(hireRequest.created_at).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((msg) => {
            const isClient = msg.sender_type === "client";
            return (
              <div
                key={msg.id}
                className={`flex ${isClient ? "justify-start" : "justify-end"}`}
              >
                <div className="max-w-[80%]">
                  <div
                    className={`flex items-center gap-2 mb-1 ${
                      isClient ? "" : "justify-end"
                    }`}
                  >
                    {isClient ? (
                      <User size={12} className="text-[var(--text-muted)]" />
                    ) : (
                      <Wrench size={12} className="text-[var(--accent)]" />
                    )}
                    <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
                      {isClient ? "You" : "Builder"}
                    </span>
                  </div>
                  <div
                    className="p-3"
                    style={{
                      backgroundColor: isClient ? "var(--bg-surface)" : "var(--accent)",
                      color: isClient ? "var(--text-tertiary)" : "var(--text-on-inverted)",
                      border: "2px solid var(--border-hard)",
                      boxShadow: "var(--shadow-brutal-xs)",
                    }}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  </div>
                  <p
                    className={`text-xs text-[var(--text-muted-soft)] mt-1 ${
                      isClient ? "" : "text-right"
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="p-3 mb-4 text-sm font-bold text-[var(--status-error-text)]"
          style={{
            backgroundColor: "var(--status-error-border)",
            border: "2px solid var(--border-hard)",
          }}
        >
          {error}
        </div>
      )}

      {/* Input */}
      <div
        className="p-4"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal-sm)",
        }}
      >
        <div className="flex gap-3">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={2}
            className="input-brutal resize-none flex-1"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="btn-brutal self-end text-sm py-3 px-4 flex items-center gap-2 disabled:opacity-50"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--text-on-inverted)",
            }}
          >
            <Send size={16} />
            {sending ? "..." : "Send"}
          </button>
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted-soft)] text-center mt-4 font-medium">
        Messages refresh automatically. Keep this page bookmarked to continue the conversation.
      </p>
    </div>
  );
}
