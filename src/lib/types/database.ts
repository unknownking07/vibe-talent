export type BadgeLevel = "none" | "bronze" | "silver" | "gold" | "diamond";

export interface User {
  id: string;
  username: string;
  email: string;
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
        Insert: Omit<Project, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      badge_level: BadgeLevel;
    };
  };
}
