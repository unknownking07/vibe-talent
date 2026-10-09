import { AGENT_EVAL } from "./scoring-config";

export interface ProjectEvidenceInput {
  verified: boolean;
  is_private?: boolean;
  flagged?: boolean;
  live_url?: string | null;
  live_url_ok?: boolean | null;
  quality_metrics?: {
    has_readme?: boolean;
    has_tests?: boolean;
    has_ci?: boolean;
  } | null;
}

/** File/config presence is inspectable evidence, not proof of passing tests or delivery.
 * Keep the weights aligned with public.project_evidence_score in the migration.
 * Activity, popularity, legacy quality_score and project volume earn no credit.
 */
export function projectEvidenceScore(project: ProjectEvidenceInput): number {
  if (!project.verified || project.is_private || project.flagged) return 0;
  const E = AGENT_EVAL.projectEvidence;
  return (
    E.ownership +
    (project.quality_metrics?.has_readme === true ? E.readme : 0) +
    (project.quality_metrics?.has_tests === true ? E.testRelatedFiles : 0) +
    (project.quality_metrics?.has_ci === true ? E.ciOrContainerConfig : 0) +
    (project.live_url && project.live_url_ok === true ? E.reachableDemo : 0)
  );
}

/** Descriptive repository checklist, independent of commit and code volume. */
export function repositoryChecksScore(
  metrics: ProjectEvidenceInput["quality_metrics"],
): number {
  return (
    (metrics?.has_readme === true ? 30 : 0) +
    (metrics?.has_tests === true ? 40 : 0) +
    (metrics?.has_ci === true ? 30 : 0)
  );
}
