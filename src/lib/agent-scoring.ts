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

  // Project Quality: use GitHub quality scores when available, fallback to heuristics
  const verifiedProjects = (user.projects ?? []).filter(p => p.verified);
  const unverifiedProjects = (user.projects ?? []).filter(p => !p.verified);
  const withLiveUrl = verifiedProjects.filter(p => p.live_url).length;
  const withGithub = verifiedProjects.filter(p => p.github_url).length;

  // Use quality_metrics presence as the indicator that analysis ran (quality_score === 0 can be a valid result)
  const scoredProjects = verifiedProjects.filter(p => p.quality_metrics != null);
  let project_quality: number;
  if (scoredProjects.length > 0) {
    // Average quality score of analyzed projects (weighted heavily)
    const avgQuality = scoredProjects.reduce((sum, p) => sum + p.quality_score, 0) / scoredProjects.length;
    // Bonus for quantity of quality projects + live URLs
    const quantityBonus = Math.min(20, scoredProjects.length * 5);
    const liveBonus = Math.min(15, withLiveUrl * 5);
    const liveSiteOkBonus = verifiedProjects.filter(p => p.live_url_ok === true).length * 5;
    project_quality = clamp(0, 100,
      avgQuality * 0.6 + quantityBonus + liveBonus + liveSiteOkBonus + unverifiedProjects.length * 1
    );
  } else {
    // Fallback: original heuristic scoring
    const avgDescLen = verifiedProjects.length > 0
      ? verifiedProjects.reduce((sum, p) => sum + p.description.length, 0) / verifiedProjects.length
      : 0;
    project_quality = clamp(0, 100,
      verifiedProjects.length * 15 + unverifiedProjects.length * 2 +
      withLiveUrl * 10 + withGithub * 5 + (avgDescLen > 50 ? 10 : 0)
    );
  }

  // Tech Breadth: unique technologies
  const allTech = new Set((user.projects ?? []).flatMap(p => (p.tech_stack ?? []).map(t => t.toLowerCase())));
  const tech_breadth = clamp(0, 100, allTech.size * 12);

  // Activity Recency: based on active streak
  const activity_recency = user.streak > 0
    ? clamp(0, 100, 60 + Math.min(40, user.streak * 0.4))
    : 20;

  // Endorsements bonus: peer-validated projects boost quality
  const totalEndorsements = (user.projects ?? []).reduce((sum, p) => sum + (p.endorsement_count || 0), 0);
  const endorsementBonus = Math.min(15, totalEndorsements * 3);
  project_quality = clamp(0, 100, project_quality + endorsementBonus);

  // Reputation: based on vibe_score, badge, and client reviews
  const badgeBonus = { none: 0, bronze: 10, silver: 20, gold: 35, diamond: 50 };
  const reviews = (user as unknown as Record<string, unknown>).reviews as Array<{ rating: number }> | undefined;
  const reviewBonus = reviews && reviews.length > 0
    ? Math.min(25, Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * reviews.length * 1.5))
    : 0;
  const reputation = clamp(0, 100,
    (user.vibe_score / 9) + (badgeBonus[user.badge_level] || 0) + reviewBonus
  );

  // Client Outcomes: real hire completions, trusted reviews, repeat clients
  const outcomes = user.client_outcomes;
  const client_outcomes = outcomes?.outcome_score != null
    ? clamp(0, 100, outcomes.outcome_score)
    : 0;

  return { consistency, project_quality, tech_breadth, activity_recency, reputation, client_outcomes };
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
    parts.push(`Has shipped ${(user.projects ?? []).length} quality projects with live deployments and source code.`);
  } else if ((user.projects ?? []).length > 0) {
    parts.push(`Has ${(user.projects ?? []).length} project${(user.projects ?? []).length > 1 ? "s" : ""} in their portfolio.`);
  }

  const allTech = [...new Set((user.projects ?? []).flatMap(p => p.tech_stack))];
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
  const verifiedProjCount = (user.projects ?? []).filter(p => p.verified).length;
  const highQualityCount = (user.projects ?? []).filter(p => p.quality_score >= 50).length;
  if (highQualityCount >= 2) strengths.push(`${highQualityCount} high-quality verified projects`);
  else if (verifiedProjCount >= 3) strengths.push(`${verifiedProjCount} verified shipped projects`);
  else if ((user.projects ?? []).length >= 3) strengths.push(`${(user.projects ?? []).length} shipped projects`);
  const hasTests = (user.projects ?? []).some(p => p.quality_metrics?.has_tests);
  if (hasTests) strengths.push("Projects include test suites");
  const hasCi = (user.projects ?? []).some(p => p.quality_metrics?.has_ci);
  if (hasCi) strengths.push("Uses CI/CD pipelines");
  if (dims.tech_breadth > 60) strengths.push("Diverse tech stack");
  if ((user.projects ?? []).some(p => p.live_url)) strengths.push("Has live deployed projects");
  if ((user.projects ?? []).some(p => p.github_url)) strengths.push("Open source contributor");
  if (user.vibe_score > 500) strengths.push(`High vibe score: ${user.vibe_score}`);
  if (user.client_outcomes) {
    if (user.client_outcomes.completed_hires >= 3) strengths.push(`${user.client_outcomes.completed_hires} completed hires`);
    if (user.client_outcomes.avg_rating >= 4.5 && user.client_outcomes.total_reviews >= 2) strengths.push(`${user.client_outcomes.avg_rating}/5 avg rating from trusted reviews`);
    if (user.client_outcomes.repeat_clients > 0) strengths.push(`${user.client_outcomes.repeat_clients} repeat client${user.client_outcomes.repeat_clients > 1 ? "s" : ""}`);
    if (user.client_outcomes.avg_response_hours !== null && user.client_outcomes.avg_response_hours <= 4) strengths.push("Fast responder (< 4h avg)");
  }
  const totalEndorsements = (user.projects ?? []).reduce((sum, p) => sum + (p.endorsement_count || 0), 0);
  if (totalEndorsements >= 5) strengths.push(`${totalEndorsements} peer endorsements across projects`);
  return strengths.slice(0, 6);
}

function extractRisks(user: UserWithSocials, dims: EvaluationDimensions): string[] {
  const risks: string[] = [];
  const unverifiedCount = (user.projects ?? []).filter(p => !p.verified).length;
  const verifiedCount = (user.projects ?? []).filter(p => p.verified).length;
  if (unverifiedCount > 0 && verifiedCount === 0) risks.push("No verified projects — ownership unconfirmed");
  else if (unverifiedCount > verifiedCount) risks.push(`${unverifiedCount} of ${(user.projects ?? []).length} projects are unverified`);
  const lowQualityCount = (user.projects ?? []).filter(p => p.verified && p.quality_score > 0 && p.quality_score < 20).length;
  if (lowQualityCount > 0) risks.push(`${lowQualityCount} project${lowQualityCount > 1 ? "s" : ""} scored low on quality analysis`);
  if (user.streak === 0) risks.push("Currently inactive — no active streak");
  if ((user.projects ?? []).length < 2) risks.push("Limited project portfolio");
  if (!user.social_links?.telegram) risks.push("No Telegram for quick communication");
  if (!(user.projects ?? []).some(p => p.live_url)) risks.push("No live deployed projects");
  if (dims.tech_breadth < 30) risks.push("Narrow tech stack");
  if (user.badge_level === "none") risks.push("No badge earned yet");
  if (user.client_outcomes) {
    if (user.client_outcomes.total_hires > 0 && user.client_outcomes.completion_rate < 50) {
      risks.push(`Low completion rate: ${user.client_outcomes.completion_rate}%`);
    }
    if (user.client_outcomes.avg_response_hours !== null && user.client_outcomes.avg_response_hours > 72) {
      risks.push("Slow to respond (> 3 days avg)");
    }
  }
  return risks.slice(0, 5);
}

export function evaluateUser(user: UserWithSocials): EvaluationResult {
  const dims = evaluateDimensions(user);

  // Weights: quality and client outcomes are heaviest (hardest to fake)
  // Consistency is lowest weight (easiest to fake with daily commits)
  const overall = Math.round(
    dims.project_quality * 0.25 +
    dims.client_outcomes * 0.20 +
    dims.consistency * 0.15 +
    dims.tech_breadth * 0.15 +
    dims.activity_recency * 0.10 +
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
      client_outcomes: Math.round(dims.client_outcomes),
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
    const userTech = (user.projects ?? []).flatMap(p => (p.tech_stack ?? []).map(t => t.toLowerCase()));
    const userTechSet = new Set(userTech);
    const userTags = (user.projects ?? []).flatMap(p => (p.tags ?? []).map(t => t.toLowerCase()));

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
    if ((user.projects ?? []).length > 2) match_reasons.push(`Shipped ${(user.projects ?? []).length} projects`);
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
