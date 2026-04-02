"use client";

import Link from "next/link";
import Image from "next/image";
import { BadgeDisplay } from "./badge-display";
import { StreakCounter } from "./streak-counter";
import { VibeScore } from "./vibe-score";
import { Code2, ExternalLink, Activity } from "lucide-react";
import type { UserWithSocials } from "@/lib/types/database";

interface VibecoderCardProps {
  user: UserWithSocials;
  rank?: number;
}

function getActivityLabel(lastActivityDate?: string | null): { text: string; color: string } | null {
  if (!lastActivityDate) return null;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  if (lastActivityDate === today) return { text: "Active today", color: "text-emerald-600" };
  if (lastActivityDate === yesterdayStr) return { text: "Active yesterday", color: "text-emerald-500" };

  const diffMs = now.getTime() - new Date(lastActivityDate).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) return { text: `Active ${diffDays}d ago`, color: "text-amber-600" };

  return null;
}

export function VibecoderCard({ user, rank }: VibecoderCardProps) {
  const initials = user.username.slice(0, 2).toUpperCase();
  const activity = getActivityLabel(user.last_activity_date);

  return (
    <Link href={`/profile/${user.username}`}>
      <div
        className="group relative p-5 transition-all card-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--border-hard)] h-full flex flex-col"
      >
        {rank && (
          <div
            className="absolute -top-3 -left-3 flex h-8 w-8 items-center justify-center text-xs font-extrabold text-white"
            style={{
              backgroundColor: "var(--accent)",
              border: "2px solid var(--border-hard)",
            }}
          >
            #{rank}
          </div>
        )}

        <div className="flex items-start gap-4 flex-1">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center text-sm font-extrabold text-white overflow-hidden"
            style={{
              backgroundColor: "var(--bg-inverted)",
              border: "2px solid var(--border-hard)",
            }}
          >
            {user.avatar_url ? (
              <Image src={user.avatar_url} alt={user.username} width={48} height={48} className="w-full h-full object-cover" unoptimized />
            ) : (
              initials
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold uppercase text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                @{user.username}
              </h3>
              <BadgeDisplay level={user.badge_level} size="sm" />
            </div>

            {activity && (
              <span className={`inline-flex items-center gap-1 text-xs font-bold ${activity.color} mt-0.5`}>
                <Activity size={10} />
                {activity.text}
              </span>
            )}

            <p className="mt-1 text-sm text-[var(--text-secondary)] font-medium line-clamp-2">
              {user.bio || "No bio yet"}
            </p>

            <div className="mt-3 flex items-center gap-4 flex-wrap">
              <StreakCounter streak={user.streak} size="sm" />
              <VibeScore score={user.vibe_score} size="sm" />
              <div className="flex items-center gap-1 text-sm font-bold text-[var(--text-secondary)]">
                <Code2 size={14} />
                <span>{(user.projects ?? []).length} projects</span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5 min-h-[28px]">
              {(user.projects ?? []).length > 0 ? (
                (user.projects ?? []).slice(0, 3).map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-[var(--text-tertiary)]"
                    style={{
                      backgroundColor: "var(--bg-surface-light)",
                      border: "1px solid var(--border-hard)",
                    }}
                  >
                    <ExternalLink size={10} />
                    {p.title}
                  </span>
                ))
              ) : (
                <span className="text-xs font-medium text-zinc-400 italic">
                  No projects shipped yet
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
