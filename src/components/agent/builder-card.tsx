"use client";

import Link from "next/link";
import Image from "next/image";
import { Bot, Flame, ArrowRight, BadgeCheck } from "lucide-react";
import { BadgeDisplay } from "@/components/ui/badge-display";
import type { AgentBuilderCard } from "@/lib/agent/types";

interface BuilderCardProps {
  builder: AgentBuilderCard;
  rank: number;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#16A34A";
  if (score >= 60) return "#FF3A00";
  return "#DC2626";
}

/**
 * Renders one live builder result from the VibeFinder agent. All numbers come
 * from the deterministic tool payload — the model never writes these cards.
 */
export function BuilderCard({ builder, rank }: BuilderCardProps) {
  const initials = builder.username.slice(0, 2).toUpperCase();

  return (
    <div
      className="p-5 transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--border-hard)]"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "2px solid var(--border-hard)",
        boxShadow: rank === 1 ? "var(--shadow-brutal-accent)" : "var(--shadow-brutal)",
      }}
    >
      <div className="flex items-start gap-4">
        {/* Rank + Avatar */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="text-xs font-extrabold text-white px-2 py-0.5"
            style={{ backgroundColor: rank === 1 ? "var(--accent)" : "var(--bg-inverted)" }}
          >
            #{rank}
          </div>
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center text-sm font-extrabold text-white overflow-hidden"
            style={{ backgroundColor: "var(--bg-inverted)", border: "2px solid var(--border-hard)" }}
          >
            {builder.avatar_url ? (
              <Image
                src={builder.avatar_url}
                alt={builder.username}
                width={48}
                height={48}
                className="w-full h-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold uppercase text-[var(--foreground)]">
                @{builder.username}
              </h3>
              <BadgeDisplay level={builder.badge_level} size="sm" />
            </div>
            {builder.match_score !== null && (
              <div
                className="font-extrabold font-mono text-lg"
                style={{ color: getScoreColor(builder.match_score) }}
              >
                {builder.match_score}%
              </div>
            )}
          </div>

          {/* Live stats */}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold uppercase text-[var(--text-muted)]">
            <span>Vibe {builder.vibe_score}</span>
            {builder.streak > 0 && (
              <span className="flex items-center gap-1">
                <Flame size={11} className="text-[var(--accent)]" />
                {builder.streak}d streak
              </span>
            )}
            {builder.verified_projects_count > 0 && (
              <span className="flex items-center gap-1">
                <BadgeCheck size={12} className="text-[#16A34A]" />
                {builder.verified_projects_count} verified
              </span>
            )}
          </div>

          {/* Reasons */}
          {builder.reasons.length > 0 && (
            <div className="mt-3 space-y-1">
              {builder.reasons.map((reason, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm text-[var(--text-secondary)] font-medium"
                >
                  <Bot size={12} className="text-[var(--accent)] shrink-0" />
                  {reason}
                </div>
              ))}
            </div>
          )}

          {/* Tech */}
          {builder.tech_stack.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {builder.tech_stack.map((tech) => (
                <span
                  key={tech}
                  className="px-2 py-0.5 text-xs font-bold uppercase"
                  style={{
                    backgroundColor: "var(--status-warning-bg)",
                    border: "1px solid var(--accent)",
                    color: "var(--accent)",
                  }}
                >
                  {tech}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/profile/${builder.username}`}
              className="btn-brutal btn-brutal-primary text-xs py-1.5 px-4 flex items-center gap-1"
            >
              View Profile <ArrowRight size={12} />
            </Link>
            <Link
              href={`/agent/contact/${builder.username}`}
              className="btn-brutal btn-brutal-secondary text-xs py-1.5 px-4 flex items-center gap-1"
            >
              <Bot size={12} />
              Contact
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
