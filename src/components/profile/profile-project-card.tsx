"use client";

import { useState, useRef, useEffect } from "react";
import { ExternalLink, Flag, CheckCircle, Undo2 } from "lucide-react";
import Image from "next/image";
import type { Project } from "@/lib/types/database";
import { QualityScoreBadge } from "@/components/ui/quality-score-badge";
import { EndorseButton } from "@/components/ui/endorse-button";
import { createClient } from "@/lib/supabase/client";
import { parseImageCrop } from "@/lib/image-crop";

interface ProfileProjectCardProps {
  project: Project;
  verified?: boolean;
  isOwner?: boolean;
}

const REPORT_REASONS = ["Spam/Fake", "Inappropriate content", "Broken links", "Other"];

function getReportData(projectId: string): { report_id: string; reporter_token: string } | null {
  try {
    const raw = localStorage.getItem(`report_${projectId}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function saveReportData(projectId: string, reportId: string, token: string) {
  localStorage.setItem(`report_${projectId}`, JSON.stringify({ report_id: reportId, reporter_token: token }));
}

function clearReportData(projectId: string) {
  localStorage.removeItem(`report_${projectId}`);
}

export function ProfileProjectCard({ project, verified = false, isOwner = false }: ProfileProjectCardProps) {
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [reported, setReported] = useState(() => !!getReportData(project.id));
  const [undoing, setUndoing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const isLongDescription = (project.description?.length ?? 0) > 280;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (reportRef.current && !reportRef.current.contains(e.target as Node)) {
        setShowReportMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [reportStatus, setReportStatus] = useState<"" | "success" | "error" | "auth">("");

  async function handleReport(reason: string) {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setReportStatus("auth");
        setShowReportMenu(false);
        setTimeout(() => setReportStatus(""), 4000);
        return;
      }
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.id, reason }),
      });
      if (res.ok) {
        const data = await res.json();
        saveReportData(project.id, data.report_id, data.reporter_token);
        setReported(true);
        setShowReportMenu(false);
        setReportStatus("success");
        setTimeout(() => setReportStatus(""), 3000);
      } else {
        setReportStatus("error");
        setShowReportMenu(false);
        setTimeout(() => setReportStatus(""), 3000);
      }
    } catch {
      setReportStatus("error");
      setShowReportMenu(false);
      setTimeout(() => setReportStatus(""), 3000);
    }
  }

  async function handleUndo() {
    if (undoing) return;
    const data = getReportData(project.id);
    if (!data) return;
    setUndoing(true);
    try {
      const res = await fetch("/api/report", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        clearReportData(project.id);
        setReported(false);
        setReportStatus("");
      }
    } catch {
      // silently fail
    }
    setUndoing(false);
  }

  return (
    <div
      className="flex flex-col cursor-pointer transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--border-hard)]"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "2px solid var(--border-hard)",
        boxShadow: "var(--shadow-brutal-sm)",
      }}
    >
      {project.image_url && (() => {
        const crop = parseImageCrop(project.image_url);
        return (
          <div className="relative w-full h-28 border-b-2 border-[var(--border-hard)] overflow-hidden">
            <Image src={project.image_url} alt={project.title} fill className="object-cover" style={{ objectPosition: crop.objectPosition, transform: `scale(${crop.scale})` }} />
          </div>
        );
      })()}
      <div className="flex flex-col gap-2 p-4 flex-grow">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <span className="text-[1.1rem] font-extrabold uppercase text-[var(--foreground)]">{project.title}</span>
          {verified && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600" title="Verified owner">
              <CheckCircle size={14} />
              Verified
            </span>
          )}
          <QualityScoreBadge project={project} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(project.live_url || project.github_url) && (
            <a
              href={project.live_url || project.github_url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={16} />
            </a>
          )}
          <div className="relative" ref={reportRef}>
            {reported ? (
              <button
                onClick={(e) => { e.stopPropagation(); handleUndo(); }}
                disabled={undoing}
                className="inline-flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                title="Undo report"
              >
                <Undo2 size={12} />
                {undoing ? "Undoing..." : "Undo Report"}
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setShowReportMenu(!showReportMenu); }}
                className="text-[var(--text-muted)] hover:text-red-500 transition-colors"
                title="Report project"
              >
                <Flag size={14} />
              </button>
            )}
            {showReportMenu && (
              <div
                className="absolute right-0 bottom-6 z-50 min-w-[160px] py-1"
                style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)", boxShadow: "var(--shadow-brutal-sm)" }}
              >
                {REPORT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={(e) => { e.stopPropagation(); handleReport(reason); }}
                    className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-[var(--bg-surface-light)] text-[var(--foreground)]"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-grow">
        <p className={`text-[0.9rem] text-[var(--text-secondary)] font-medium ${isLongDescription && !expanded ? "line-clamp-4" : ""}`}>
          {project.description}
        </p>
        {isLongDescription && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="mt-1 text-xs font-bold uppercase text-[var(--accent)] hover:underline"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>

      <div className="mt-2">
        <EndorseButton projectId={project.id} initialCount={project.endorsement_count} isOwner={isOwner} />
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {(project.tech_stack ?? []).map((tech) => (
          <span
            key={tech}
            className="font-mono text-xs font-bold uppercase text-[var(--text-tertiary)] px-2.5 py-1"
            style={{
              backgroundColor: "var(--bg-surface-light)",
              border: "1px solid var(--border-hard)",
            }}
          >
            {tech}
          </span>
        ))}
      </div>

      {reportStatus === "success" && (
        <p className="text-xs font-bold text-green-700 mt-2">Thanks for the report! We&apos;ll review this project shortly.</p>
      )}
      {reportStatus === "error" && (
        <p className="text-xs font-bold text-red-600 mt-2">Failed to submit report. Please try again.</p>
      )}
      {reportStatus === "auth" && (
        <p className="text-xs font-bold text-red-600 mt-2">Please sign in to report a project.</p>
      )}
      </div>
    </div>
  );
}
