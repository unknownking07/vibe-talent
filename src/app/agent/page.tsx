import Link from "next/link";
import { Search, Send, ExternalLink } from "lucide-react";
import { ChatCircle, Code, Lightning } from "@phosphor-icons/react/dist/ssr";
import { CopySkillUrlButton } from "@/components/agent/copy-skill-url-button";
import { BotMark } from "@/components/icons/brand";

export default function AgentHubPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <div className="text-center mb-12">
        <div
          className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl"
          style={{
            backgroundColor: "var(--bg-inverted)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-brutal-accent)",
          }}
        >
          <BotMark weight="duotone" size={32} className="text-[var(--accent)]" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--foreground)]">VibeFinder Robot</h1>
        <p className="mt-3 text-[var(--text-secondary)] font-medium max-w-2xl mx-auto">
          A smart bot that reads platform data to analyze builder profiles, match talent to your project,
          and draft personalized hire requests: powered by real shipping data.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
        {/* Evaluate Agent */}
        <Link href="/agent/find" className="block">
          <div
            className="p-6 h-full rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-brutal-hover)]"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-brutal)",
            }}
          >
            <div
              className="w-12 h-12 flex items-center justify-center mb-4 rounded-xl"
              style={{
                backgroundColor: "var(--accent)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <Search size={22} className="text-white" />
            </div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">Find Talent</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)] font-medium">
              Describe your project and let VibeFinder Robot analyze every builder on the platform
              to find your perfect match.
            </p>
            <div className="mt-4 text-sm font-semibold text-[var(--accent)]">
              Start Matching →
            </div>
          </div>
        </Link>

        {/* Find Talent Agent */}
        <Link href="/explore" className="block">
          <div
            className="p-6 h-full rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-brutal-hover)]"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-brutal)",
            }}
          >
            <div
              className="w-12 h-12 flex items-center justify-center mb-4 rounded-xl"
              style={{
                backgroundColor: "var(--bg-inverted)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <Lightning weight="fill" size={22} className="text-[var(--accent)]" />
            </div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">Evaluate Builder</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)] font-medium">
              Run a deep evaluation on any builder, analyzing git activity, streak consistency,
              project quality, and reputation.
            </p>
            <div className="mt-4 text-sm font-semibold text-[var(--accent)]">
              Browse Builders →
            </div>
          </div>
        </Link>

        {/* Contact Agent */}
        <Link href="/agent/find" className="block">
          <div
            className="p-6 h-full rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-brutal-hover)]"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-brutal)",
            }}
          >
            <div
              className="w-12 h-12 flex items-center justify-center mb-4 rounded-xl"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--shadow-brutal-accent)",
              }}
            >
              <Send size={22} className="text-[var(--foreground)]" />
            </div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">Quick Contact</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)] font-medium">
              Let VibeFinder Robot draft a personalized hire request based on the builder&apos;s profile,
              skills, and your project needs.
            </p>
            <div className="mt-4 text-sm font-semibold text-[var(--accent)]">
              Find & Contact →
            </div>
          </div>
        </Link>
        {/* AI Chat */}
        <Link href="/agent/chat" className="block">
          <div
            className="p-6 h-full rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-brutal-hover)]"
            style={{
              backgroundColor: "var(--bg-inverted)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-brutal-accent)",
            }}
          >
            <div
              className="w-12 h-12 flex items-center justify-center mb-4 rounded-xl"
              style={{
                backgroundColor: "var(--accent)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <ChatCircle weight="fill" size={22} className="text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">AI Chat</h2>
            <p className="mt-2 text-sm text-[var(--text-muted-soft)] font-medium">
              Talk to the real AI assistant. It searches live builder data, evaluates
              profiles, and drafts hire messages on the spot.
            </p>
            <div className="mt-4 text-sm font-semibold text-[var(--accent)]">
              Start Chat →
            </div>
          </div>
        </Link>
      </div>

      {/* How it works */}
      <div
        className="mt-16 p-8 rounded-2xl"
        style={{
          backgroundColor: "var(--bg-inverted)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-brutal-accent)",
        }}
      >
        <h2 className="text-2xl font-bold text-white mb-6">How It Works</h2>
        <div className="grid sm:grid-cols-4 gap-6">
          {[
            { step: "01", title: "Describe", text: "Tell the bot what you're building and what skills you need" },
            { step: "02", title: "Analyze", text: "Robot scans all builders: git activity, streaks, project quality, tech stack" },
            { step: "03", title: "Match", text: "Get ranked recommendations with match scores and reasoning" },
            { step: "04", title: "Contact", text: "Robot drafts a personalized hire request and provides direct contact links" },
          ].map((item) => (
            <div key={item.step}>
              <div className="text-3xl font-extrabold font-mono text-[var(--accent)] mb-2">{item.step}</div>
              <h4 className="text-sm font-bold text-white mb-1">{item.title}</h4>
              <p className="text-xs text-[var(--text-muted-soft)] font-medium">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* API for External Agents */}
      <div
        className="mt-16 p-8 rounded-2xl"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 flex items-center justify-center rounded-xl"
            style={{
              backgroundColor: "var(--accent)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <Code weight="fill" size={18} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--foreground)]">Public API for AI Agents</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)] font-medium mb-6 max-w-3xl">
          Building an AI agent? VibeTalent exposes a free, open REST API so your agent can search builders,
          evaluate profiles, and send hire requests programmatically. No API key required.
        </p>

        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <div
            className="p-4 rounded-xl"
            style={{ backgroundColor: "var(--bg-surface-light)", border: "1px solid var(--border-subtle)" }}
          >
            <code className="text-xs font-mono font-bold text-[var(--accent)]">GET</code>
            <p className="text-sm font-bold text-[var(--foreground)] mt-1">/api/v1/builders</p>
            <p className="text-xs text-[var(--text-muted)] font-medium mt-1">
              Search builders by skills, streak, vibe score. Filter by <code>verified_only=true</code> to surface builders with at least one GitHub-verified project.
            </p>
          </div>
          <div
            className="p-4 rounded-xl"
            style={{ backgroundColor: "var(--bg-surface-light)", border: "1px solid var(--border-subtle)" }}
          >
            <code className="text-xs font-mono font-bold text-[var(--accent)]">GET</code>
            <p className="text-sm font-bold text-[var(--foreground)] mt-1">/api/v1/builders/:username</p>
            <p className="text-xs text-[var(--text-muted)] font-medium mt-1">
              Full profile + projects with verification status, quality scores, live-URL health, endorsements, and review aggregates.
            </p>
          </div>
          <div
            className="p-4 rounded-xl"
            style={{ backgroundColor: "var(--bg-surface-light)", border: "1px solid var(--border-subtle)" }}
          >
            <code className="text-xs font-mono font-bold text-[#16A34A]">POST</code>
            <p className="text-sm font-bold text-[var(--foreground)] mt-1">/api/v1/hire</p>
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
            <Code weight="fill" size={14} />
            OpenAPI Spec
            <ExternalLink size={12} />
          </a>
          <CopySkillUrlButton />
          <a
            href="/.well-known/ai-plugin.json"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-brutal btn-brutal-secondary text-sm flex items-center gap-2"
          >
            <BotMark weight="fill" size={14} />
            AI Plugin Manifest
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}
