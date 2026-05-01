"use client";

import { useState } from "react";
import Image from "next/image";
import { Github, Globe, Bot, Code2, Share2, Link2 as LinkIcon, Check, Send, BadgeCheck } from "lucide-react";
import Link from "next/link";
import type { UserWithSocials, BadgeLevel } from "@/lib/types/database";
import { HireModal } from "@/components/ui/hire-modal";
import { ShareCardModal } from "@/components/profile/share-card-modal";
import { extractSocialHandle } from "@/lib/social-handles";
import { normalizeExternalUrl } from "@/lib/url-normalize";

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
    case "diamond": return "var(--bg-surface-light)";
    case "gold": return "var(--status-warning-bg)";
    case "silver": return "var(--bg-surface-light)";
    case "bronze": return "var(--status-warning-bg)";
    default: return "var(--bg-surface-light)";
  }
}

const FRONTEND = ["react", "next.js", "nextjs", "vue", "angular", "svelte", "html", "css", "tailwind", "tailwindcss", "sass", "bootstrap"];
const BACKEND = ["node.js", "nodejs", "express", "django", "flask", "fastapi", "rails", "spring", "laravel", "php", "go", "golang", "rust", "java", "c#", ".net", "graphql", "postgresql", "mongodb", "mysql", "redis", "supabase", "firebase", "prisma", "drizzle", "python"];
const MOBILE = ["react native", "flutter", "swift", "kotlin", "swiftui", "expo"];
const AI_ML = ["tensorflow", "pytorch", "openai", "langchain", "machine learning", "ai", "ml", "llm", "gpt", "huggingface", "stable diffusion", "anthropic"];
const WEB3 = ["solidity", "ethereum", "solana", "web3", "smart contracts", "blockchain", "hardhat", "foundry", "rust"];

function deriveRole(projects: { tech_stack: string[] }[]): string {
  const allTech = (projects ?? []).flatMap(p => (p.tech_stack ?? []).map(t => t.toLowerCase()));
  if (allTech.length === 0) return "Builder";

  const hasFrontend = allTech.some(t => FRONTEND.includes(t));
  const hasBackend = allTech.some(t => BACKEND.includes(t));
  const hasMobile = allTech.some(t => MOBILE.includes(t));
  const hasAI = allTech.some(t => AI_ML.includes(t));
  const hasWeb3 = allTech.some(t => WEB3.includes(t));

  const categories = [hasFrontend, hasBackend, hasMobile, hasAI, hasWeb3].filter(Boolean).length;
  if (categories >= 3) return "Vibe Coder";
  if (hasWeb3 && (hasFrontend || hasBackend)) return "Web3 Developer";
  if (hasWeb3) return "Web3 Developer";
  if (hasAI && (hasFrontend || hasBackend)) return "AI Engineer";
  if (hasAI) return "AI / ML Engineer";
  if (hasMobile && (hasFrontend || hasBackend)) return "Mobile + Web Dev";
  if (hasMobile) return "Mobile Developer";
  if (hasFrontend && hasBackend) return "Full Stack";
  if (hasFrontend) return "Frontend Developer";
  if (hasBackend) return "Backend Developer";
  return "Builder";
}

export function ProfileSidebar({ user }: ProfileSidebarProps) {
  const [hireModalOpen, setHireModalOpen] = useState(false);
  const [shareCardOpen, setShareCardOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const profileUrl = typeof window !== "undefined"
    ? `${window.location.origin}/profile/${user.username}`
    : `https://vibetalent.work/profile/${user.username}`;

  const shareText = `Check out @${user.username} on VibeTalent — ${user.streak}-day streak, ${(user.projects ?? []).length} projects shipped!`;

  const handleShareTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(profileUrl)}`;
    window.open(url, "_blank", "width=600,height=400");
  };

  const handleShareLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`;
    window.open(url, "_blank", "width=600,height=400");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // silently fail
    }
  };
  const socials = user.social_links;
  // Tolerate legacy values stored as full URLs so the rendered link doesn't
  // become "https://x.com/https://x.com/<handle>".
  const twitterHandle = extractSocialHandle(socials?.twitter, "twitter");
  const telegramHandle = extractSocialHandle(socials?.telegram, "telegram");
  const initials = user.username.slice(0, 2).toUpperCase();
  const badgeLabel = getBadgeLabel(user.badge_level);

  return (
    <aside
      className="flex flex-col gap-6 p-6"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "2px solid var(--border-hard)",
        boxShadow: "var(--shadow-brutal)",
      }}
    >
      {/* Avatar + Badge */}
      <div className="flex flex-col items-center text-center gap-4">
        <div className="relative">
          <div
            className="w-[120px] h-[120px] flex items-center justify-center text-3xl font-extrabold text-white"
            style={{
              backgroundColor: "var(--bg-inverted)",
              border: "2px solid var(--border-hard)",
            }}
          >
            {user.avatar_url ? (
              <Image
                src={user.avatar_url}
                alt={user.username}
                width={128}
                height={128}
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
                border: "2px solid var(--border-hard)",
                color: "var(--foreground)",
              }}
            >
              {badgeLabel}
            </div>
          )}
        </div>

        {/* Name + handle + role */}
        <div className="mt-2">
          <h1 className="text-xl font-extrabold uppercase tracking-tight text-[var(--foreground)] flex items-center justify-center gap-1.5">
            <span>{user.display_name || `@${user.username}`}</span>
            {user.github_username && (
              <span
                className="inline-flex items-center"
                title={`GitHub ownership verified: @${user.github_username}`}
                aria-label={`GitHub verified as @${user.github_username}`}
              >
                <BadgeCheck
                  size={20}
                  className="text-white fill-[#1D9BF0]"
                  strokeWidth={2.5}
                />
              </span>
            )}
          </h1>
          {user.display_name && (
            <p className="text-sm font-medium text-[var(--text-muted)] mt-0.5">@{user.username}</p>
          )}
          <p className="text-sm font-bold text-[var(--text-muted)] uppercase mt-0.5">{deriveRole(user.projects)}</p>
        </div>

        {/* Bio */}
        {user.bio && (
          <p className="text-[0.95rem] text-[var(--text-secondary)] font-medium mt-1">{user.bio}</p>
        )}
      </div>

      {/* Social links */}
      <div className="flex gap-3 justify-center">
        {socials?.github && (
          <a
            href={`https://github.com/${socials.github}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${user.username} on GitHub`}
            className="w-10 h-10 flex items-center justify-center text-[var(--foreground)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_var(--border-hard)]"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal-sm)",
            }}
          >
            <Github size={16} />
          </a>
        )}
        {twitterHandle && (
          <a
            href={`https://x.com/${twitterHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${user.username} on X (Twitter)`}
            className="w-10 h-10 flex items-center justify-center text-[var(--foreground)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_var(--border-hard)]"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal-sm)",
            }}
          >
            <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
        )}
        {telegramHandle && (
          <a
            href={`https://t.me/${telegramHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${user.username} on Telegram`}
            className="w-10 h-10 flex items-center justify-center text-[var(--foreground)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_var(--border-hard)]"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal-sm)",
            }}
          >
            <Send size={16} />
          </a>
        )}
        {(() => {
          const websiteHref = normalizeExternalUrl(socials?.website);
          return websiteHref ? (
            <a
              href={websiteHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${user.username}'s website`}
              className="w-10 h-10 flex items-center justify-center text-[var(--foreground)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_var(--border-hard)]"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "2px solid var(--border-hard)",
                boxShadow: "var(--shadow-brutal-sm)",
              }}
            >
              <Globe size={16} />
            </a>
          ) : null;
        })()}
      </div>

      {/* IDE Badge */}
      {socials?.farcaster && (
        <div
          className="flex items-center gap-2 px-3 py-2 text-xs font-extrabold uppercase"
          style={{
            backgroundColor: "var(--status-warning-bg)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <Code2 size={14} className="text-[var(--accent)]" />
          <span className="text-[var(--foreground)]">{socials.farcaster}</span>
        </div>
      )}

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

      {/* Share Profile */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setShareCardOpen(true)}
          className="btn-brutal btn-brutal-secondary w-full justify-center text-sm flex items-center gap-2"
        >
          <Share2 size={14} />
          Share Card
        </button>

        <div className="grid grid-cols-3 gap-1">
          <button
            onClick={() => handleShareTwitter()}
            className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase py-1.5 cursor-pointer hover:opacity-80"
            style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}
          >
            <svg width={10} height={10} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            Post
          </button>
          <button
            onClick={() => handleShareLinkedIn()}
            className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase py-1.5 cursor-pointer hover:opacity-80"
            style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}
          >
            <svg width={10} height={10} viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            Share
          </button>
          <button
            onClick={() => handleCopyLink()}
            className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase py-1.5 cursor-pointer hover:opacity-80"
            style={{ backgroundColor: linkCopied ? "var(--status-success-bg)" : "var(--bg-surface)", border: "2px solid var(--border-hard)" }}
          >
            {linkCopied ? <Check size={10} className="text-emerald-600" /> : <LinkIcon size={10} />}
            {linkCopied ? "Copied!" : "Link"}
          </button>
        </div>
      </div>

      <ShareCardModal
        username={user.username}
        isOpen={shareCardOpen}
        onClose={() => setShareCardOpen(false)}
      />

      {/* VibeFinder Evaluate */}
      <Link
        href={`/agent/evaluate/${user.username}`}
        className="btn-brutal btn-brutal-dark w-full justify-center text-sm flex items-center gap-2"
      >
        <Bot size={14} />
        VibeFinder Evaluate
      </Link>
    </aside>
  );
}
