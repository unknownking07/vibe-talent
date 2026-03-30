"use client";

import { useState, useMemo, useCallback } from "react";
import { VibecoderCard } from "@/components/ui/vibecoder-card";
import { Search, SlidersHorizontal, Bot, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { BadgeLevel, UserWithSocials } from "@/lib/types/database";

const PAGE_SIZE = 15;
type SortOption = "vibe_score" | "streak" | "projects" | "newest";

export function ExploreContent({ users }: { users: UserWithSocials[] }) {
  const [search, _setSearch] = useState("");
  const [sortBy, _setSortBy] = useState<SortOption>("vibe_score");
  const [badgeFilter, _setBadgeFilter] = useState<BadgeLevel | "all">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTech, _setSelectedTech] = useState<string[]>([]);
  const [minStreak, _setMinStreak] = useState(0);
  const [maxStreak, _setMaxStreak] = useState(365);
  const [availableOnly, _setAvailableOnly] = useState(false);
  const [hasProjects, _setHasProjects] = useState(false);
  const [verifiedOnly, _setVerifiedOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Wrap filter setters to auto-reset pagination
  const setSearch = useCallback((v: string) => { _setSearch(v); setCurrentPage(1); }, []);
  const setSortBy = useCallback((v: SortOption) => { _setSortBy(v); setCurrentPage(1); }, []);
  const setBadgeFilter = useCallback((v: BadgeLevel | "all") => { _setBadgeFilter(v); setCurrentPage(1); }, []);
  const setSelectedTech = useCallback((v: string[] | ((prev: string[]) => string[])) => { _setSelectedTech(v); setCurrentPage(1); }, []);
  const setMinStreak = useCallback((v: number) => { _setMinStreak(v); setCurrentPage(1); }, []);
  const setMaxStreak = useCallback((v: number) => { _setMaxStreak(v); setCurrentPage(1); }, []);
  const setAvailableOnly = useCallback((v: boolean) => { _setAvailableOnly(v); setCurrentPage(1); }, []);
  const setHasProjects = useCallback((v: boolean) => { _setHasProjects(v); setCurrentPage(1); }, []);
  const setVerifiedOnly = useCallback((v: boolean) => { _setVerifiedOnly(v); setCurrentPage(1); }, []);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const allTechStacks = useMemo(() => {
    const techs = new Set<string>();
    users.forEach(u => (u.projects ?? []).forEach(p => (p.tech_stack ?? []).forEach(t => techs.add(t))));
    return [...techs].sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    // Default: only show builders who have at least one project AND a bio
    let filtered = users.filter(u => (u.projects ?? []).length > 0 && u.bio);

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.bio?.toLowerCase().includes(q) ||
          (u.projects ?? []).some((p) =>
            p.title?.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q) ||
            (p.tech_stack ?? []).some((t) => t.toLowerCase().includes(q)) ||
            (p.tags ?? []).some((t) => t.toLowerCase().includes(q))
          )
      );
    }

    if (badgeFilter !== "all") {
      filtered = filtered.filter((u) => u.badge_level === badgeFilter);
    }

    if (selectedTech.length > 0) {
      filtered = filtered.filter(u =>
        (u.projects ?? []).some(p => (p.tech_stack ?? []).some(t => selectedTech.includes(t)))
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
      filtered = filtered.filter(u => (u.projects ?? []).length > 0);
    }
    if (verifiedOnly) {
      filtered = filtered.filter(u => (u.projects ?? []).some(p => p.verified));
    }

    // Quality ranking: weighted score combining projects, activity, and reputation
    const qualityScore = (u: typeof filtered[0]) => {
      const projects = u.projects ?? [];
      const projectCount = Math.min(projects.length, 5); // cap at 5
      const verifiedCount = projects.filter(p => p.verified).length;
      const withLiveUrl = projects.filter(p => p.live_url).length;

      // Projects shipped (40% weight) — count + verified + live urls
      const projectScore = (projectCount * 8) + (verifiedCount * 10) + (withLiveUrl * 5);

      // Activity (30% weight) — streak strength
      const streakScore = Math.min(50, u.streak * 0.5);

      // Vibe score / reputation (30% weight)
      const vibeScoreNorm = Math.min(50, u.vibe_score / 10);

      return projectScore * 0.4 + streakScore * 0.3 + vibeScoreNorm * 0.3;
    };

    switch (sortBy) {
      case "vibe_score":
        filtered.sort((a, b) => qualityScore(b) - qualityScore(a) || b.vibe_score - a.vibe_score);
        break;
      case "streak":
        filtered.sort((a, b) => qualityScore(b) - qualityScore(a) || b.streak - a.streak);
        break;
      case "projects":
        filtered.sort((a, b) => qualityScore(b) - qualityScore(a) || (b.projects ?? []).length - (a.projects ?? []).length);
        break;
      case "newest":
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    return filtered;
  }, [users, search, sortBy, badgeFilter, selectedTech, minStreak, maxStreak, availableOnly, hasProjects, verifiedOnly]);

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const activePage = currentPage > totalPages ? 1 : currentPage;
  const paginatedUsers = filteredUsers.slice(
    (activePage - 1) * PAGE_SIZE,
    activePage * PAGE_SIZE
  );

  return (
    <>
      {/* VibeFinder Bot Banner */}
      <Link
        href="/agent/find"
        className="flex items-center gap-4 p-4 mb-10 transition-all hover:translate-x-[1px] hover:translate-y-[1px]"
        style={{
          backgroundColor: "var(--bg-inverted)",
          border: "2px solid var(--border-hard)",
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
            Let VibeFinder Bot Match You
          </div>
          <div className="text-xs font-medium text-zinc-400">
            Describe your project and our bot reads platform data to find the best vibe coders for you
          </div>
        </div>
      </Link>

      {/* Search & Filters */}
      <div className="mb-8 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search by name, bio, projects, tech stack..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-brutal" style={{ paddingLeft: "2.5rem" }}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-3 text-sm font-extrabold uppercase tracking-wide cursor-pointer transition-colors"
            style={{
              backgroundColor: showFilters ? "var(--accent)" : "var(--bg-surface)",
              color: showFilters ? "var(--background)" : "var(--foreground)",
              border: "2px solid var(--border-hard)",
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
              backgroundColor: "var(--bg-surface)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal-sm)",
            }}
          >
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">Sort By</label>
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
              <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">Badge Level</label>
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
              <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2 block">Tech Stack</label>
              <div className="flex flex-wrap gap-1.5">
                {allTechStacks.slice(0, 20).map((tech) => (
                  <button key={tech} onClick={() => setSelectedTech(prev => prev.includes(tech) ? prev.filter(t => t !== tech) : [...prev, tech])}
                    className="px-2.5 py-1 text-xs font-bold transition-all"
                    style={{
                      backgroundColor: selectedTech.includes(tech) ? "var(--accent)" : "var(--bg-surface)",
                      color: selectedTech.includes(tech) ? "var(--background)" : "var(--foreground)",
                      border: "2px solid var(--border-hard)",
                    }}>
                    {tech}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2 block">Streak Range</label>
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={365} value={minStreak} onChange={(e) => setMinStreak(Number(e.target.value))}
                  className="input-brutal w-20 text-center text-sm py-1.5" placeholder="Min" />
                <span className="text-sm font-bold text-[var(--text-muted)]">to</span>
                <input type="number" min={0} max={365} value={maxStreak} onChange={(e) => setMaxStreak(Number(e.target.value))}
                  className="input-brutal w-20 text-center text-sm py-1.5" placeholder="Max" />
                <span className="text-xs font-bold text-[var(--text-muted)]">days</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAvailableOnly(!availableOnly)}
                className="px-3 py-1.5 text-xs font-bold transition-all"
                style={{
                  backgroundColor: availableOnly ? "var(--bg-inverted)" : "var(--bg-surface)",
                  color: availableOnly ? "var(--background)" : "var(--foreground)",
                  border: "2px solid var(--border-hard)",
                }}>
                🟢 Active Only
              </button>
              <button onClick={() => setHasProjects(!hasProjects)}
                className="px-3 py-1.5 text-xs font-bold transition-all"
                style={{
                  backgroundColor: hasProjects ? "var(--bg-inverted)" : "var(--bg-surface)",
                  color: hasProjects ? "var(--background)" : "var(--foreground)",
                  border: "2px solid var(--border-hard)",
                }}>
                📦 Has Projects
              </button>
              <button onClick={() => setVerifiedOnly(!verifiedOnly)}
                className="px-3 py-1.5 text-xs font-bold transition-all"
                style={{
                  backgroundColor: verifiedOnly ? "var(--bg-inverted)" : "var(--bg-surface)",
                  color: verifiedOnly ? "var(--background)" : "var(--foreground)",
                  border: "2px solid var(--border-hard)",
                }}>
                ✅ Verified Projects
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Active Filter Pills */}
      {(selectedTech.length > 0 || minStreak > 0 || maxStreak < 365 || availableOnly || hasProjects || verifiedOnly) && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {selectedTech.map(tech => (
            <span key={tech} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold bg-[var(--accent)] text-white border-2 border-[var(--border-hard)]">
              {tech}
              <button onClick={() => setSelectedTech(prev => prev.filter(t => t !== tech))} className="hover:opacity-70">×</button>
            </span>
          ))}
          {minStreak > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold bg-[var(--bg-inverted)] text-white border-2 border-[var(--border-hard)]">
              Min: {minStreak}d <button onClick={() => setMinStreak(0)} className="hover:opacity-70">×</button>
            </span>
          )}
          {maxStreak < 365 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold bg-[var(--bg-inverted)] text-white border-2 border-[var(--border-hard)]">
              Max: {maxStreak}d <button onClick={() => setMaxStreak(365)} className="hover:opacity-70">×</button>
            </span>
          )}
          {availableOnly && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold bg-[var(--bg-inverted)] text-white border-2 border-[var(--border-hard)]">
              Active Only <button onClick={() => setAvailableOnly(false)} className="hover:opacity-70">×</button>
            </span>
          )}
          {hasProjects && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold bg-[var(--bg-inverted)] text-white border-2 border-[var(--border-hard)]">
              Has Projects <button onClick={() => setHasProjects(false)} className="hover:opacity-70">×</button>
            </span>
          )}
          {verifiedOnly && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold bg-[var(--bg-inverted)] text-white border-2 border-[var(--border-hard)]">
              Verified <button onClick={() => setVerifiedOnly(false)} className="hover:opacity-70">×</button>
            </span>
          )}
          <button onClick={() => { setSelectedTech([]); setMinStreak(0); setMaxStreak(365); setAvailableOnly(false); setHasProjects(false); setVerifiedOnly(false); }}
            className="px-2 py-1 text-xs font-bold text-[var(--accent)] hover:underline">
            Clear all
          </button>
        </div>
      )}

      {/* Results count */}
      <p className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">
        {filteredUsers.length > PAGE_SIZE
          ? `Showing ${(activePage - 1) * PAGE_SIZE + 1}–${Math.min(activePage * PAGE_SIZE, filteredUsers.length)} of ${filteredUsers.length} builders`
          : `${filteredUsers.length} builder${filteredUsers.length !== 1 ? "s" : ""} found`}
      </p>

      {/* Grid */}
      {filteredUsers.length > 0 ? (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
            {paginatedUsers.map((user) => (
              <VibecoderCard key={user.id} user={user} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <button
                onClick={() => goToPage(activePage - 1)}
                disabled={activePage === 1}
                className="flex items-center justify-center w-10 h-10 font-extrabold uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "2px solid var(--border-hard)",
                  boxShadow: "var(--shadow-brutal-sm)",
                }}
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => goToPage(page)}
                  className="flex items-center justify-center w-10 h-10 text-sm font-extrabold uppercase transition-all"
                  style={{
                    backgroundColor: activePage === page ? "var(--accent)" : "var(--bg-surface)",
                    color: activePage === page ? "#FFFFFF" : "var(--foreground)",
                    border: "2px solid var(--border-hard)",
                    boxShadow: activePage === page ? "none" : "var(--shadow-brutal-sm)",
                  }}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => goToPage(activePage + 1)}
                disabled={activePage === totalPages}
                className="flex items-center justify-center w-10 h-10 font-extrabold uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "2px solid var(--border-hard)",
                  boxShadow: "var(--shadow-brutal-sm)",
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      ) : (
        <div
          className="p-12 text-center"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <p className="text-[var(--text-secondary)] font-bold uppercase">No builders match your search.</p>
          <button
            onClick={() => { setSearch(""); setBadgeFilter("all"); setSelectedTech([]); setMinStreak(0); setMaxStreak(365); setAvailableOnly(false); setHasProjects(false); setVerifiedOnly(false); }}
            className="mt-3 text-sm font-bold uppercase text-[var(--accent)] hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
