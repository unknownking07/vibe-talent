"use client";

import Link from "next/link";
import { BadgeDisplay } from "./badge-display";
import { StreakCounter } from "./streak-counter";
import { VibeScore } from "./vibe-score";
import { Code2, ExternalLink } from "lucide-react";
import type { UserWithSocials } from "@/lib/types/database";

interface VibecoderCardProps {
  user: UserWithSocials;
  rank?: number;
}

export function VibecoderCard({ user, rank }: VibecoderCardProps) {
  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <Link href={`/profile/${user.username}`}>
      <div
        className="group relative p-5 transition-all card-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#0F0F0F]"
      >
        {rank && (
          <div
            className="absolute -top-3 -left-3 flex h-8 w-8 items-center justify-center text-xs font-extrabold text-white"
            style={{
              backgroundColor: "var(--accent)",
              border: "2px solid #0F0F0F",
            }}
          >
            #{rank}
          </div>
        )}

        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center text-sm font-extrabold text-white"
            style={{
              backgroundColor: "#0F0F0F",
              border: "2px solid #0F0F0F",
            }}
          >
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold uppercase text-[#0F0F0F] group-hover:text-[var(--accent)] transition-colors">
                @{user.username}
              </h3>
              <BadgeDisplay level={user.badge_level} size="sm" />
            </div>

            {user.bio && (
              <p className="mt-1 text-sm text-[#52525B] font-medium line-clamp-2">
                {user.bio}
              </p>
            )}

            <div className="mt-3 flex items-center gap-4 flex-wrap">
              <StreakCounter streak={user.streak} size="sm" />
              <VibeScore score={user.vibe_score} size="sm" />
              <div className="flex items-center gap-1 text-sm font-bold text-[#52525B]">
                <Code2 size={14} />
                <span>{user.projects.length} projects</span>
              </div>
            </div>

            {user.projects.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {user.projects.slice(0, 3).map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-[#0F0F0F]"
                    style={{
                      backgroundColor: "#F5F5F5",
                      border: "1px solid #0F0F0F",
                    }}
                  >
                    <ExternalLink size={10} />
                    {p.title}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
