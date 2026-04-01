"use client";

import Link from "next/link";
import { useState } from "react";
import { Bot, Search, Send, Zap, MessageCircle, Code2, ExternalLink, Copy, Check } from "lucide-react";

export default function AgentHubPage() {
  const [copied, setCopied] = useState(false);

  const handleCopySkillUrl = () => {
    const url = `${window.location.origin}/skill.md`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <div className="text-center mb-12">
        <div
          className="inline-flex items-center justify-center w-16 h-16 mb-4"
          style={{
            backgroundColor: "var(--bg-inverted)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-accent)",
          }}
        >
          <Bot size={32} className="text-[var(--accent)]" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold uppercase text-[var(--foreground)]">VibeFinder Bot</h1>
        <p className="mt-3 text-[var(--text-secondary)] font-medium max-w-2xl mx-auto">
          A smart bot that reads platform data to analyze builder profiles, match talent to your project,
          and draft personalized hire requests — powered by real shipping data.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
        {/* Evaluate Agent */}
        <Link href="/agent/find" className="block">
          <div
            className="p-6 h-full transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--border-hard)]"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal)",
            }}
          >
            <div
              className="w-12 h-12 flex items-center justify-center mb-4"
              style={{
                backgroundColor: "var(--accent)",
                border: "2px solid var(--border-hard)",
              }}
            >
              <Search size={22} className="text-white" />
            </div>
            <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)]">Find Talent</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)] font-medium">
              Describe your project and let VibeFinder Bot analyze every builder on the platform
              to find your perfect match.
            </p>
            <div className="mt-4 text-sm font-bold uppercase text-[var(--accent)]">
              Start Matching →
            </div>
          </div>
        </Link>

        {/* Find Talent Agent */}
        <Link href="/explore" className="block">
          <div
            className="p-6 h-full transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--border-hard)]"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal)",
            }}
          >
            <div
              className="w-12 h-12 flex items-center justify-center mb-4"
              style={{
                backgroundColor: "var(--bg-inverted)",
                border: "2px solid var(--border-hard)",
              }}
            >
              <Zap size={22} className="text-[var(--accent)]" />
            </div>
            <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)]">Evaluate Builder</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)] font-medium">
              Run a deep evaluation on any builder — analyzing git activity, streak consistency,
              project quality, and reputation.
            </p>
            <div className="mt-4 text-sm font-bold uppercase text-[var(--accent)]">
              Browse Builders →
            </div>
          </div>
        </Link>

        {/* Contact Agent */}
        <Link href="/agent/find" className="block">
          <div
            className="p-6 h-full transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--border-hard)]"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal)",
            }}
          >
            <div
              className="w-12 h-12 flex items-center justify-center mb-4"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "2px solid var(--border-hard)",
                boxShadow: "3px 3px 0 var(--accent)",
              }}
            >
              <Send size={22} className="text-[var(--foreground)]" />
            </div>
            <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)]">Quick Contact</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)] font-medium">
              Let VibeFinder Bot draft a personalized hire request based on the builder&apos;s profile,
              skills, and your project needs.
            </p>
            <div className="mt-4 text-sm font-bold uppercase text-[var(--accent)]">
              Find & Contact →
            </div>
          </div>
        </Link>
        {/* AI Chat */}
        <Link href="/agent/chat" className="block">
          <div
            className="p-6 h-full transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--border-hard)]"
            style={{
              backgroundColor: "var(--bg-inverted)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal-accent)",
            }}
          >
            <div
              className="w-12 h-12 flex items-center justify-center mb-4"
              style={{
                backgroundColor: "var(--accent)",
                border: "2px solid var(--border-hard)",
              }}
            >
              <MessageCircle size={22} className="text-white" />
            </div>
            <h2 className="text-lg font-extrabold uppercase text-white">Bot Chat</h2>
            <p className="mt-2 text-sm text-[var(--text-muted-soft)] font-medium">
              Chat with VibeFinder Bot directly. Describe what you need and get instant
              talent recommendations.
            </p>
            <div className="mt-4 text-sm font-bold uppercase text-[var(--accent)]">
              Start Chat →
            </div>
          </div>
        </Link>
      </div>

      {/* How it works */}
      <div
        className="mt-16 p-8"
        style={{
          backgroundColor: "var(--bg-inverted)",
          border: "2px solid var(--border-hard)",
          boxShadow: "8px 8px 0 var(--accent)",
        }}
      >
        <h2 className="text-2xl font-extrabold uppercase text-white mb-6">How It Works</h2>
        <div className="grid sm:grid-cols-4 gap-6">
          {[
            { step: "01", title: "Describe", text: "Tell the bot what you're building and what skills you need" },
            { step: "02", title: "Analyze", text: "Bot scans all builders — git activity, streaks, project quality, tech stack" },
            { step: "03", title: "Match", text: "Get ranked recommendations with match scores and reasoning" },
            { step: "04", title: "Contact", text: "Bot drafts a personalized hire request and provides direct contact links" },
          ].map((item) => (
            <div key={item.step}>
              <div className="text-3xl font-extrabold font-mono text-[var(--accent)] mb-2">{item.step}</div>
              <h4 className="text-sm font-extrabold uppercase text-white mb-1">{item.title}</h4>
              <p className="text-xs text-[var(--text-muted-soft)] font-medium">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* API for External Agents */}
      <div
        className="mt-16 p-8"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 flex items-center justify-center"
            style={{
              backgroundColor: "var(--accent)",
              border: "2px solid var(--border-hard)",
            }}
          >
            <Code2 size={18} className="text-white" />
          </div>
          <h2 className="text-2xl font-extrabold uppercase text-[var(--foreground)]">Public API for AI Agents</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)] font-medium mb-6 max-w-3xl">
          Building an AI agent? VibeTalent exposes a free, open REST API so your agent can search builders,
          evaluate profiles, and send hire requests programmatically. No API key required.
        </p>

        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <div
            className="p-4"
            style={{ backgroundColor: "var(--bg-surface-light)", border: "2px solid var(--border-hard)" }}
          >
            <code className="text-xs font-mono font-bold text-[var(--accent)]">GET</code>
            <p className="text-sm font-extrabold text-[var(--foreground)] mt-1">/api/v1/builders</p>
            <p className="text-xs text-[var(--text-muted)] font-medium mt-1">
              Search builders by skills, streak, vibe score. Supports sorting and filtering.
            </p>
          </div>
          <div
            className="p-4"
            style={{ backgroundColor: "var(--bg-surface-light)", border: "2px solid var(--border-hard)" }}
          >
            <code className="text-xs font-mono font-bold text-[var(--accent)]">GET</code>
            <p className="text-sm font-extrabold text-[var(--foreground)] mt-1">/api/v1/builders/:username</p>
            <p className="text-xs text-[var(--text-muted)] font-medium mt-1">
              Get full builder profile with projects, social links, and stats.
            </p>
          </div>
          <div
            className="p-4"
            style={{ backgroundColor: "var(--bg-surface-light)", border: "2px solid var(--border-hard)" }}
          >
            <code className="text-xs font-mono font-bold text-[#16A34A]">POST</code>
            <p className="text-sm font-extrabold text-[var(--foreground)] mt-1">/api/v1/hire</p>
            <p className="text-xs text-[var(--text-muted)] font-medium mt-1">
              Send a hire request to any builder. Includes chat URL for follow-up.
            </p>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <a
            href="/api/v1/openapi"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-brutal btn-brutal-primary text-sm flex items-center gap-2"
          >
            <Code2 size={14} />
            OpenAPI Spec
            <ExternalLink size={12} />
          </a>
          <button
            onClick={handleCopySkillUrl}
            className="btn-brutal text-sm flex items-center gap-2 transition-all"
            style={{ backgroundColor: copied ? "#16A34A" : "var(--bg-inverted)", color: "var(--text-on-inverted)" }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy Skill URL"}
          </button>
          <a
            href="/.well-known/ai-plugin.json"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-brutal btn-brutal-secondary text-sm flex items-center gap-2"
          >
            <Bot size={14} />
            AI Plugin Manifest
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}
