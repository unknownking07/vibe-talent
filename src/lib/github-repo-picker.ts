import type { GithubIdentity } from "@/lib/github-identity";
import { normalizeRepoUrl } from "@/lib/url-normalize";

export type RepoPickerOption = {
  name: string;
  description: string;
  language: string;
  github_url: string;
};

/** Keep only public, usable repositories belonging to the connected account. */
export function toRepoPickerOptions(
  raw: unknown,
  identity: GithubIdentity,
): RepoPickerOption[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((value): RepoPickerOption[] => {
    if (!value || typeof value !== "object") return [];
    const repo = value as Record<string, unknown>;
    if (
      repo.private !== false ||
      repo.fork !== false ||
      repo.archived !== false ||
      repo.disabled !== false ||
      typeof repo.name !== "string" ||
      !repo.name.trim() ||
      typeof repo.html_url !== "string" ||
      !repo.owner ||
      typeof repo.owner !== "object"
    ) return [];

    const owner = repo.owner as Record<string, unknown>;
    if (
      typeof owner.login !== "string" ||
      owner.login.toLowerCase() !== identity.username.toLowerCase() ||
      (identity.id !== null && owner.id !== identity.id)
    ) return [];

    const githubUrl = normalizeRepoUrl(repo.html_url);
    if (
      !githubUrl ||
      githubUrl.toLowerCase() !==
        `https://github.com/${owner.login}/${repo.name}`.toLowerCase()
    ) return [];

    return [{
      name: repo.name,
      description: typeof repo.description === "string" ? repo.description : "",
      language: typeof repo.language === "string" ? repo.language : "",
      github_url: githubUrl,
    }];
  });
}
