"use client";

import { useState } from "react";
import { Github, Globe, Bot } from "lucide-react";
import Link from "next/link";
import type { UserWithSocials, BadgeLevel } from "@/lib/types/database";
import { HireModal } from "@/components/ui/hire-modal";

interface ProfileSidebarProps {
  user: UserWithSocials;
}

function getBadgeLabel(level: BadgeLevel): string | null {
  switch (level) {
    case "diamond": return "Diamond";
    case "gold": return "Gold";
    case "silver": return "Silver";
    case "bronze": return "Bronze";
    default: return null;
  }
}

function getBadgeBg(level: BadgeLevel): string {
  switch (level) {
    case "diamond": return "#CFFAFE";
    case "gold": return "#FEF9C3";
    case "silver": return "#F4F4F5";
    case "bronze": return "#FEF3C7";
    default: return "#F4F4F5";
  }
}

export function ProfileSidebar({ user }: ProfileSidebarProps) {
  const [hireModalOpen, setHireModalOpen] = useState(false);
  const socials = user.social_links;
  const initials = user.username.slice(0, 2).toUpperCase();
  const badgeLabel = getBadgeLabel(user.badge_level);

  return (
    <aside
      className="flex flex-col gap-6 p-6"
      style={{
        backgroundColor: "#FFFFFF",
        border: "2px solid #0F0F0F",
        boxShadow: "var(--shadow-brutal)",
      }}
    >
      {/* Avatar + Badge */}
      <div className="flex flex-col items-center text-center gap-4">
        <div className="relative">
          <div
            className="w-[120px] h-[120px] flex items-center justify-center text-3xl font-extrabold text-white"
            style={{
              backgroundColor: "#0F0F0F",
              border: "2px solid #0F0F0F",
            }}
          >
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.username}
                className="w-full h-full object-cover"
              />
            ) : (
              initials
            )}
          </div>

          {badgeLabel && (
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 text-xs font-extrabold uppercase tracking-wider whitespace-nowrap"
              style={{
                backgroundColor: getBadgeBg(user.badge_level),
                border: "2px solid #0F0F0F",
                color: "#0F0F0F",
              }}
            >
              {badgeLabel}
            </div>
          )}
        </div>

        {/* Name + role */}
        <div className="mt-2">
          <h2 className="text-xl font-extrabold uppercase tracking-tight text-[#0F0F0F]">@{user.username}</h2>
          <p className="text-sm font-bold text-[#71717A] uppercase mt-0.5">Full Stack</p>
        </div>

        {/* Bio */}
        {user.bio && (
          <p className="text-[0.95rem] text-[#52525B] font-medium mt-1">{user.bio}</p>
        )}
      </div>

      {/* Social links */}
      <div className="flex gap-3 justify-center">
        {socials?.github && (
          <a
            href={`https://github.com/${socials.github}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 flex items-center justify-center text-[#0F0F0F] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0F0F0F]"
            style={{
              backgroundColor: "#FFFFFF",
              border: "2px solid #0F0F0F",
              boxShadow: "3px 3px 0 #0F0F0F",
            }}
          >
            <Github size={16} />
          </a>
        )}
        {socials?.twitter && (
          <a
            href={`https://x.com/${socials.twitter}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 flex items-center justify-center text-[#0F0F0F] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0F0F0F]"
            style={{
              backgroundColor: "#FFFFFF",
              border: "2px solid #0F0F0F",
              boxShadow: "3px 3px 0 #0F0F0F",
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
        )}
        {socials?.website && (
          <a
            href={socials.website}
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 flex items-center justify-center text-[#0F0F0F] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0F0F0F]"
            style={{
              backgroundColor: "#FFFFFF",
              border: "2px solid #0F0F0F",
              boxShadow: "3px 3px 0 #0F0F0F",
            }}
          >
            <Globe size={16} />
          </a>
        )}
      </div>

      {/* Hire button */}
      <button
        onClick={() => setHireModalOpen(true)}
        className="btn-brutal btn-brutal-primary w-full justify-center text-base mt-3"
      >
        Hire This Builder
      </button>

      <HireModal
        builderId={user.id}
        builderName={user.username}
        isOpen={hireModalOpen}
        onClose={() => setHireModalOpen(false)}
      />

      {/* AI Evaluate */}
      <Link
        href={`/agent/evaluate/${user.username}`}
        className="btn-brutal btn-brutal-dark w-full justify-center text-sm flex items-center gap-2"
      >
        <Bot size={14} />
        AI Evaluate
      </Link>
    </aside>
  );
}
