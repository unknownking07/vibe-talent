import type { Project, UserWithSocials } from "./types/database";
import type { EvaluationResult, EvaluationDimensions, MatchResult, TaskRequest } from "./types/agent";
import { AGENT_EVAL, MATCH } from "./scoring-config";
import { projectEvidenceScore } from "./project-evidence";
export { projectEvidenceScore } from "./project-evidence";

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Ownership verification provides inspectable evidence, not delivery assurance. */
export function publicVerifiedProjects(user: UserWithSocials): Project[] {
  return (user.projects ?? []).filter(project =>
    project.verified && !project.is_private &&
    !(project as Project & { flagged?: boolean }).flagged
  );
}

function evaluateDimensions(user: UserWithSocials): EvaluationDimensions {
  const C = AGENT_EVAL.consistency;
  const consistency = clamp(0, 100,
    (user.streak * C.streakWeight + user.longest_streak * C.longestStreakWeight) / C.normalizer * C.scale
  );
  const projects = publicVerifiedProjects(user);
  // Duplicates and project volume add no points.
  const project_quality = Math.max(0, ...projects.map(projectEvidenceScore));
  const allTech = new Set(projects.flatMap(p => (p.tech_stack ?? []).map(t => t.trim().toLowerCase())).filter(Boolean));
  const tech_breadth = clamp(0, 100, allTech.size * AGENT_EVAL.techBreadth.perUniqueTech);

  // Activity Recency: based on active streak
  const AR = AGENT_EVAL.activityRecency;
  const activity_recency = user.streak > 0
    ? clamp(0, 100, AR.activeBase + Math.min(AR.activeMaxBonus, user.streak * AR.perStreakDay))
    : AR.inactiveScore;

  // Reputation: based on vibe_score, badge, and client reviews
  const REP = AGENT_EVAL.reputation;
  const reviews = (user as unknown as Record<string, unknown>).reviews as Array<{ rating: number }> | undefined;
  const reviewBonus = reviews && reviews.length > 0
    ? Math.min(REP.reviewCap, Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * reviews.length * REP.reviewMultiplier))
    : 0;
  const reputation = clamp(0, 100,
    (user.vibe_score / REP.vibeScoreDivisor) + (AGENT_EVAL.badgeBonuses[user.badge_level] || 0) + reviewBonus
  );

  // The current hire flow records replies, not accepted deliverables.
  const client_outcomes = null;

  return { consistency, project_quality, tech_breadth, activity_recency, reputation, client_outcomes };
}

function generateSummary(user: UserWithSocials): string {
  const count = publicVerifiedProjects(user).length;
  const portfolio = count > 0
    ? `${count} public project${count === 1 ? " has" : "s have"} GitHub ownership verification. The score reflects inspectable repository signals on the strongest project.`
    : "No public projects with verified GitHub ownership are available to assess.";
  return `${portfolio} Commit counts, streaks, badges, and vibe score do not increase this score. Repository checks do not verify product functionality or client delivery; inspect the work and agree a paid trial before hiring.`;
}

function extractStrengths(user: UserWithSocials): string[] {
  const projects = publicVerifiedProjects(user);
  const strengths: string[] = [];
  if (projects.length > 0) strengths.push(`${projects.length} public project${projects.length === 1 ? "" : "s"} with GitHub ownership verified`);
  if (projects.some(p => p.quality_metrics?.has_readme)) strengths.push("README detected in a verified repository");
  if (projects.some(p => p.quality_metrics?.has_tests)) strengths.push("Test-related files or configuration detected; execution not verified");
  if (projects.some(p => p.quality_metrics?.has_ci)) strengths.push("CI or container configuration detected; runs not verified");
  if (projects.some(p => p.live_url && p.live_url_ok === true)) strengths.push("A live URL was reachable at its last check");
  return strengths.slice(0, AGENT_EVAL.maxStrengths);
}

function extractRisks(user: UserWithSocials): string[] {
  const projects = publicVerifiedProjects(user);
  const risks = ["Client delivery is not verified. Agree scope, acceptance criteria, and a paid trial with the builder."];
  if (projects.length === 0) risks.push("No public projects with verified GitHub ownership");
  if ((user.projects ?? []).some(p => !p.verified && !p.is_private)) risks.push("Some public projects are unverified; ownership is unconfirmed");
  if (!projects.some(p => p.live_url && p.live_url_ok === true)) risks.push("No live demo confirmed reachable; inspect the source and request a walkthrough");
  if (projects.some(p => p.quality_metrics == null)) risks.push("Repository analysis is unavailable for some verified projects");
  return risks.slice(0, AGENT_EVAL.maxRisks);
}

export function evaluateUser(user: UserWithSocials): EvaluationResult {
  const dims = evaluateDimensions(user);

  // Only inspectable portfolio signals affect the hiring evaluation.
  const overall = Math.round(dims.project_quality);

  return {
    username: user.username,
    overall_score: overall,
    dimensions: {
      consistency: Math.round(dims.consistency),
      project_quality: Math.round(dims.project_quality),
      tech_breadth: Math.round(dims.tech_breadth),
      activity_recency: Math.round(dims.activity_recency),
      reputation: Math.round(dims.reputation),
      client_outcomes: dims.client_outcomes,
    },
    summary: generateSummary(user),
    strengths: extractStrengths(user),
    risks: extractRisks(user),
    badge_level: user.badge_level,
    evaluated_at: new Date().toISOString(),
  };
}

export function matchUsers(users: UserWithSocials[], task: TaskRequest): MatchResult[] {
  const requestedTech = task.tech_stack.map(t => t.toLowerCase().trim()).filter(Boolean);

  const results = users.map(user => {
    const projects = publicVerifiedProjects(user);
    const userTech = projects.flatMap(p => (p.tech_stack ?? []).map(t => t.trim().toLowerCase()));
    const userTechSet = new Set(userTech);
    const userTags = projects.flatMap(p => (p.tags ?? []).map(t => t.trim().toLowerCase()).filter(Boolean));

    // Skill overlap
    const matchedSkills = requestedTech.filter(t => userTechSet.has(t));
    const skillScore = requestedTech.length > 0
      ? (matchedSkills.length / requestedTech.length) * 100
      : MATCH.defaultSkillScore;

    // Evaluation score
    const evalResult = evaluateUser(user);
    const evalScore = evalResult.overall_score;

    // Tag relevance
    const descWords = task.description.toLowerCase().split(/\s+/);
    const tagMatches = userTags.filter(t => descWords.some(w => t.includes(w) || w.includes(t)));
    const tagScore = tagMatches.length > 0 ? MATCH.tagMatchScore : MATCH.tagNoMatchScore;

    const match_score = projects.length === 0 ? 0 : Math.round(
      skillScore * MATCH.weights.skill +
      evalScore * MATCH.weights.evaluation +
      tagScore * MATCH.weights.tag
    );

    const match_reasons: string[] = [];
    if (matchedSkills.length > 0) match_reasons.push(`Listed on ownership-verified projects: ${matchedSkills.join(", ")}`);
    if (projects.length > 0) match_reasons.push(`${projects.length} public project${projects.length === 1 ? "" : "s"} with GitHub ownership verified`);
    else match_reasons.push("No public ownership-verified project evidence");
    if (projects.some(p => p.live_url && p.live_url_ok === true)) match_reasons.push("Live URL reachable at its last check");
    match_reasons.push("Delivery not verified; review the work before agreeing a trial");

    const projectTypeLabels = {
      mvp: "MVP development",
      full_product: "Full product build",
      bug_fix: "Bug fixing & maintenance",
      consultation: "Technical consultation",
    };

    return {
      user,
      match_score,
      match_reasons: match_reasons.slice(0, MATCH.maxReasons),
      matched_skills: matchedSkills.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
      recommended_for: projectTypeLabels[task.project_type] || "General development",
    };
  });

  return results.sort((a, b) => b.match_score - a.match_score || a.user.username.localeCompare(b.user.username)).slice(0, MATCH.maxResults);
}

export function generateHireMessage(
  senderName: string,
  targetUsername: string,
  projectDescription: string,
  matchedSkills: string[]
): string {
  const skillPart = matchedSkills.length > 0
    ? ` I saw ${matchedSkills.join(", ")} listed on your projects.`
    : "";

  return `Hi @${targetUsername},

I'm ${senderName}, and I came across your profile on VibeTalent. Your project portfolio caught my attention.${skillPart}

I'm working on a project: ${projectDescription}

I'd love to discuss this opportunity with you. Are you available for a quick chat?

Best,
${senderName}`;
}
