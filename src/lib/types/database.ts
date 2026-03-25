export type BadgeLevel = "none" | "bronze" | "silver" | "gold" | "diamond";

export interface User {
  id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  streak: number;
  longest_streak: number;
  vibe_score: number;
  badge_level: BadgeLevel;
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
  created_at: string;
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
}

export interface HireRequest {
  id: string;
  builder_id: string;
  sender_name: string;
  sender_email: string;
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
  created_at: string;
}

export type NotificationType = "hire_request" | "streak_milestone" | "streak_warning" | "badge_earned" | "project_verified" | "project_flagged";

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
        };
        Update: Partial<User>;
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, "id" | "created_at" | "verified"> & {
          id?: string;
          created_at?: string;
          verified?: boolean;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      badge_level: BadgeLevel;
    };
  };
}
