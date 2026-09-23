"use client";

import { useEffect, useMemo, useState } from "react";
import { Github, Search } from "lucide-react";
import type { RepoPickerOption } from "@/lib/github-repo-picker";

type Props = {
  selectedUrl: string;
  onSelect: (repo: RepoPickerOption) => void;
};

export function GithubRepoPicker({ selectedUrl, onSelect }: Props) {
  const [repos, setRepos] = useState<RepoPickerOption[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/github/repos", { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load repositories.");
        return body.repos as RepoPickerOption[];
      })
      .then((items) => setRepos(items))
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Could not load repositories.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);

  const visible = useMemo(() => {
    const matching = query.trim()
      ? repos.filter((repo) =>
          `${repo.name} ${repo.description}`.toLowerCase().includes(query.trim().toLowerCase()),
        )
      : repos;
    return matching.slice(0, query.trim() ? 20 : 8);
  }, [repos, query]);

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] p-4 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
          <Github size={16} /> Pick a GitHub repo
        </h3>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Choose one to fill the project details below. You can edit them before adding it.
        </p>
      </div>

      {loading && <p className="text-xs text-[var(--text-secondary)]">Loading your public repos...</p>}

      {!loading && error && (
        <div className="text-xs text-[var(--text-secondary)]">
          <p>{error} You can still enter a GitHub URL below.</p>
          <button type="button" onClick={() => { setLoading(true); setError(""); setRetry((value) => value + 1); }} className="mt-2 font-semibold text-[#FF3A00]">
            Try again
          </button>
        </div>
      )}

      {!loading && !error && repos.length === 0 && (
        <p className="text-xs text-[var(--text-secondary)]">
          No public repos found on this GitHub account. You can enter a repo URL below or skip this step.
        </p>
      )}

      {!loading && !error && repos.length > 0 && (
        <>
          {repos.length > 8 && (
            <label className="relative block">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <span className="sr-only">Search your repositories</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${repos.length} public repos`}
                className="input-brutal w-full pl-9 text-sm"
              />
            </label>
          )}
          <div className="max-h-64 overflow-y-auto space-y-1.5" aria-label="GitHub repositories">
            {visible.map((repo) => (
              <button
                key={repo.github_url}
                type="button"
                aria-pressed={selectedUrl === repo.github_url}
                onClick={() => onSelect(repo)}
                className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${selectedUrl === repo.github_url ? "border-[#FF3A00] bg-[#FF3A00]/10" : "border-[var(--border-subtle)] hover:border-[#FF3A00]"}`}
              >
                <span className="block text-sm font-semibold text-[var(--foreground)] truncate">{repo.name}</span>
                {repo.description && <span className="block text-xs text-[var(--text-secondary)] truncate">{repo.description}</span>}
                {repo.language && <span className="block text-[10px] text-[var(--text-secondary)] mt-0.5">{repo.language}</span>}
              </button>
            ))}
            {visible.length === 0 && <p className="text-xs text-[var(--text-secondary)] py-2">No matching repositories.</p>}
          </div>
        </>
      )}
    </div>
  );
}
