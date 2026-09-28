import type { Project } from "@/lib/types/database";

// Public projects can have only a title or placeholder description. Keep those
// browsable while reserving search landing pages for inspectable work.
type SearchProject = Pick<
  Project,
  "verified" | "live_url" | "github_url" | "title" | "description"
>;

export function isIndexableProject(project: SearchProject): boolean {
  return Boolean(
    project.verified &&
      project.live_url &&
      project.github_url &&
      project.title.trim().length >= 3 &&
      project.description?.trim().length >= 80,
  );
}
