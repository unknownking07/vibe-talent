"use client";

import { useState, useMemo, useCallback } from "react";
import { VibecoderCard } from "@/components/ui/vibecoder-card";
import { Search, SlidersHorizontal } from "lucide-react";
import { Lightning, Package, SealCheck, X } from "@phosphor-icons/react";
import { Pagination } from "@/components/ui/pagination";
import Link from "next/link";
import type { BadgeLevel, UserWithSocials } from "@/lib/types/database";
import { BotMark } from "@/components/icons/brand";

const PAGE_SIZE = 15;
type SortOption = "vibe_score" | "streak" | "projects" | "newest";

// Filter-panel visual language (presentation only)
const FILTER_LABEL =
  "block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2";

/** One shared "selected" treatment: accent-tinted fill + accent border. */
const chipStyle = (active: boolean) => ({
  backgroundColor: active
    ? "color-mix(in srgb, var(--accent) 14%, var(--bg-surface))"
    : "var(--bg-surface)",
  color: active ? "var(--foreground)" : "var(--text-secondary)",
  border: `1px solid ${active ? "var(--accent)" : "var(--border-subtle)"}`,
});

const ACTIVE_PILL_STYLE = {
  backgroundColor: "color-mix(in srgb, var(--accent) 14%, var(--bg-surface))",
  border: "1px solid var(--accent)",
  color: "var(--foreground)",
};

const PILL_REMOVE_BTN =
  "inline-flex items-center justify-center rounded-full p-0.5 cursor-pointer text-[var(--text-muted)] transition-colors hover:text-[var(--foreground)]";

/**
 * Read a streak bound from a number input, falling back to its default.
 *
 * Clearing a number input yields "", and Number("") is 0. On the maximum that
 * silently became "show only builders with a zero streak" — the opposite of
 * clearing the filter.
 */
function streakInput(raw: string, fallback: number): number {
  if (!raw.trim()) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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
  const setSearch = useCallback((v: string) => {
    _setSearch(v);
    setCurrentPage(1);
  }, []);
  const setSortBy = useCallback((v: SortOption) => {
    _setSortBy(v);
    setCurrentPage(1);
  }, []);
  const setBadgeFilter = useCallback((v: BadgeLevel | "all") => {
    _setBadgeFilter(v);
    setCurrentPage(1);
  }, []);
  const setSelectedTech = useCallback(
    (v: string[] | ((prev: string[]) => string[])) => {
      _setSelectedTech(v);
      setCurrentPage(1);
    },
    [],
  );
  const setMinStreak = useCallback((v: number) => {
    _setMinStreak(v);
    setCurrentPage(1);
  }, []);
  const setMaxStreak = useCallback((v: number) => {
    _setMaxStreak(v);
    setCurrentPage(1);
  }, []);
  const setAvailableOnly = useCallback((v: boolean) => {
    _setAvailableOnly(v);
    setCurrentPage(1);
  }, []);
  const setHasProjects = useCallback((v: boolean) => {
    _setHasProjects(v);
    setCurrentPage(1);
  }, []);
  const setVerifiedOnly = useCallback((v: boolean) => {
    _setVerifiedOnly(v);
    setCurrentPage(1);
  }, []);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const allTechStacks = useMemo(() => {
    const techs = new Set<string>();
    users.forEach((u) =>
      (u.projects ?? []).forEach((p) =>
        (p.tech_stack ?? []).forEach((t) => techs.add(t)),
      ),
    );
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
          (u.projects ?? []).some(
            (p) =>
              p.title?.toLowerCase().includes(q) ||
              p.description?.toLowerCase().includes(q) ||
              (p.tech_stack ?? []).some((t) => t.toLowerCase().includes(q)) ||
              (p.tags ?? []).some((t) => t.toLowerCase().includes(q)),
          ),
      );
    }

    if (badgeFilter !== "all") {
      filtered = filtered.filter((u) => u.badge_level === badgeFilter);
    }

    if (selectedTech.length > 0) {
      filtered = filtered.filter((u) =>
        (u.projects ?? []).some((p) =>
          (p.tech_stack ?? []).some((t) => selectedTech.includes(t)),
        ),
      );
    }
    if (minStreak > 0) {
      filtered = filtered.filter((u) => u.streak >= minStreak);
    }
    if (maxStreak < 365) {
      filtered = filtered.filter((u) => u.streak <= maxStreak);
    }
    if (availableOnly) {
      filtered = filtered.filter((u) => u.streak > 0);
    }
    if (hasProjects) {
      filtered = filtered.filter((u) => (u.projects ?? []).length > 0);
    }
    if (verifiedOnly) {
      filtered = filtered.filter((u) =>
        (u.projects ?? []).some((p) => p.verified),
      );
    }

    // Quality ranking: normalized 0-1 scores, profiles with projects always above those without
    const qualityScore = (u: (typeof filtered)[0]) => {
      const projects = u.projects ?? [];

      // No projects = always last, regardless of streak/score
      if (projects.length === 0) return -1;

      const projectCount = Math.min(projects.length, 5);
      const verifiedCount = Math.min(
        projects.filter((p) => p.verified).length,
        5,
      );
      const withLiveUrl = Math.min(
        projects.filter((p) => p.live_url).length,
        5,
      );

      // All axes normalized to 0-1
      // Max project raw = (5*8)+(5*10)+(5*5) = 115
      const projectNorm =
        (projectCount * 8 + verifiedCount * 10 + withLiveUrl * 5) / 115;
      const streakNorm = Math.min(u.streak, 100) / 100;
      const vibeNorm = Math.min(u.vibe_score, 500) / 500;

      return projectNorm * 0.4 + streakNorm * 0.3 + vibeNorm * 0.3;
    };

    // Has-projects first, then sort by selected field, quality score as tiebreaker
    const hasProj = (u: (typeof filtered)[0]) =>
      (u.projects ?? []).length > 0 ? 1 : 0;

    switch (sortBy) {
      case "vibe_score":
        filtered.sort(
          (a, b) =>
            hasProj(b) - hasProj(a) ||
            b.vibe_score - a.vibe_score ||
            qualityScore(b) - qualityScore(a),
        );
        break;
      case "streak":
        filtered.sort(
          (a, b) =>
            hasProj(b) - hasProj(a) ||
            b.streak - a.streak ||
            qualityScore(b) - qualityScore(a),
        );
        break;
      case "projects":
        filtered.sort(
          (a, b) =>
            hasProj(b) - hasProj(a) ||
            (b.projects ?? []).length - (a.projects ?? []).length ||
            qualityScore(b) - qualityScore(a),
        );
        break;
      case "newest":
        filtered.sort(
          (a, b) =>
            hasProj(b) - hasProj(a) ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        break;
    }

    return filtered;
  }, [
    users,
    search,
    sortBy,
    badgeFilter,
    selectedTech,
    minStreak,
    maxStreak,
    availableOnly,
    hasProjects,
    verifiedOnly,
  ]);

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const activePage = currentPage > totalPages ? 1 : currentPage;
  const paginatedUsers = filteredUsers.slice(
    (activePage - 1) * PAGE_SIZE,
    activePage * PAGE_SIZE,
  );

  return (
    <>
      {/* VibeFinder Robot Banner */}
      <Link
        href="/agent/find"
        className="flex items-center gap-4 p-4 mb-10 rounded-2xl bg-[var(--bg-inverted)] border border-[var(--border-hard)] shadow-[var(--shadow-brutal-sm)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-brutal-hover)]"
      >
        <div
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg"
          style={{ backgroundColor: "var(--accent)" }}
        >
          <BotMark weight="fill" size={20} className="text-white" />
        </div>
        <div>
          <div className="text-sm font-bold text-white">
            Let VibeFinder Robot Match You
          </div>
          <div className="text-xs font-medium text-zinc-400">
            Describe your project and our bot reads platform data to find the
            best vibe coders for you
          </div>
        </div>
      </Link>

      {/* Search & Filters */}
      <div className="mb-8 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              type="text"
              placeholder="Search by name, bio, projects, tech stack..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-brutal"
              style={{ paddingLeft: "2.5rem" }}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls="explore-filter-panel"
            className="flex items-center gap-2 px-4 py-3 text-sm font-semibold cursor-pointer rounded-xl transition-colors"
            style={{
              backgroundColor: showFilters
                ? "color-mix(in srgb, var(--accent) 14%, var(--bg-surface))"
                : "var(--bg-surface)",
              color: "var(--foreground)",
              border: `1px solid ${showFilters ? "var(--accent)" : "var(--border-hard)"}`,
            }}
          >
            <SlidersHorizontal size={16} />
            Filters
          </button>
        </div>

        {showFilters && (
          <div id="explore-filter-panel" className="card-brutal p-5">
            {/* Sorting */}
            <div className="flex flex-wrap gap-4">
              <div className="w-full sm:w-auto">
                <label htmlFor="explore-sort-by" className={FILTER_LABEL}>
                  Sort By
                </label>
                <select
                  id="explore-sort-by"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="input-brutal py-2 sm:w-auto"
                >
                  <option value="vibe_score">Highest Vibe Score</option>
                  <option value="streak">Longest Streak</option>
                  <option value="projects">Most Projects</option>
                  <option value="newest">Newest</option>
                </select>
              </div>
              <div className="w-full sm:w-auto">
                <label htmlFor="explore-badge-level" className={FILTER_LABEL}>
                  Badge Level
                </label>
                <select
                  id="explore-badge-level"
                  value={badgeFilter}
                  onChange={(e) =>
                    setBadgeFilter(e.target.value as BadgeLevel | "all")
                  }
                  className="input-brutal py-2 sm:w-auto"
                >
                  <option value="all">All Badges</option>
                  <option value="diamond">Diamond</option>
                  <option value="gold">Gold</option>
                  <option value="silver">Silver</option>
                  <option value="bronze">Bronze</option>
                  <option value="none">No Badge</option>
                </select>
              </div>
            </div>

            {/* Tech stack */}
            <div className="mt-5 pt-5 border-t border-[var(--border-subtle)]">
              <span className={FILTER_LABEL}>Tech Stack</span>
              <div className="flex flex-wrap gap-1.5">
                {allTechStacks.slice(0, 20).map((tech) => (
                  <button
                    key={tech}
                    onClick={() =>
                      setSelectedTech((prev) =>
                        prev.includes(tech)
                          ? prev.filter((t) => t !== tech)
                          : [...prev, tech],
                      )
                    }
                    aria-pressed={selectedTech.includes(tech)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer"
                    style={chipStyle(selectedTech.includes(tech))}
                  >
                    {tech}
                  </button>
                ))}
              </div>
            </div>

            {/* Streak range + quick toggles */}
            <div className="mt-5 pt-5 border-t border-[var(--border-subtle)] flex flex-wrap gap-x-10 gap-y-5">
              <div>
                <span className={FILTER_LABEL}>Streak Range</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={minStreak}
                    onChange={(e) =>
                      setMinStreak(streakInput(e.target.value, 0))
                    }
                    aria-label="Minimum streak days"
                    className="input-brutal w-20 text-center text-sm py-1.5"
                    placeholder="Min"
                  />
                  <span className="text-sm font-medium text-[var(--text-muted)]">
                    to
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={maxStreak}
                    onChange={(e) =>
                      setMaxStreak(streakInput(e.target.value, 365))
                    }
                    aria-label="Maximum streak days"
                    className="input-brutal w-20 text-center text-sm py-1.5"
                    placeholder="Max"
                  />
                  <span className="text-xs font-medium text-[var(--text-muted)]">
                    days
                  </span>
                </div>
              </div>
              <div>
                <span className={FILTER_LABEL}>Show Only</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setAvailableOnly(!availableOnly)}
                    aria-pressed={availableOnly}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer"
                    style={chipStyle(availableOnly)}
                  >
                    <Lightning
                      size={13}
                      weight="fill"
                      aria-hidden="true"
                      color={availableOnly ? "var(--accent)" : "currentColor"}
                    />
                    Active Only
                  </button>
                  <button
                    onClick={() => setHasProjects(!hasProjects)}
                    aria-pressed={hasProjects}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer"
                    style={chipStyle(hasProjects)}
                  >
                    <Package
                      size={13}
                      weight="fill"
                      aria-hidden="true"
                      color={hasProjects ? "var(--accent)" : "currentColor"}
                    />
                    Has Projects
                  </button>
                  <button
                    onClick={() => setVerifiedOnly(!verifiedOnly)}
                    aria-pressed={verifiedOnly}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer"
                    style={chipStyle(verifiedOnly)}
                  >
                    <SealCheck
                      size={13}
                      weight="fill"
                      aria-hidden="true"
                      color={verifiedOnly ? "var(--accent)" : "currentColor"}
                    />
                    Verified Projects
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Filter Pills */}
      {(selectedTech.length > 0 ||
        minStreak > 0 ||
        maxStreak < 365 ||
        availableOnly ||
        hasProjects ||
        verifiedOnly) && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {selectedTech.map((tech) => (
            <span
              key={tech}
              className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 text-xs font-semibold rounded-full"
              style={ACTIVE_PILL_STYLE}
            >
              {tech}
              <button
                onClick={() =>
                  setSelectedTech((prev) => prev.filter((t) => t !== tech))
                }
                aria-label={`Remove ${tech} filter`}
                className={PILL_REMOVE_BTN}
              >
                <X size={12} weight="bold" />
              </button>
            </span>
          ))}
          {minStreak > 0 && (
            <span
              className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 text-xs font-semibold rounded-full"
              style={ACTIVE_PILL_STYLE}
            >
              Min: {minStreak}d
              <button
                onClick={() => setMinStreak(0)}
                aria-label="Remove minimum streak filter"
                className={PILL_REMOVE_BTN}
              >
                <X size={12} weight="bold" />
              </button>
            </span>
          )}
          {maxStreak < 365 && (
            <span
              className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 text-xs font-semibold rounded-full"
              style={ACTIVE_PILL_STYLE}
            >
              Max: {maxStreak}d
              <button
                onClick={() => setMaxStreak(365)}
                aria-label="Remove maximum streak filter"
                className={PILL_REMOVE_BTN}
              >
                <X size={12} weight="bold" />
              </button>
            </span>
          )}
          {availableOnly && (
            <span
              className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 text-xs font-semibold rounded-full"
              style={ACTIVE_PILL_STYLE}
            >
              Active Only
              <button
                onClick={() => setAvailableOnly(false)}
                aria-label="Remove active only filter"
                className={PILL_REMOVE_BTN}
              >
                <X size={12} weight="bold" />
              </button>
            </span>
          )}
          {hasProjects && (
            <span
              className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 text-xs font-semibold rounded-full"
              style={ACTIVE_PILL_STYLE}
            >
              Has Projects
              <button
                onClick={() => setHasProjects(false)}
                aria-label="Remove has projects filter"
                className={PILL_REMOVE_BTN}
              >
                <X size={12} weight="bold" />
              </button>
            </span>
          )}
          {verifiedOnly && (
            <span
              className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 text-xs font-semibold rounded-full"
              style={ACTIVE_PILL_STYLE}
            >
              Verified
              <button
                onClick={() => setVerifiedOnly(false)}
                aria-label="Remove verified projects filter"
                className={PILL_REMOVE_BTN}
              >
                <X size={12} weight="bold" />
              </button>
            </span>
          )}
          <button
            onClick={() => {
              setSelectedTech([]);
              setMinStreak(0);
              setMaxStreak(365);
              setAvailableOnly(false);
              setHasProjects(false);
              setVerifiedOnly(false);
            }}
            className="px-2 py-1 text-xs font-semibold cursor-pointer text-[var(--accent)] hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Results count — only shown when no pagination is needed; paginated case puts the count inside <Pagination /> */}
      {filteredUsers.length > 0 && filteredUsers.length <= PAGE_SIZE && (
        <p className="mb-4 text-sm font-medium text-[var(--text-muted)]">
          {filteredUsers.length} builder{filteredUsers.length !== 1 ? "s" : ""}{" "}
          found
        </p>
      )}

      {/* Grid */}
      {filteredUsers.length > 0 ? (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
            {paginatedUsers.map((user) => (
              <VibecoderCard key={user.id} user={user} />
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-10">
            <Pagination
              currentPage={activePage}
              totalPages={totalPages}
              onPageChange={goToPage}
              label="Builders Directory"
              pageSize={PAGE_SIZE}
              totalItems={filteredUsers.length}
              itemNoun="builders"
            />
          </div>
        </>
      ) : (
        <div className="card-brutal p-12 text-center">
          <p className="text-[var(--text-secondary)] font-semibold">
            No builders match your search.
          </p>
          <button
            onClick={() => {
              setSearch("");
              setBadgeFilter("all");
              setSelectedTech([]);
              setMinStreak(0);
              setMaxStreak(365);
              setAvailableOnly(false);
              setHasProjects(false);
              setVerifiedOnly(false);
            }}
            className="mt-3 text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
