"use client";

// DEMO ROUTE — self-contained preview of the achievements redesign using
// sample data, so the new badge design + unlock celebration can be tested on
// any dev server without a Supabase backend or a logged-in profile.
//
// Visit: /achievements-demo
//
// NOTE: This is a development aid, not a production page. Remove before merging
// to main if you don't want it shipped.
import { AchievementsExperience } from "@/components/achievements/achievements-experience";
import type { AchievementView } from "@/components/achievements/achievement-card";

const DEMO: AchievementView[] = [
  { id: "streak_bronze", title: "Bronze Streak", description: "Log a 30-day coding streak.", category: "consistency", current: 30, threshold: 30, unit: "days", earned: true, percent: 100 },
  { id: "streak_silver", title: "Silver Streak", description: "Log a 90-day coding streak.", category: "consistency", current: 40, threshold: 90, unit: "days", earned: false, percent: 44 },
  { id: "streak_gold", title: "Gold Streak", description: "Log a 180-day coding streak.", category: "consistency", current: 40, threshold: 180, unit: "days", earned: false, percent: 22 },
  { id: "streak_diamond", title: "Diamond Streak", description: "Log a full-year 365-day coding streak.", category: "consistency", current: 40, threshold: 365, unit: "days", earned: false, percent: 11 },
  { id: "project_first", title: "First Ship", description: "Add your first project to your profile.", category: "projects", current: 1, threshold: 1, unit: "projects", earned: true, percent: 100 },
  { id: "project_builder", title: "Builder", description: "Ship 5 projects.", category: "projects", current: 5, threshold: 5, unit: "projects", earned: true, percent: 100 },
  { id: "project_prolific", title: "Prolific", description: "Ship 10 projects.", category: "projects", current: 5, threshold: 10, unit: "projects", earned: false, percent: 50 },
  { id: "project_verified", title: "Verified Builder", description: "Get one project verified via GitHub.", category: "projects", current: 1, threshold: 1, unit: "verified", earned: true, percent: 100 },
  { id: "project_quality", title: "Quality Coder", description: "Ship a project with a quality score of 70 or higher.", category: "projects", current: 70, threshold: 70, unit: "score", earned: true, percent: 100 },
  { id: "endorse_first", title: "First Cheer", description: "Receive your first project endorsement.", category: "community", current: 1, threshold: 1, unit: "endorsements", earned: true, percent: 100 },
  { id: "endorse_liked", title: "Well-Liked", description: "Earn 10 endorsements across your projects.", category: "community", current: 4, threshold: 10, unit: "endorsements", earned: false, percent: 40 },
  { id: "endorse_crowd", title: "Crowd Favorite", description: "Earn 50 endorsements across your projects.", category: "community", current: 4, threshold: 50, unit: "endorsements", earned: false, percent: 8 },
  { id: "hire_first", title: "In Demand", description: "Receive your first hire request from a recruiter or client.", category: "career", current: 0, threshold: 1, unit: "requests", earned: false, percent: 0 },
  { id: "hire_hot", title: "Hot Hire", description: "Receive 5 hire requests.", category: "career", current: 0, threshold: 5, unit: "requests", earned: false, percent: 0 },
  { id: "review_helpful", title: "Helpful Reviewer", description: "Submit 5 reviews on other builders' work.", category: "contributor", current: 2, threshold: 5, unit: "reviews", earned: false, percent: 40 },
  { id: "review_pillar", title: "Community Pillar", description: "Submit 25 reviews on other builders' work.", category: "contributor", current: 2, threshold: 25, unit: "reviews", earned: false, percent: 8 },
  { id: "github_linked", title: "GitHub Linked", description: "Connect your GitHub account to your profile.", category: "identity", current: 1, threshold: 1, unit: "linked", earned: true, percent: 100 },
  { id: "referral_first", title: "Word of Mouth", description: "Refer a friend who signs up to VibeTalent.", category: "identity", current: 0, threshold: 1, unit: "referrals", earned: false, percent: 0 },
  { id: "founding_member", title: "Founding Member", description: "Joined VibeTalent before 2026 — a true early adopter.", category: "identity", current: 1, threshold: 1, unit: "joined", earned: true, percent: 100 },
];

export default function AchievementsDemoPage() {
  const earnedCount = DEMO.filter((v) => v.earned).length;
  return (
    <div className="flex justify-center p-4 sm:p-8">
      <div className="w-full max-w-[1200px] flex flex-col gap-6">
        <AchievementsExperience
          achievements={DEMO}
          username="demo"
          earnedCount={earnedCount}
          totalCount={DEMO.length}
        />
      </div>
    </div>
  );
}
