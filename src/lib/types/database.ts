export type BadgeLevel = "none" | "bronze" | "silver" | "gold" | "diamond";

export interface User {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  github_username: string | null;
  streak: number;
  longest_streak: number;
  vibe_score: number;
  badge_level: BadgeLevel;
  streak_freezes_remaining: number;
  streak_freezes_used: number;
  referral_count: number;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string;
  tech_stack: string[];
  live_url: string | null;
  github_url: string | null;
  image_url: string | null;
  build_time: string | null;
  tags: string[];
  verified: boolean;
  quality_score: number;
  quality_metrics: RepoQualityData | null;
  live_url_ok: boolean | null;
  endorsement_count: number;
  created_at: string;
}

export interface RepoQualityData {
  stars: number;
  forks: number;
  contributors: number;
  total_commits: number;
  has_tests: boolean;
  has_ci: boolean;
  has_readme: boolean;
  community_score: number;
  substance_score: number;
  maintenance_score: number;
  quality_score: number;
  analyzed_at: string;
}

export interface StreakLog {
  id: string;
  user_id: string;
  activity_date: string;
}

export interface SocialLinks {
  id: string;
  user_id: string;
  twitter: string | null;
  telegram: string | null;
  github: string | null;
  website: string | null;
  farcaster: string | null;
}

export interface UserWithSocials extends User {
  social_links: SocialLinks | null;
  projects: Project[];
  last_activity_date?: string | null;
  client_outcomes?: ClientOutcomes | null;
}

export interface HireRequest {
  id: string;
  builder_id: string;
  sender_name: string;
  sender_email: string;
  sender_user_id: string | null;
  message: string;
  budget: string | null;
  status: string;
  reply: string | null;
  replied_at: string | null;
  created_at: string;
}

export interface HireMessage {
  id: string;
  hire_request_id: string;
  sender_type: "builder" | "client";
  message: string;
  created_at: string;
}

export interface Review {
  id: string;
  builder_id: string;
  reviewer_name: string;
  reviewer_email: string;
  hire_request_id: string | null;
  rating: number;
  comment: string | null;
  trust_score: number;
  created_at: string;
}

export interface ProjectEndorsement {
  id: string;
  project_id: string;
  user_id: string;
  created_at: string;
}

export interface ClientOutcomes {
  total_hires: number;
  completed_hires: number;
  avg_rating: number;
  total_reviews: number;
  repeat_clients: number;
  avg_response_hours: number | null;
  completion_rate: number;
  outcome_score: number;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  created_at: string;
}

export type NotificationType = "hire_request" | "streak_milestone" | "streak_warning" | "badge_earned" | "project_verified" | "project_flagged" | "new_review" | "profile_view_summary" | "weekly_digest" | "vibe_score_milestone" | "project_missing_links" | "referral_prompt";

export interface ProfileView {
  id: string;
  viewed_user_id: string;
  viewer_user_id: string | null;
  viewer_ip_hash: string | null;
  viewed_at: string;
}

export interface EmailPreferences {
  user_id: string;
  profile_view_digest: boolean;
  streak_reminders: boolean;
  milestone_alerts: boolean;
  weekly_digest: boolean;
  hire_notifications: boolean;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Database {
  PostgrestVersion: "12";
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, "id" | "created_at" | "streak" | "longest_streak" | "vibe_score" | "badge_level"> & {
          id?: string;
          created_at?: string;
          streak?: number;
          longest_streak?: number;
          vibe_score?: number;
          badge_level?: BadgeLevel;
          streak_freezes_remaining?: number;
          streak_freezes_used?: number;
          referral_count?: number;
        };
        Update: Partial<User>;
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, "id" | "created_at" | "verified" | "quality_score" | "quality_metrics" | "live_url_ok" | "endorsement_count"> & {
          id?: string;
          created_at?: string;
          verified?: boolean;
          quality_score?: number;
          quality_metrics?: RepoQualityData | null;
          live_url_ok?: boolean | null;
          endorsement_count?: number;
        };
        Update: Partial<Project>;
      };
      streak_logs: {
        Row: StreakLog;
        Insert: Omit<StreakLog, "id"> & { id?: string };
        Update: Partial<StreakLog>;
      };
      social_links: {
        Row: SocialLinks;
        Insert: Omit<SocialLinks, "id"> & { id?: string };
        Update: Partial<SocialLinks>;
      };
      hire_requests: {
        Row: HireRequest;
        Insert: Omit<HireRequest, "id" | "created_at" | "status"> & {
          id?: string;
          created_at?: string;
          status?: string;
        };
        Update: Partial<HireRequest>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, "id" | "created_at" | "read"> & {
          id?: string;
          created_at?: string;
          read?: boolean;
        };
        Update: Partial<Notification>;
      };
      project_endorsements: {
        Row: ProjectEndorsement;
        Insert: Omit<ProjectEndorsement, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<ProjectEndorsement>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      badge_level: BadgeLevel;
    };
  };
}
