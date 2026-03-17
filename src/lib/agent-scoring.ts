import type { UserWithSocials } from "./types/database";
import type { EvaluationResult, EvaluationDimensions, MatchResult, TaskRequest } from "./types/agent";

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

function evaluateDimensions(user: UserWithSocials): EvaluationDimensions {
  // Consistency: based on streak and longest_streak
  const consistency = clamp(0, 100,
    (user.streak * 0.6 + user.longest_streak * 0.4) / 3.65 * 10
  );

  // Project Quality: count, URLs, description length
  const projCount = user.projects.length;
  const withLiveUrl = user.projects.filter(p => p.live_url).length;
  const withGithub = user.projects.filter(p => p.github_url).length;
  const avgDescLen = projCount > 0
    ? user.projects.reduce((sum, p) => sum + p.description.length, 0) / projCount
    : 0;
  const project_quality = clamp(0, 100,
    projCount * 15 + withLiveUrl * 10 + withGithub * 5 + (avgDescLen > 50 ? 10 : 0)
  );

  // Tech Breadth: unique technologies
  const allTech = new Set(user.projects.flatMap(p => p.tech_stack.map(t => t.toLowerCase())));
  const tech_breadth = clamp(0, 100, allTech.size * 12);

  // Activity Recency: based on active streak
  const activity_recency = user.streak > 0
    ? clamp(0, 100, 60 + Math.min(40, user.streak * 0.4))
    : 20;

  // Reputation: based on vibe_score and badge
  const badgeBonus = { none: 0, bronze: 10, silver: 20, gold: 35, diamond: 50 };
  const reputation = clamp(0, 100,
    (user.vibe_score / 9) + (badgeBonus[user.badge_level] || 0)
  );

  return { consistency, project_quality, tech_breadth, activity_recency, reputation };
}

function generateSummary(user: UserWithSocials, dims: EvaluationDimensions, overall: number): string {
  const parts: string[] = [];

  if (dims.consistency > 70) {
    parts.push(`Demonstrates exceptional consistency with a ${user.streak}-day active streak.`);
  } else if (dims.consistency > 40) {
    parts.push(`Shows solid commitment with a ${user.streak}-day coding streak.`);
  } else {
    parts.push(`Currently building consistency with a ${user.streak}-day streak.`);
  }

  if (dims.project_quality > 60) {
    parts.push(`Has shipped ${user.projects.length} quality projects with live deployments and source code.`);
  } else if (user.projects.length > 0) {
    parts.push(`Has ${user.projects.length} project${user.projects.length > 1 ? "s" : ""} in their portfolio.`);
  }

  const allTech = [...new Set(user.projects.flatMap(p => p.tech_stack))];
  if (allTech.length > 4) {
    parts.push(`Versatile tech stack spanning ${allTech.slice(0, 4).join(", ")}, and more.`);
  }

  if (overall >= 80) {
    parts.push("Highly recommended for production-grade work.");
  } else if (overall >= 60) {
    parts.push("A reliable builder for most project types.");
  }

  return parts.join(" ");
}

function extractStrengths(user: UserWithSocials, dims: EvaluationDimensions): string[] {
  const strengths: string[] = [];
  if (user.streak > 90) strengths.push(`${user.streak}-day active coding streak`);
  else if (user.streak > 30) strengths.push(`${user.streak}-day streak shows dedication`);
  if (user.badge_level === "diamond") strengths.push("Diamond badge holder — top tier");
  else if (user.badge_level === "gold") strengths.push("Gold badge — proven consistency");
  if (user.projects.length >= 3) strengths.push(`${user.projects.length} shipped projects`);
  if (dims.tech_breadth > 60) strengths.push("Diverse tech stack");
  if (user.projects.some(p => p.live_url)) strengths.push("Has live deployed projects");
  if (user.projects.some(p => p.github_url)) strengths.push("Open source contributor");
  if (user.vibe_score > 500) strengths.push(`High vibe score: ${user.vibe_score}`);
  return strengths.slice(0, 5);
}

function extractRisks(user: UserWithSocials, dims: EvaluationDimensions): string[] {
  const risks: string[] = [];
  if (user.streak === 0) risks.push("Currently inactive — no active streak");
  if (user.projects.length < 2) risks.push("Limited project portfolio");
  if (!user.social_links?.telegram) risks.push("No Telegram for quick communication");
  if (!user.projects.some(p => p.live_url)) risks.push("No live deployed projects");
  if (dims.tech_breadth < 30) risks.push("Narrow tech stack");
  if (user.badge_level === "none") risks.push("No badge earned yet");
  return risks.slice(0, 4);
}

export function evaluateUser(user: UserWithSocials): EvaluationResult {
  const dims = evaluateDimensions(user);
  const overall = Math.round(
    dims.consistency * 0.30 +
    dims.project_quality * 0.25 +
    dims.tech_breadth * 0.15 +
    dims.activity_recency * 0.15 +
    dims.reputation * 0.15
  );

  return {
    username: user.username,
    overall_score: overall,
    dimensions: {
      consistency: Math.round(dims.consistency),
      project_quality: Math.round(dims.project_quality),
      tech_breadth: Math.round(dims.tech_breadth),
      activity_recency: Math.round(dims.activity_recency),
      reputation: Math.round(dims.reputation),
    },
    summary: generateSummary(user, dims, overall),
    strengths: extractStrengths(user, dims),
    risks: extractRisks(user, dims),
    badge_level: user.badge_level,
    evaluated_at: new Date().toISOString(),
  };
}

export function matchUsers(users: UserWithSocials[], task: TaskRequest): MatchResult[] {
  const requestedTech = task.tech_stack.map(t => t.toLowerCase().trim()).filter(Boolean);

  const results = users.map(user => {
    const userTech = user.projects.flatMap(p => p.tech_stack.map(t => t.toLowerCase()));
    const userTechSet = new Set(userTech);
    const userTags = user.projects.flatMap(p => p.tags.map(t => t.toLowerCase()));

    // Skill overlap (40%)
    const matchedSkills = requestedTech.filter(t => userTechSet.has(t));
    const skillScore = requestedTech.length > 0
      ? (matchedSkills.length / requestedTech.length) * 100
      : 50;

    // Evaluation score (30%)
    const evalResult = evaluateUser(user);
    const evalScore = evalResult.overall_score;

    // Tag relevance (15%)
    const descWords = task.description.toLowerCase().split(/\s+/);
    const tagMatches = userTags.filter(t => descWords.some(w => t.includes(w) || w.includes(t)));
    const tagScore = tagMatches.length > 0 ? 80 : 20;

    // Availability proxy (15%)
    const availScore = user.streak > 0 ? Math.min(100, user.streak * 2) : 10;

    const match_score = Math.round(
      skillScore * 0.40 +
      evalScore * 0.30 +
      tagScore * 0.15 +
      availScore * 0.15
    );

    const match_reasons: string[] = [];
    if (matchedSkills.length > 0) match_reasons.push(`Knows ${matchedSkills.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")}`);
    if (user.streak > 30) match_reasons.push(`${user.streak}-day active streak`);
    if (user.badge_level !== "none") match_reasons.push(`${user.badge_level.charAt(0).toUpperCase() + user.badge_level.slice(1)} badge holder`);
    if (user.projects.length > 2) match_reasons.push(`Shipped ${user.projects.length} projects`);
    if (user.vibe_score > 400) match_reasons.push(`Vibe score: ${user.vibe_score}`);

    const projectTypeLabels = {
      mvp: "MVP development",
      full_product: "Full product build",
      bug_fix: "Bug fixing & maintenance",
      consultation: "Technical consultation",
    };

    return {
      user,
      match_score,
      match_reasons: match_reasons.slice(0, 4),
      matched_skills: matchedSkills.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
      recommended_for: projectTypeLabels[task.project_type] || "General development",
    };
  });

  return results.sort((a, b) => b.match_score - a.match_score).slice(0, 5);
}

export function generateHireMessage(
  senderName: string,
  targetUsername: string,
  projectDescription: string,
  matchedSkills: string[]
): string {
  const skillPart = matchedSkills.length > 0
    ? ` Your expertise in ${matchedSkills.join(", ")} makes you an ideal candidate.`
    : "";

  return `Hi @${targetUsername},

I'm ${senderName}, and I came across your profile on VibeTalent. Your consistent shipping track record caught my attention.${skillPart}

I'm working on a project: ${projectDescription}

I'd love to discuss this opportunity with you. Are you available for a quick chat?

Best,
${senderName}`;
}
