"use client";

import { use, useState, useCallback, useEffect } from "react";
import { fetchUserByUsername } from "@/lib/supabase/queries";
import { generateHireMessage } from "@/lib/agent-scoring";
import type { UserWithSocials } from "@/lib/types/database";
import { AgentThinking } from "@/components/agent/agent-thinking";
import { Bot, Send, ArrowLeft, Github, Globe } from "lucide-react";
import { extractSocialHandle } from "@/lib/social-handles";
import Link from "next/link";
import type { AgentStep } from "@/lib/types/agent";

const contactSteps: AgentStep[] = [
  { label: "Loading builder profile data...", duration: 600 },
  { label: "Analyzing builder's expertise and interests...", duration: 900 },
  { label: "Crafting personalized hire message...", duration: 1200 },
  { label: "Optimizing for response rate...", duration: 700 },
];

export default function ContactPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const [user, setUser] = useState<UserWithSocials | null>(null);
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(true);
  const [message, setMessage] = useState("");
  const [senderName, setSenderName] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetchUserByUsername(username).then((data) => {
      setUser(data);
      setLoading(false);
    });
  }, [username]);

  const handleThinkingComplete = useCallback(() => {
    if (user) {
      const allTech = [...new Set((user.projects ?? []).flatMap(p => p.tech_stack ?? []))];
      const draft = generateHireMessage(
        "Your Name",
        user.username,
        "a project that needs a skilled vibe coder",
        allTech.slice(0, 3)
      );
      setMessage(draft);
    }
    setThinking(false);
  }, [user]);

  const handleSend = () => {
    if (!senderName.trim()) return;
    setSent(true);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
        <div className="skeleton h-12 mb-8" />
        <div className="skeleton h-64" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 text-center">
        <h1 className="text-2xl font-extrabold uppercase text-[var(--foreground)]">Builder not found</h1>
      </div>
    );
  }

  const socials = user.social_links;
  const twitterHandle = extractSocialHandle(socials?.twitter, "twitter");
  const initials = user.username.slice(0, 2).toUpperCase();

  if (sent) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
        <div
          className="p-8 text-center"
          style={{
            backgroundColor: "var(--status-success-bg)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <div
            className="w-16 h-16 mx-auto mb-4 flex items-center justify-center"
            style={{
              backgroundColor: "#16A34A",
              border: "2px solid var(--border-hard)",
            }}
          >
            <Send size={28} className="text-white" />
          </div>
          <h2 className="text-2xl font-extrabold uppercase text-[var(--status-success-text)]">Request Sent!</h2>
          <p className="mt-2 text-sm text-[var(--status-success-text)] font-medium">
            Your hire request to @{username} has been recorded.
          </p>
        </div>

        <div
          className="mt-6 p-6"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <h3 className="text-sm font-extrabold uppercase text-[var(--foreground)] mb-4">
            Follow Up Directly
          </h3>
          <p className="text-sm text-[var(--text-secondary)] font-medium mb-4">
            Reach out to @{username} on their preferred channels for a faster response:
          </p>
          <div className="flex flex-wrap gap-3">
            {socials?.github && (
              <a
                href={`https://github.com/${socials.github}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-brutal btn-brutal-dark text-xs py-2 px-4 flex items-center gap-2"
              >
                <Github size={14} />
                GitHub
              </a>
            )}
            {twitterHandle && (
              <a
                href={`https://x.com/${twitterHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-brutal btn-brutal-secondary text-xs py-2 px-4 flex items-center gap-2"
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                X / Twitter
              </a>
            )}
            {socials?.website && (
              <a
                href={socials.website}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-brutal btn-brutal-secondary text-xs py-2 px-4 flex items-center gap-2"
              >
                <Globe size={14} />
                Website
              </a>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Link href="/agent/find" className="btn-brutal btn-brutal-primary text-sm">
            Find More Talent
          </Link>
          <Link href={`/profile/${username}`} className="btn-brutal btn-brutal-secondary text-sm">
            View Profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
      <Link
        href={`/profile/${username}`}
        className="inline-flex items-center gap-2 text-sm font-bold uppercase text-[var(--text-muted)] hover:text-[var(--accent)] mb-6"
      >
        <ArrowLeft size={14} />
        Back to Profile
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-10 h-10 flex items-center justify-center"
          style={{
            backgroundColor: "var(--bg-inverted)",
            border: "2px solid var(--border-hard)",
          }}
        >
          <Bot size={20} className="text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold uppercase text-[var(--foreground)]">
            Contact @{username}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] font-medium">
            Bot-drafted hire request
          </p>
        </div>
      </div>

      {/* Target user mini card */}
      <div
        className="p-4 flex items-center gap-4 mb-6"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal-sm)",
        }}
      >
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center text-sm font-extrabold text-white"
          style={{ backgroundColor: "var(--bg-inverted)" }}
        >
          {initials}
        </div>
        <div>
          <div className="font-extrabold uppercase text-[var(--foreground)]">@{username}</div>
          <div className="text-xs font-bold text-[var(--text-muted)]">
            {user.streak} day streak · {(user.projects ?? []).length} projects · Vibe {user.vibe_score}
          </div>
        </div>
      </div>

      {thinking && (
        <AgentThinking steps={contactSteps} onComplete={handleThinkingComplete} />
      )}

      {!thinking && (
        <div
          className="p-6 space-y-4 mt-4"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">
              Your Name
            </label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Enter your name..."
              className="input-brutal"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">
              Bot-Drafted Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              className="input-brutal resize-none font-mono text-sm"
            />
            <p className="text-xs text-[var(--text-muted-soft)] mt-1 font-medium">
              <Bot size={10} className="inline mr-1" />
              Message drafted by VibeFinder Bot. Feel free to edit before sending.
            </p>
          </div>

          <button
            onClick={handleSend}
            disabled={!senderName.trim()}
            className="btn-brutal btn-brutal-primary w-full justify-center text-base flex items-center gap-2 disabled:opacity-50"
          >
            <Send size={16} />
            Send Hire Request
          </button>
        </div>
      )}
    </div>
  );
}
