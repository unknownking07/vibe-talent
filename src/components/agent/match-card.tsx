"use client";

import Link from "next/link";
import Image from "next/image";
import type { MatchResult } from "@/lib/types/agent";
import { BadgeDisplay } from "@/components/ui/badge-display";
import { Bot, ArrowRight } from "lucide-react";

interface MatchCardProps {
  match: MatchResult;
  rank: number;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#16A34A";
  if (score >= 60) return "#FF3A00";
  return "#DC2626";
}

export function MatchCard({ match, rank }: MatchCardProps) {
  const { user, match_score, match_reasons, matched_skills, recommended_for } = match;
  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <div
      className="p-5 transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#0F0F0F]"
      style={{
        backgroundColor: "#FFFFFF",
        border: "2px solid #0F0F0F",
        boxShadow: rank === 1 ? "var(--shadow-brutal-accent)" : "var(--shadow-brutal)",
      }}
    >
      <div className="flex items-start gap-4">
        {/* Rank + Avatar */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="text-xs font-extrabold text-white px-2 py-0.5"
            style={{ backgroundColor: rank === 1 ? "var(--accent)" : "#0F0F0F" }}
          >
            #{rank}
          </div>
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center text-sm font-extrabold text-white overflow-hidden"
            style={{ backgroundColor: "#0F0F0F", border: "2px solid #0F0F0F" }}
          >
            {user.avatar_url ? (
              <Image src={user.avatar_url} alt={user.username} width={48} height={48} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold uppercase text-[#0F0F0F]">@{user.username}</h3>
              <BadgeDisplay level={user.badge_level} size="sm" />
            </div>
            <div
              className="font-extrabold font-mono text-lg"
              style={{ color: getScoreColor(match_score) }}
            >
              {match_score}%
            </div>
          </div>

          <div className="text-xs font-bold uppercase text-[#71717A] mt-1">
            {recommended_for}
          </div>

          {/* Match reasons */}
          <div className="mt-3 space-y-1">
            {match_reasons.map((reason, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-[#52525B] font-medium">
                <Bot size={12} className="text-[var(--accent)] shrink-0" />
                {reason}
              </div>
            ))}
          </div>

          {/* Matched skills */}
          {matched_skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {matched_skills.map(skill => (
                <span
                  key={skill}
                  className="px-2 py-0.5 text-xs font-bold uppercase"
                  style={{
                    backgroundColor: "#FFF7ED",
                    border: "1px solid var(--accent)",
                    color: "var(--accent)",
                  }}
                >
                  {skill}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex gap-2">
            <Link
              href={`/agent/contact/${user.username}`}
              className="btn-brutal btn-brutal-primary text-xs py-1.5 px-4 flex items-center gap-1"
            >
              <Bot size={12} />
              Contact via Agent
            </Link>
            <Link
              href={`/agent/evaluate/${user.username}`}
              className="btn-brutal btn-brutal-secondary text-xs py-1.5 px-4 flex items-center gap-1"
            >
              Full Report <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
