"use client";

import { use, useState, useCallback, useEffect, useRef, type FormEvent } from "react";
import { fetchUserByUsername } from "@/lib/supabase/queries";
import { generateHireMessage } from "@/lib/agent-scoring";
import type { UserWithSocials } from "@/lib/types/database";
import { AgentThinking } from "@/components/agent/agent-thinking";
import { Send, ArrowLeft } from "lucide-react";
import { GithubLogo, Globe } from "@phosphor-icons/react";
import { extractSocialHandle } from "@/lib/social-handles";
import Link from "next/link";
import type { AgentStep } from "@/lib/types/agent";
import { BotMark } from "@/components/icons/brand";
import { validateName, validateEmail } from "@/lib/validation";
import { trackFunnelEvent } from "@/lib/funnel-events";

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
  const [senderEmail, setSenderEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const submitting = useRef(false);
  const formStarted = useRef(false);

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

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || submitting.current || requestId) return;

    const nameResult = validateName(senderName);
    const emailResult = validateEmail(senderEmail);
    const messageClean = message.trim();
    if (!nameResult.valid || !emailResult.valid || messageClean.length < 20) {
      setError(nameResult.error ?? emailResult.error ?? "Please write a more detailed message (at least 20 characters).");
      trackFunnelEvent("hire_request_validation_failed");
      return;
    }

    submitting.current = true;
    setSending(true);
    setError("");
    trackFunnelEvent("hire_request_submitted");

    try {
      const res = await fetch("/api/hire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          builder_id: user.id,
          sender_name: nameResult.cleaned,
          sender_email: emailResult.cleaned,
          message: messageClean,
          budget: null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to send request. Please try again.");
        trackFunnelEvent("hire_request_api_failed");
        return;
      }

      if (data?.success !== true || typeof data.id !== "string" || !data.id.trim()) {
        setError("We couldn't confirm your request. Please try again.");
        trackFunnelEvent("hire_request_api_failed");
        return;
      }

      setRequestId(data.id);
      trackFunnelEvent("hire_request_created");
    } catch {
      setError("Something went wrong. Please try again.");
      trackFunnelEvent("hire_request_network_failed");
    } finally {
      submitting.current = false;
      setSending(false);
    }
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
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Builder not found</h1>
      </div>
    );
  }

  const socials = user.social_links;
  const twitterHandle = extractSocialHandle(socials?.twitter, "twitter");
  const initials = user.username.slice(0, 2).toUpperCase();

  if (requestId) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
        <div
          className="p-8 text-center rounded-2xl"
          style={{
            backgroundColor: "var(--status-success-bg)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <div
            className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full"
            style={{
              backgroundColor: "#16A34A",
            }}
          >
            <Send size={28} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--status-success-text)]">Request Sent!</h2>
          <p className="mt-2 text-sm text-[var(--status-success-text)] font-medium">
            Your request is saved. @{username} can see it in their VibeTalent inbox and reply here.
          </p>
          <Link
            href={`/hire/chat/${requestId}`}
            className="btn-brutal btn-brutal-primary inline-flex mt-4 text-sm"
          >
            Open Conversation
          </Link>
          <p className="mt-3 text-xs text-[var(--status-success-text)]">
            Save this private conversation link so you can return to their reply.
          </p>
        </div>

        <div
          className="mt-6 p-6 rounded-2xl"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <h3 className="text-sm font-bold text-[var(--foreground)] mb-4">
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
                <GithubLogo weight="fill" size={14} />
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
                <Globe weight="fill" size={14} />
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
        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--accent)] mb-6"
      >
        <ArrowLeft size={14} />
        Back to Profile
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-10 h-10 flex items-center justify-center rounded-xl"
          style={{
            backgroundColor: "var(--bg-inverted)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <BotMark weight="fill" size={20} className="text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Contact @{username}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] font-medium">
            Robot-drafted hire request
          </p>
        </div>
      </div>

      {/* Target user mini card */}
      <div
        className="p-4 flex items-center gap-4 mb-6 rounded-2xl"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-brutal-sm)",
        }}
      >
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: "var(--bg-inverted)" }}
        >
          {initials}
        </div>
        <div>
          <div className="font-bold text-[var(--foreground)]">@{username}</div>
          <div className="text-xs font-semibold text-[var(--text-muted)]">
            {user.streak} day streak · {(user.projects ?? []).length} projects · Vibe {user.vibe_score}
          </div>
        </div>
      </div>

      {thinking && (
        <AgentThinking steps={contactSteps} onComplete={handleThinkingComplete} />
      )}

      {!thinking && (
        <form
          onSubmit={handleSend}
          onFocus={() => {
            if (formStarted.current) return;
            formStarted.current = true;
            trackFunnelEvent("hire_form_started");
          }}
          noValidate
          aria-busy={sending}
          className="p-6 space-y-4 mt-4 rounded-2xl"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <div>
            <label htmlFor="sender-name" className="text-xs font-semibold text-[var(--text-muted)] mb-1.5 block">
              Your Name
            </label>
            <input
              id="sender-name"
              type="text"
              autoComplete="name"
              maxLength={100}
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Enter your name..."
              className="input-brutal"
              disabled={sending}
              required
            />
          </div>

          <div>
            <label htmlFor="sender-email" className="text-xs font-semibold text-[var(--text-muted)] mb-1.5 block">
              Your Email
            </label>
            <input
              id="sender-email"
              type="email"
              autoComplete="email"
              maxLength={254}
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="you@company.com"
              className="input-brutal"
              aria-describedby="sender-email-hint"
              disabled={sending}
              required
            />
            <p id="sender-email-hint" className="text-xs text-[var(--text-muted-soft)] mt-1 font-medium">
              Shared privately with @{username} for follow-up. Their email stays private.
            </p>
          </div>

          <div>
            <label htmlFor="hire-message" className="text-xs font-semibold text-[var(--text-muted)] mb-1.5 block">
              Robot-Drafted Message
            </label>
            <textarea
              id="hire-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              maxLength={2000}
              className="input-brutal resize-none font-mono text-sm"
              disabled={sending}
              required
            />
            <p className="text-xs text-[var(--text-muted-soft)] mt-1 font-medium">
              <BotMark weight="fill" size={10} className="inline mr-1" />
              Message drafted by VibeFinder Robot. Feel free to edit before sending.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-[var(--status-error-text)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={sending || !senderName.trim() || !senderEmail.trim() || !message.trim()}
            className="btn-brutal btn-brutal-primary w-full justify-center text-base flex items-center gap-2 disabled:opacity-50"
          >
            <Send size={16} />
            {sending ? "Sending..." : "Send Hire Request"}
          </button>
        </form>
      )}
    </div>
  );
}
