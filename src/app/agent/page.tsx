import type { Metadata } from "next";
import Link from "next/link";
import { Bot, Search, Send, Zap, MessageCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "AI Agents",
  description: "Autonomous AI agents that analyze builder profiles, match talent to your project, and draft personalized hire requests.",
};

export default function AgentHubPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <div className="text-center mb-12">
        <div
          className="inline-flex items-center justify-center w-16 h-16 mb-4"
          style={{
            backgroundColor: "#0F0F0F",
            border: "2px solid #0F0F0F",
            boxShadow: "var(--shadow-brutal-accent)",
          }}
        >
          <Bot size={32} className="text-[var(--accent)]" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold uppercase text-[#0F0F0F]">AI Agents</h1>
        <p className="mt-3 text-[#52525B] font-medium max-w-2xl mx-auto">
          Autonomous AI systems that analyze builder profiles, match talent to your project,
          and draft personalized hire requests — all powered by on-chain shipping data.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
        {/* Evaluate Agent */}
        <Link href="/agent/find" className="block">
          <div
            className="p-6 h-full transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#0F0F0F]"
            style={{
              backgroundColor: "#FFFFFF",
              border: "2px solid #0F0F0F",
              boxShadow: "var(--shadow-brutal)",
            }}
          >
            <div
              className="w-12 h-12 flex items-center justify-center mb-4"
              style={{
                backgroundColor: "var(--accent)",
                border: "2px solid #0F0F0F",
              }}
            >
              <Search size={22} className="text-white" />
            </div>
            <h3 className="text-lg font-extrabold uppercase text-[#0F0F0F]">Find Talent</h3>
            <p className="mt-2 text-sm text-[#52525B] font-medium">
              Describe your project and let our AI agent analyze every builder on the platform
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
            className="p-6 h-full transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#0F0F0F]"
            style={{
              backgroundColor: "#FFFFFF",
              border: "2px solid #0F0F0F",
              boxShadow: "var(--shadow-brutal)",
            }}
          >
            <div
              className="w-12 h-12 flex items-center justify-center mb-4"
              style={{
                backgroundColor: "#0F0F0F",
                border: "2px solid #0F0F0F",
              }}
            >
              <Zap size={22} className="text-[var(--accent)]" />
            </div>
            <h3 className="text-lg font-extrabold uppercase text-[#0F0F0F]">Evaluate Builder</h3>
            <p className="mt-2 text-sm text-[#52525B] font-medium">
              Run a deep AI evaluation on any builder — analyzing git activity, streak consistency,
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
            className="p-6 h-full transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#0F0F0F]"
            style={{
              backgroundColor: "#FFFFFF",
              border: "2px solid #0F0F0F",
              boxShadow: "var(--shadow-brutal)",
            }}
          >
            <div
              className="w-12 h-12 flex items-center justify-center mb-4"
              style={{
                backgroundColor: "#FFFFFF",
                border: "2px solid #0F0F0F",
                boxShadow: "3px 3px 0 var(--accent)",
              }}
            >
              <Send size={22} className="text-[#0F0F0F]" />
            </div>
            <h3 className="text-lg font-extrabold uppercase text-[#0F0F0F]">AI Contact</h3>
            <p className="mt-2 text-sm text-[#52525B] font-medium">
              Let the agent draft a personalized hire request based on the builder&apos;s profile,
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
            className="p-6 h-full transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#0F0F0F]"
            style={{
              backgroundColor: "#0F0F0F",
              border: "2px solid #0F0F0F",
              boxShadow: "var(--shadow-brutal-accent)",
            }}
          >
            <div
              className="w-12 h-12 flex items-center justify-center mb-4"
              style={{
                backgroundColor: "var(--accent)",
                border: "2px solid #0F0F0F",
              }}
            >
              <MessageCircle size={22} className="text-white" />
            </div>
            <h3 className="text-lg font-extrabold uppercase text-white">AI Chat</h3>
            <p className="mt-2 text-sm text-zinc-400 font-medium">
              Chat with our AI agent directly. Describe what you need and get instant
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
          backgroundColor: "#0F0F0F",
          border: "2px solid #0F0F0F",
          boxShadow: "8px 8px 0 var(--accent)",
        }}
      >
        <h2 className="text-2xl font-extrabold uppercase text-white mb-6">How AI Agents Work</h2>
        <div className="grid sm:grid-cols-4 gap-6">
          {[
            { step: "01", title: "Describe", text: "Tell the agent what you're building and what skills you need" },
            { step: "02", title: "Analyze", text: "Agent scans all builders — git activity, streaks, project quality, tech stack" },
            { step: "03", title: "Match", text: "Get ranked recommendations with match scores and reasoning" },
            { step: "04", title: "Contact", text: "Agent drafts a personalized hire request and provides direct contact links" },
          ].map((item) => (
            <div key={item.step}>
              <div className="text-3xl font-extrabold font-mono text-[var(--accent)] mb-2">{item.step}</div>
              <h4 className="text-sm font-extrabold uppercase text-white mb-1">{item.title}</h4>
              <p className="text-xs text-zinc-400 font-medium">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
