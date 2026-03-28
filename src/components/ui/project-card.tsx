"use client";

import { useState, useRef, useEffect } from "react";
import { ExternalLink, Github, Clock, Tag, Pencil, Flag, CheckCircle, ShieldCheck, Undo2, User, Activity, ThumbsUp } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Project } from "@/lib/types/database";

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
      className="card-brutal overflow-hidden transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#0F0F0F]"
    >
      {project.image_url && (
        <div className="relative w-full h-40 border-b-2 border-[#0F0F0F]">
          <Image
            src={project.image_url}
            alt={project.title}
            fill
            className="object-cover"
          />
        </div>
      )}
      <div className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-extrabold uppercase text-[#0F0F0F]">{project.title}</h3>
          {verified && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600" title="Verified owner">
              <CheckCircle size={14} />
              Verified
            </span>
          )}
          {project.quality_score > 0 && (
            <span
              className={`inline-flex items-center gap-1 text-xs font-bold ${
                project.quality_score >= 70 ? "text-emerald-600" :
                project.quality_score >= 40 ? "text-amber-600" :
                "text-zinc-500"
              }`}
              title={`Quality Score: ${project.quality_score}/100 (Community: ${project.quality_metrics?.community_score ?? 0}, Substance: ${project.quality_metrics?.substance_score ?? 0}, Maintenance: ${project.quality_metrics?.maintenance_score ?? 0})`}
            >
              <Activity size={14} />
              {project.quality_score}
            </span>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(project); }}
              className="text-[#52525B] hover:text-[var(--accent)] transition-colors"
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
                  className="text-[#A1A1AA] hover:text-red-500 transition-colors"
                  title="Report project"
                >
                  <Flag size={14} />
                </button>
              )}
              {reportOpen && (
                <div className="absolute right-0 top-6 z-50 w-44 max-h-48 overflow-y-auto border-2 border-[#0F0F0F] bg-white shadow-[4px_4px_0_#0F0F0F]">
                  {REPORT_REASONS.map((reason) => (
                    <button
                      key={reason}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReport(reason);
                      }}
                      disabled={reporting}
                      className="block w-full px-3 py-2 text-left text-xs font-bold uppercase text-[#0F0F0F] hover:bg-[#F5F5F5] transition-colors disabled:opacity-50"
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
              className="text-[#52525B] hover:text-[var(--accent)] transition-colors"
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
              className="text-[#52525B] hover:text-[#0F0F0F] transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Github size={16} />
            </a>
          )}
        </div>
      </div>

      <p className="mt-2 text-sm text-[#52525B] font-medium line-clamp-2">
        {project.description}
      </p>

      {authorUsername && (
        <Link
          href={`/profile/${authorUsername}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#71717A] hover:text-[var(--accent)] transition-colors"
        >
          <User size={12} />
          @{authorUsername}
        </Link>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {project.tech_stack.map((tech) => (
          <span
            key={tech}
            className="px-2 py-0.5 text-xs font-bold uppercase text-[#0F0F0F]"
            style={{
              backgroundColor: "#F5F5F5",
              border: "1px solid #0F0F0F",
            }}
          >
            {tech}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs font-bold text-[#71717A] uppercase">
        {project.endorsement_count > 0 && (
          <span className="flex items-center gap-1 text-emerald-600">
            <ThumbsUp size={12} />
            {project.endorsement_count}
          </span>
        )}
        {project.build_time && (
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {project.build_time}
          </span>
        )}
        {project.tags.length > 0 && (
          <span className="flex items-center gap-1">
            <Tag size={12} />
            {project.tags.join(", ")}
          </span>
        )}
      </div>

      {!verified && onVerify && (
        <button
          onClick={(e) => { e.stopPropagation(); onVerify(project.id); }}
          className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold uppercase text-[#0F0F0F] border-2 border-[#0F0F0F] bg-white hover:bg-[#F5F5F5] transition-colors"
          title="Verify GitHub ownership"
        >
          <ShieldCheck size={14} />
          Verify
        </button>
      )}
      </div>
    </div>
  );
}
