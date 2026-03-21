"use client";

import { useState, useMemo } from "react";
import { VibecoderCard } from "@/components/ui/vibecoder-card";
import { Search, SlidersHorizontal, Bot } from "lucide-react";
import Link from "next/link";
import type { BadgeLevel, UserWithSocials } from "@/lib/types/database";

type SortOption = "vibe_score" | "streak" | "projects" | "newest";

export function ExploreContent({ users }: { users: UserWithSocials[] }) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("vibe_score");
  const [badgeFilter, setBadgeFilter] = useState<BadgeLevel | "all">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTech, setSelectedTech] = useState<string[]>([]);
  const [minStreak, setMinStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(365);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [hasProjects, setHasProjects] = useState(false);

  const allTechStacks = useMemo(() => {
    const techs = new Set<string>();
    users.forEach(u => u.projects.forEach(p => p.tech_stack.forEach(t => techs.add(t))));
    return [...techs].sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    let filtered = [...users];

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.bio?.toLowerCase().includes(q) ||
          u.projects.some((p) =>
            p.tech_stack.some((t) => t.toLowerCase().includes(q)) ||
            p.tags.some((t) => t.toLowerCase().includes(q))
          )
      );
    }

    if (badgeFilter !== "all") {
      filtered = filtered.filter((u) => u.badge_level === badgeFilter);
    }

    if (selectedTech.length > 0) {
      filtered = filtered.filter(u =>
        u.projects.some(p => p.tech_stack.some(t => selectedTech.includes(t)))
      );
    }
    if (minStreak > 0) {
      filtered = filtered.filter(u => u.streak >= minStreak);
    }
    if (maxStreak < 365) {
      filtered = filtered.filter(u => u.streak <= maxStreak);
    }
    if (availableOnly) {
      filtered = filtered.filter(u => u.streak > 0);
    }
    if (hasProjects) {
      filtered = filtered.filter(u => u.projects.length > 0);
    }

    switch (sortBy) {
      case "vibe_score":
        filtered.sort((a, b) => b.vibe_score - a.vibe_score);
        break;
      case "streak":
        filtered.sort((a, b) => b.streak - a.streak);
        break;
      case "projects":
        filtered.sort((a, b) => b.projects.length - a.projects.length);
        break;
      case "newest":
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    return filtered;
  }, [users, search, sortBy, badgeFilter, selectedTech, minStreak, maxStreak, availableOnly, hasProjects]);

  return (
    <>
      {/* AI Agent Banner */}
      <Link
        href="/agent/find"
        className="flex items-center gap-4 p-4 mb-10 transition-all hover:translate-x-[1px] hover:translate-y-[1px]"
        style={{
          backgroundColor: "#0F0F0F",
          border: "2px solid #0F0F0F",
          boxShadow: "var(--shadow-brutal-sm)",
        }}
      >
        <div
          className="w-10 h-10 shrink-0 flex items-center justify-center"
          style={{ backgroundColor: "var(--accent)" }}
        >
          <Bot size={20} className="text-white" />
        </div>
        <div>
          <div className="text-sm font-extrabold uppercase text-white">
            Let AI Find Your Perfect Match
          </div>
          <div className="text-xs font-medium text-zinc-400">
            Describe your project and our agent will rank the best vibe coders for you
          </div>
        </div>
      </Link>

      {/* Search & Filters */}
      <div className="mb-8 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
            <input
              type="text"
              placeholder="Search by name, tech stack, or tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-brutal" style={{ paddingLeft: "2.5rem" }}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-3 text-sm font-extrabold uppercase tracking-wide cursor-pointer transition-colors"
            style={{
              backgroundColor: showFilters ? "var(--accent)" : "#FFFFFF",
              color: showFilters ? "#FFFFFF" : "#0F0F0F",
              border: "2px solid #0F0F0F",
            }}
          >
            <SlidersHorizontal size={16} />
            Filters
          </button>
        </div>

        {showFilters && (
          <div
            className="flex flex-wrap gap-4 p-4"
            style={{
              backgroundColor: "#FFFFFF",
              border: "2px solid #0F0F0F",
              boxShadow: "var(--shadow-brutal-sm)",
            }}
          >
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="input-brutal py-2 w-auto"
              >
                <option value="vibe_score">Highest Vibe Score</option>
                <option value="streak">Longest Streak</option>
                <option value="projects">Most Projects</option>
                <option value="newest">Newest</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">Badge Level</label>
              <select
                value={badgeFilter}
                onChange={(e) => setBadgeFilter(e.target.value as BadgeLevel | "all")}
                className="input-brutal py-2 w-auto"
              >
                <option value="all">All Badges</option>
                <option value="diamond">Diamond</option>
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
                <option value="bronze">Bronze</option>
                <option value="none">No Badge</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-2 block">Tech Stack</label>
              <div className="flex flex-wrap gap-1.5">
                {allTechStacks.slice(0, 20).map((tech) => (
                  <button key={tech} onClick={() => setSelectedTech(prev => prev.includes(tech) ? prev.filter(t => t !== tech) : [...prev, tech])}
                    className="px-2.5 py-1 text-xs font-bold transition-all"
                    style={{
                      backgroundColor: selectedTech.includes(tech) ? "var(--accent)" : "#FFFFFF",
                      color: selectedTech.includes(tech) ? "#FFFFFF" : "#0F0F0F",
                      border: "2px solid #0F0F0F",
                    }}>
                    {tech}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-2 block">Streak Range</label>
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={365} value={minStreak} onChange={(e) => setMinStreak(Number(e.target.value))}
                  className="input-brutal w-20 text-center text-sm py-1.5" placeholder="Min" />
                <span className="text-sm font-bold text-[#71717A]">to</span>
                <input type="number" min={0} max={365} value={maxStreak} onChange={(e) => setMaxStreak(Number(e.target.value))}
                  className="input-brutal w-20 text-center text-sm py-1.5" placeholder="Max" />
                <span className="text-xs font-bold text-[#71717A]">days</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAvailableOnly(!availableOnly)}
                className="px-3 py-1.5 text-xs font-bold transition-all"
                style={{
                  backgroundColor: availableOnly ? "#0F0F0F" : "#FFFFFF",
                  color: availableOnly ? "#FFFFFF" : "#0F0F0F",
                  border: "2px solid #0F0F0F",
                }}>
                🟢 Active Only
              </button>
              <button onClick={() => setHasProjects(!hasProjects)}
                className="px-3 py-1.5 text-xs font-bold transition-all"
                style={{
                  backgroundColor: hasProjects ? "#0F0F0F" : "#FFFFFF",
                  color: hasProjects ? "#FFFFFF" : "#0F0F0F",
                  border: "2px solid #0F0F0F",
                }}>
                📦 Has Projects
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Active Filter Pills */}
      {(selectedTech.length > 0 || minStreak > 0 || maxStreak < 365 || availableOnly || hasProjects) && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {selectedTech.map(tech => (
            <span key={tech} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold bg-[var(--accent)] text-white border-2 border-[#0F0F0F]">
              {tech}
              <button onClick={() => setSelectedTech(prev => prev.filter(t => t !== tech))} className="hover:opacity-70">×</button>
            </span>
          ))}
          {minStreak > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold bg-[#0F0F0F] text-white border-2 border-[#0F0F0F]">
              Min: {minStreak}d <button onClick={() => setMinStreak(0)} className="hover:opacity-70">×</button>
            </span>
          )}
          {maxStreak < 365 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold bg-[#0F0F0F] text-white border-2 border-[#0F0F0F]">
              Max: {maxStreak}d <button onClick={() => setMaxStreak(365)} className="hover:opacity-70">×</button>
            </span>
          )}
          {availableOnly && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold bg-[#0F0F0F] text-white border-2 border-[#0F0F0F]">
              Active Only <button onClick={() => setAvailableOnly(false)} className="hover:opacity-70">×</button>
            </span>
          )}
          {hasProjects && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold bg-[#0F0F0F] text-white border-2 border-[#0F0F0F]">
              Has Projects <button onClick={() => setHasProjects(false)} className="hover:opacity-70">×</button>
            </span>
          )}
          <button onClick={() => { setSelectedTech([]); setMinStreak(0); setMaxStreak(365); setAvailableOnly(false); setHasProjects(false); }}
            className="px-2 py-1 text-xs font-bold text-[var(--accent)] hover:underline">
            Clear all
          </button>
        </div>
      )}

      {/* Results count */}
      <p className="mb-4 text-sm font-bold uppercase tracking-wide text-[#71717A]">
        {`${filteredUsers.length} builder${filteredUsers.length !== 1 ? "s" : ""} found`}
      </p>

      {/* Grid */}
      {filteredUsers.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
          {filteredUsers.map((user) => (
            <VibecoderCard key={user.id} user={user} />
          ))}
        </div>
      ) : (
        <div
          className="p-12 text-center"
          style={{
            backgroundColor: "#FFFFFF",
            border: "2px solid #0F0F0F",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <p className="text-[#52525B] font-bold uppercase">No builders match your search.</p>
          <button
            onClick={() => { setSearch(""); setBadgeFilter("all"); setSelectedTech([]); setMinStreak(0); setMaxStreak(365); setAvailableOnly(false); setHasProjects(false); }}
            className="mt-3 text-sm font-bold uppercase text-[var(--accent)] hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
