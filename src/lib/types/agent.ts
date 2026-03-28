import type { UserWithSocials, BadgeLevel } from "./database";

export interface EvaluationDimensions {
  consistency: number;
  project_quality: number;
  tech_breadth: number;
  activity_recency: number;
  reputation: number;
  client_outcomes: number;
}

export interface EvaluationResult {
  username: string;
  overall_score: number;
  dimensions: EvaluationDimensions;
  summary: string;
  strengths: string[];
  risks: string[];
  badge_level: BadgeLevel;
  evaluated_at: string;
}

export interface MatchResult {
  user: UserWithSocials;
  match_score: number;
  match_reasons: string[];
  matched_skills: string[];
  recommended_for: string;
}

export interface TaskRequest {
  description: string;
  tech_stack: string[];
  project_type: "mvp" | "full_product" | "bug_fix" | "consultation";
  timeline: "asap" | "1_week" | "1_month" | "flexible";
  budget: "under_500" | "500_2k" | "2k_5k" | "5k_plus";
}

export interface ContactRequest {
  id: string;
  target_username: string;
  sender_name: string;
  project_description: string;
  message: string;
  status: "drafted" | "sent" | "viewed";
  created_at: string;
}

export interface AgentStep {
  label: string;
  duration: number;
}
