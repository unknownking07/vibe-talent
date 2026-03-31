"use client";

import { useState, useRef, useEffect } from "react";
import { ExternalLink, Github, Clock, Tag, Pencil, Flag, CheckCircle, ShieldCheck, Undo2, User } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Project } from "@/lib/types/database";
import { QualityScoreBadge } from "@/components/ui/quality-score-badge";
import { EndorseButton } from "@/components/ui/endorse-button";
import { createClient } from "@/lib/supabase/client";

function parseImageCrop(url: string): { objectPosition: string; scale: number } {
  try {
    const u = new URL(url);
    const y = parseInt(u.searchParams.get("y") || "50");
    const z = parseFloat(u.searchParams.get("z") || "1");
    return { objectPosition: `center ${y}%`, scale: z };
  } catch {
    return { objectPosition: "center 50%", scale: 1 };
  }
}

function ProjectImageBanner({ url, alt }: { url: string; alt: string }) {
  const crop = parseImageCrop(url);
  return (
    <div className="relative w-full h-28 border-b-2 border-[var(--border-hard)] overflow-hidden">
      <Image
        src={url}
        alt={alt}
        fill
        className="object-cover"
        style={{ objectPosition: crop.objectPosition, transform: `scale(${crop.scale})` }}
      />
    </div>
  );
}

const REPORT_REASONS = [
  "Spam/Fake",
  "Inappropriate content",
  "Broken links",
  "Other",
];

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

interface ProjectCardProps {
  project: Project;
  authorUsername?: string;
  showReport?: boolean;
  verified?: boolean;
  onEdit?: (project: Project) => void;
  onVerify?: (projectId: string) => void;
}

export function ProjectCard({ project, authorUsername, onEdit, showReport = true, verified = false, onVerify }: ProjectCardProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(() => !!getReportData(project.id));
  const [reporting, setReporting] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [reportError, setReportError] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check localStorage on mount — initialized via lazy state to avoid setState in effect

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setReportOpen(false);
      }
    }
    if (reportOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [reportOpen]);

  const handleReport = async (reason: string) => {
    if (reporting || reported) return;
    setReporting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setReportError("Please sign in to report a project.");
        setReporting(false);
        setReportOpen(false);
        setTimeout(() => setReportError(""), 4000);
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
      }
    } catch {
      // silently fail
    }
    setReporting(false);
    setReportOpen(false);
  };

  const handleUndo = async () => {
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
      }
    } catch {
      // silently fail
    }
    setUndoing(false);
  };

  return (
    <div
      className="card-brutal transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--border-hard)]"
    >
      {project.image_url ? (
        <ProjectImageBanner url={project.image_url} alt={project.title} />
      ) : (
        <div className="w-full h-28 border-b-2 border-[var(--border-hard)] bg-[var(--bg-surface-light)] flex items-center justify-center">
          <span className="text-3xl font-extrabold uppercase text-[var(--text-muted-soft)] tracking-widest select-none">{project.title?.charAt(0) ?? "P"}</span>
        </div>
      )}
      <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-extrabold uppercase text-[var(--foreground)] truncate">{project.title}</h3>
          {verified && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600" title="Verified owner">
              <CheckCircle size={14} />
              Verified
            </span>
          )}
          <QualityScoreBadge project={project} />
        </div>
        <div className="flex shrink-0 gap-2">
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(project); }}
              className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
              title="Edit project"
            >
              <Pencil size={16} />
            </button>
          )}
          {showReport && !onEdit && (
            <div className="relative" ref={dropdownRef}>
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setReportOpen(!reportOpen);
                  }}
                  className="text-[var(--text-muted-soft)] hover:text-red-500 transition-colors"
                  aria-label="Report project"
                  aria-expanded={reportOpen}
                  aria-haspopup="true"
                >
                  <Flag size={14} />
                </button>
              )}
              {reportOpen && (
                <div className="absolute right-0 bottom-6 z-50 w-44 border-2 border-[var(--border-hard)] bg-[var(--bg-surface)] shadow-[4px_4px_0_var(--border-hard)]">
                  {REPORT_REASONS.map((reason) => (
                    <button
                      key={reason}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReport(reason);
                      }}
                      disabled={reporting}
                      className="block w-full px-3 py-2 text-left text-xs font-bold uppercase text-[var(--foreground)] hover:bg-[var(--bg-surface-light)] transition-colors disabled:opacity-50"
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {project.live_url && (
            <a
              href={project.live_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={16} />
            </a>
          )}
          {project.github_url && (
            <a
              href={project.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Github size={16} />
            </a>
          )}
        </div>
      </div>

      <p className="mt-1.5 text-xs text-[var(--text-secondary)] font-medium line-clamp-2">
        {project.description}
      </p>

      {authorUsername && (
        <Link
          href={`/profile/${authorUsername}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
        >
          <User size={12} />
          @{authorUsername}
        </Link>
      )}

      {(project.tech_stack ?? []).length > 0 && (
      <div className="mt-2 flex flex-wrap gap-1">
        {(project.tech_stack ?? []).map((tech) => (
          <span
            key={tech}
            className="px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--text-tertiary)]"
            style={{
              backgroundColor: "var(--bg-surface-light)",
              border: "1px solid var(--border-hard)",
            }}
          >
            {tech}
          </span>
        ))}
      </div>
      )}

      <div className="mt-2 flex items-center gap-3 text-[10px] font-bold text-[var(--text-muted)] uppercase">
        <EndorseButton projectId={project.id} initialCount={project.endorsement_count} />
        {project.build_time && (
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {project.build_time}
          </span>
        )}
        {(project.tags ?? []).length > 0 && (
          <span className="flex items-center gap-1">
            <Tag size={10} />
            {project.tags.join(", ")}
          </span>
        )}
      </div>

      {reportError && (
        <p className="text-[10px] font-bold text-red-600 mt-1" role="alert">{reportError}</p>
      )}

      {!verified && onVerify && (
        <button
          onClick={(e) => { e.stopPropagation(); onVerify(project.id); }}
          className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase text-[var(--foreground)] border-2 border-[var(--border-hard)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-light)] transition-colors"
          title="Verify GitHub ownership"
        >
          <ShieldCheck size={12} />
          Verify
        </button>
      )}
      </div>
    </div>
  );
}
