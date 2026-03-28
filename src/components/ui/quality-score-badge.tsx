"use client";

import { useState, useRef, useEffect } from "react";
import { Activity, Info, CheckCircle, Globe, Github, FileText, Image as ImageIcon, Layers, X } from "lucide-react";
import type { Project } from "@/lib/types/database";

interface QualityScoreBadgeProps {
  project: Project;
  size?: "sm" | "md";
}

export function QualityScoreBadge({ project, size = "sm" }: QualityScoreBadgeProps) {
  const [showInfo, setShowInfo] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowInfo(false);
      }
    }
    if (showInfo) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showInfo]);

  if (project.quality_score <= 0 && !project.verified) return null;

  const hasGitHubScore = project.quality_metrics && project.quality_score > 0;
  const colorClass = project.quality_score >= 70
    ? "text-emerald-600"
    : project.quality_score >= 40
    ? "text-amber-600"
    : "text-zinc-500";

  const barColor = project.quality_score >= 70
    ? "bg-emerald-500"
    : project.quality_score >= 40
    ? "bg-amber-500"
    : "bg-zinc-400";

  return (
    <div className="relative inline-flex" ref={popoverRef}>
      {project.quality_score > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }}
          className={`inline-flex items-center gap-1 ${size === "sm" ? "text-xs" : "text-sm"} font-bold ${colorClass} hover:opacity-80 transition-opacity`}
          aria-label={`Quality score: ${project.quality_score} out of 100. Click for details.`}
        >
          <Activity size={size === "sm" ? 14 : 16} />
          {project.quality_score}
          <Info size={size === "sm" ? 10 : 12} className="opacity-60" />
        </button>
      )}

      {showInfo && (
        <div
          className="absolute left-0 top-full mt-2 z-50 w-72"
          style={{ border: "2px solid var(--border-hard)", boxShadow: "var(--shadow-brutal-sm)", backgroundColor: "#fff" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b-2 border-[var(--border-hard)] bg-[var(--bg-surface-light)]">
            <span className="text-xs font-extrabold uppercase text-[var(--foreground)]">Quality Score</span>
            <button onClick={() => setShowInfo(false)} className="text-[var(--text-muted)] hover:text-[var(--foreground)]">
              <X size={14} />
            </button>
          </div>

          <div className="p-3 space-y-3">
            {/* Overall score bar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-lg font-extrabold ${colorClass}`}>{project.quality_score}/100</span>
                <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">
                  {project.quality_score >= 70 ? "Excellent" : project.quality_score >= 40 ? "Good" : "Needs work"}
                </span>
              </div>
              <div className="w-full h-2 bg-[var(--border-subtle)] border border-[var(--border-hard)]">
                <div className={`h-full ${barColor}`} style={{ width: `${project.quality_score}%` }} />
              </div>
            </div>

            {/* GitHub metrics breakdown */}
            {hasGitHubScore && project.quality_metrics && (
              <div className="space-y-1.5">
                <ScoreRow label="Community" score={project.quality_metrics.community_score} hint="Stars, forks, contributors" />
                <ScoreRow label="Substance" score={project.quality_metrics.substance_score} hint="Code size, tests, CI, README" />
                <ScoreRow label="Maintenance" score={project.quality_metrics.maintenance_score} hint="Commits, recency, activity" />
              </div>
            )}

            {/* Checklist for non-GitHub-scored projects */}
            {!hasGitHubScore && (
              <div className="space-y-1">
                <CheckItem icon={<CheckCircle size={12} />} label="Verified project" done={project.verified} pts="+5 base" />
                <CheckItem icon={<Globe size={12} />} label="Live URL" done={!!project.live_url} pts="+3 pts" />
                <CheckItem icon={<Github size={12} />} label="GitHub URL" done={!!project.github_url} pts="+2 pts" />
                <CheckItem icon={<FileText size={12} />} label="Description >50 chars" done={project.description.length > 50} pts="+2 pts" />
                <CheckItem icon={<ImageIcon size={12} />} label="Screenshot" done={!!project.image_url} pts="+1 pt" />
                <CheckItem icon={<Layers size={12} />} label="3+ technologies" done={(project.tech_stack ?? []).length >= 3} pts="+2 pts" />
              </div>
            )}

            {/* How to improve */}
            <div className="pt-2 border-t border-[var(--border-subtle)]">
              <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">
                {hasGitHubScore
                  ? "Score is computed from your GitHub repo data at verification time."
                  : "Verify your project via GitHub to unlock full quality scoring."
                }
              </p>
              {!project.verified && (
                <p className="text-[10px] font-bold text-[var(--accent)] mt-1">
                  Verify: add a .vibetalent file to your repo root, or link a repo you own.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreRow({ label, score, hint }: { label: string; score: number; hint: string }) {
  const color = score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-zinc-400";
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase text-[var(--foreground)]">{label}</span>
        <span className="text-[10px] font-bold text-[var(--text-muted)]">{score}/100</span>
      </div>
      <div className="w-full h-1.5 bg-[var(--border-subtle)] border border-[var(--border-hard)] mt-0.5">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <p className="text-[9px] text-[var(--text-muted-soft)] mt-0.5">{hint}</p>
    </div>
  );
}

function CheckItem({ icon, label, done, pts }: { icon: React.ReactNode; label: string; done: boolean; pts: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className={`flex items-center gap-1.5 text-[10px] font-bold ${done ? "text-emerald-600" : "text-[var(--text-muted-soft)]"}`}>
        {icon}
        <span>{label}</span>
      </div>
      <span className={`text-[10px] font-bold ${done ? "text-emerald-600" : "text-[var(--text-muted-soft)]"}`}>
        {done ? "Done" : pts}
      </span>
    </div>
  );
}
