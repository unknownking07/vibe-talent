"use client";

import { useState, useMemo, useCallback } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { ProjectCard } from "@/components/ui/project-card";
import { Pagination } from "@/components/ui/pagination";
import type { Project } from "@/lib/types/database";

const PAGE_SIZE = 12;
type SortOption = "newest" | "endorsements" | "quality";

interface ProjectWithAuthor extends Project {
  users?: { username: string; display_name: string | null; avatar_url: string | null; badge_level: string };
}

export function ProjectsContent({ projects }: { projects: ProjectWithAuthor[] }) {
  const [search, _setSearch] = useState("");
  const [sortBy, _setSortBy] = useState<SortOption>("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTech, _setSelectedTech] = useState<string[]>([]);
  const [verifiedOnly, _setVerifiedOnly] = useState(false);
  const [hasLiveUrl, _setHasLiveUrl] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const setSearch = useCallback((v: string) => { _setSearch(v); setCurrentPage(1); }, []);
  const setSortBy = useCallback((v: SortOption) => { _setSortBy(v); setCurrentPage(1); }, []);
  const setSelectedTech = useCallback((v: string[] | ((prev: string[]) => string[])) => { _setSelectedTech(v); setCurrentPage(1); }, []);
  const setVerifiedOnly = useCallback((v: boolean) => { _setVerifiedOnly(v); setCurrentPage(1); }, []);
  const setHasLiveUrl = useCallback((v: boolean) => { _setHasLiveUrl(v); setCurrentPage(1); }, []);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const allTechStacks = useMemo(() => {
    const techs = new Set<string>();
    projects.forEach(p => (p.tech_stack ?? []).forEach(t => techs.add(t)));
    return [...techs].sort();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    let filtered = [...projects];

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q)) ||
        (p.tech_stack ?? []).some(t => t.toLowerCase().includes(q)) ||
        (p.tags ?? []).some(t => t.toLowerCase().includes(q))
      );
    }

    if (verifiedOnly) filtered = filtered.filter(p => p.verified);
    if (hasLiveUrl) filtered = filtered.filter(p => p.live_url);
    if (selectedTech.length > 0) {
      filtered = filtered.filter(p =>
        selectedTech.some(t => (p.tech_stack ?? []).map(s => s.toLowerCase()).includes(t.toLowerCase()))
      );
    }

    switch (sortBy) {
      case "endorsements":
        filtered.sort((a, b) => (b.endorsement_count || 0) - (a.endorsement_count || 0));
        break;
      case "quality":
        filtered.sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0));
        break;
      case "newest":
      default:
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return filtered;
  }, [projects, search, sortBy, verifiedOnly, hasLiveUrl, selectedTech]);

  const totalPages = Math.ceil(filteredProjects.length / PAGE_SIZE);
  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const activeFilterCount = [verifiedOnly, hasLiveUrl, selectedTech.length > 0].filter(Boolean).length;

  return (
    <>
      {/* Search + Sort + Filter toggle */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search projects by name, tech, or tag..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border-2 border-[var(--border-hard)] bg-[var(--card-bg)] text-[var(--foreground)] font-medium text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>
        <div className="flex gap-3">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
            className="px-4 py-2.5 border-2 border-[var(--border-hard)] bg-[var(--card-bg)] text-[var(--foreground)] font-bold text-sm uppercase cursor-pointer focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="newest">Newest</option>
            <option value="endorsements">Most Endorsed</option>
            <option value="quality">Highest Quality</option>
          </select>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 border-2 font-bold text-sm uppercase transition-colors ${
              showFilters || activeFilterCount > 0
                ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                : "border-[var(--border-hard)] text-[var(--foreground)] bg-[var(--card-bg)]"
            }`}
          >
            <SlidersHorizontal size={14} />
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
        </div>
      </div>

      {/* Expandable filter panel */}
      {showFilters && (
        <div className="mb-6 p-4 border-2 border-[var(--border-hard)] bg-[var(--card-bg)]">
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)] cursor-pointer">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={e => setVerifiedOnly(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              Verified only
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)] cursor-pointer">
              <input
                type="checkbox"
                checked={hasLiveUrl}
                onChange={e => setHasLiveUrl(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              Has live URL
            </label>
          </div>

          {allTechStacks.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase text-[var(--text-secondary)] mb-2">Tech Stack</p>
              <div className="flex flex-wrap gap-2">
                {allTechStacks.slice(0, 20).map(tech => (
                  <button
                    key={tech}
                    onClick={() =>
                      setSelectedTech(prev =>
                        prev.includes(tech) ? prev.filter(t => t !== tech) : [...prev, tech]
                      )
                    }
                    className={`px-3 py-1 text-xs font-bold uppercase border-2 transition-colors ${
                      selectedTech.includes(tech)
                        ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                        : "border-[var(--border-hard)] text-[var(--text-secondary)] hover:border-[var(--foreground)]"
                    }`}
                  >
                    {tech}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeFilterCount > 0 && (
            <button
              onClick={() => { setVerifiedOnly(false); setHasLiveUrl(false); setSelectedTech([]); }}
              className="mt-4 text-xs font-bold uppercase text-[var(--accent)] hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Results count — only when no pagination is needed (paginated case puts the count inside <Pagination />) */}
      {filteredProjects.length > 0 && filteredProjects.length <= PAGE_SIZE && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-[var(--text-secondary)] font-medium">
            Showing {filteredProjects.length} project{filteredProjects.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
      {filteredProjects.length === 0 && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-[var(--text-secondary)] font-medium">
            No projects found
          </p>
        </div>
      )}

      {/* Project grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
        {paginatedProjects.map(project => (
          <ProjectCard
            key={project.id}
            project={project}
            authorUsername={project.users?.username}
            showReport
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            label="Projects"
            pageSize={PAGE_SIZE}
            totalItems={filteredProjects.length}
            itemNoun="projects"
          />
        </div>
      )}
    </>
  );
}
