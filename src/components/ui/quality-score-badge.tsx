"use client";

import { useState, useRef, useEffect } from "react";
import { Info, X } from "lucide-react";
import type { Project } from "@/lib/types/database";
import { repositoryChecksScore } from "@/lib/project-evidence";

export function QualityScoreBadge({
  project,
  size = "sm",
}: {
  project: Project;
  size?: "sm" | "md";
}) {
  const [showInfo, setShowInfo] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showInfo) return;
    const closeOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      )
        setShowInfo(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowInfo(false);
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [showInfo]);

  if (!project.verified || !project.quality_metrics) return null;
  const score = repositoryChecksScore(project.quality_metrics);
  const checks = [
    {
      label: "README",
      detected: project.quality_metrics.has_readme,
      points: 30,
    },
    {
      label: "Test-related files or config",
      detected: project.quality_metrics.has_tests,
      points: 40,
    },
    {
      label: "CI or container config",
      detected: project.quality_metrics.has_ci,
      points: 30,
    },
  ];
  return (
    <div className="relative inline-flex" ref={popoverRef}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setShowInfo(!showInfo);
        }}
        aria-expanded={showInfo}
        aria-label={`Repository checks: ${score} out of 100. Click for details.`}
        className={`inline-flex items-center gap-1 font-semibold text-[var(--text-secondary)] ${size === "sm" ? "text-xs" : "text-sm"}`}
      >
        {score} <Info size={12} aria-hidden="true" />
      </button>
      {showInfo && (
        <div
          className="absolute left-0 top-full mt-2 z-50 w-72 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-brutal)] p-3"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-semibold">
              Repository checks · {score}/100
            </span>
            <button
              type="button"
              onClick={() => setShowInfo(false)}
              aria-label="Close repository check details"
            >
              <X size={14} />
            </button>
          </div>
          <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
            {checks.map((check) => (
              <li key={check.label} className="flex justify-between gap-3">
                <span>{check.label}</span>
                <span>
                  {check.detected === true
                    ? `+${check.points}`
                    : "Not detected"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-[var(--text-muted)]">
            Commits, push recency and popularity add zero points. These checks
            detect files and configuration; they do not verify passing tests or
            product functionality.
          </p>
        </div>
      )}
    </div>
  );
}
