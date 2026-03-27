"use client";

import { useState, useCallback, useEffect } from "react";
import { fetchUsers } from "@/lib/supabase/queries";
import { matchUsers } from "@/lib/agent-scoring";
import type { UserWithSocials } from "@/lib/types/database";
import { AgentThinking } from "@/components/agent/agent-thinking";
import { MatchCard } from "@/components/agent/match-card";
import { Bot, Search } from "lucide-react";
import type { MatchResult, TaskRequest, AgentStep } from "@/lib/types/agent";

const matchSteps: AgentStep[] = [
  { label: "Parsing project requirements...", duration: 700 },
  { label: "Scanning all builder profiles on VibeTalent...", duration: 1000 },
  { label: "Analyzing git activity and streak data...", duration: 1200 },
  { label: "Matching tech stacks and project experience...", duration: 1100 },
  { label: "Scoring and ranking candidates...", duration: 900 },
  { label: "Generating match report...", duration: 800 },
];

export default function FindTalentPage() {
  const [allUsers, setAllUsers] = useState<UserWithSocials[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [form, setForm] = useState<TaskRequest>({
    description: "",
    tech_stack: [],
    project_type: "mvp",
    timeline: "flexible",
    budget: "500_2k",
  });
  const [techInput, setTechInput] = useState("");

  useEffect(() => {
    fetchUsers().then(setAllUsers);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tech = techInput.split(",").map(t => t.trim()).filter(Boolean);
    setForm(prev => ({ ...prev, tech_stack: tech }));
    setSubmitted(true);
    setThinking(true);
  };

  const handleThinkingComplete = useCallback(() => {
    const tech = techInput.split(",").map(t => t.trim()).filter(Boolean);
    const results = matchUsers(allUsers, { ...form, tech_stack: tech });
    setMatches(results);
    setThinking(false);
  }, [allUsers, form, techInput]);

  if (!submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-10 h-10 flex items-center justify-center"
            style={{
              backgroundColor: "var(--accent)",
              border: "2px solid #0F0F0F",
              boxShadow: "3px 3px 0 #0F0F0F",
            }}
          >
            <Search size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold uppercase text-[#0F0F0F]">Find Talent</h1>
            <p className="text-sm text-[#52525B] font-medium">
              Describe your project and let VibeFinder Bot find the best vibe coders
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            className="p-6 space-y-5"
            style={{
              backgroundColor: "#FFFFFF",
              border: "2px solid #0F0F0F",
              boxShadow: "var(--shadow-brutal)",
            }}
          >
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">
                Project Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                placeholder="Describe what you're building, the problem you're solving, and what kind of builder you need..."
                className="input-brutal resize-none"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">
                Required Tech Stack
              </label>
              <input
                type="text"
                value={techInput}
                onChange={(e) => setTechInput(e.target.value)}
                placeholder="Next.js, TypeScript, Supabase, TailwindCSS..."
                className="input-brutal"
              />
              <p className="text-xs text-[#A1A1AA] mt-1 font-medium">Comma-separated</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">
                  Project Type
                </label>
                <select
                  value={form.project_type}
                  onChange={(e) => setForm({ ...form, project_type: e.target.value as TaskRequest["project_type"] })}
                  className="input-brutal"
                >
                  <option value="mvp">MVP / Prototype</option>
                  <option value="full_product">Full Product</option>
                  <option value="bug_fix">Bug Fix / Maintenance</option>
                  <option value="consultation">Consultation</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">
                  Timeline
                </label>
                <select
                  value={form.timeline}
                  onChange={(e) => setForm({ ...form, timeline: e.target.value as TaskRequest["timeline"] })}
                  className="input-brutal"
                >
                  <option value="asap">ASAP</option>
                  <option value="1_week">1 Week</option>
                  <option value="1_month">1 Month</option>
                  <option value="flexible">Flexible</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">
                Budget Range
              </label>
              <select
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value as TaskRequest["budget"] })}
                className="input-brutal"
              >
                <option value="under_500">Under $500</option>
                <option value="500_2k">$500 — $2,000</option>
                <option value="2k_5k">$2,000 — $5,000</option>
                <option value="5k_plus">$5,000+</option>
              </select>
            </div>

            <button
              type="submit"
              className="btn-brutal btn-brutal-primary w-full justify-center text-base flex items-center gap-2"
            >
              <Bot size={18} />
              Find My Vibe Coder
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-10 h-10 flex items-center justify-center"
          style={{
            backgroundColor: "var(--accent)",
            border: "2px solid #0F0F0F",
            boxShadow: "3px 3px 0 #0F0F0F",
          }}
        >
          <Bot size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold uppercase text-[#0F0F0F]">VibeFinder Results</h1>
          <p className="text-sm text-[#52525B] font-medium">
            Ranked matches for your project
          </p>
        </div>
      </div>

      {thinking && (
        <AgentThinking steps={matchSteps} onComplete={handleThinkingComplete} />
      )}

      {!thinking && matches.length > 0 && (
        <div className="space-y-4 mt-6">
          <div
            className="p-4 text-sm font-bold text-[#0F0F0F]"
            style={{
              backgroundColor: "#FFF7ED",
              border: "2px solid #0F0F0F",
            }}
          >
            <Bot size={14} className="inline mr-2 text-[var(--accent)]" />
            Found {matches.length} matching vibe coders. Ranked by skill match, consistency, and reputation.
          </div>

          {matches.map((match, i) => (
            <MatchCard key={match.user.id} match={match} rank={i + 1} />
          ))}

          <button
            onClick={() => { setSubmitted(false); setMatches([]); }}
            className="btn-brutal btn-brutal-secondary text-sm w-full justify-center mt-4"
          >
            New Search
          </button>
        </div>
      )}
    </div>
  );
}
