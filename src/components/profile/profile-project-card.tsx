"use client";

import { useState, useRef, useEffect } from "react";
import { ExternalLink, Flag, CheckCircle, Undo2, Activity, ThumbsUp } from "lucide-react";
import Image from "next/image";
import type { Project } from "@/lib/types/database";

interface ProfileProjectCardProps {
  project: Project;
  verified?: boolean;
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

export function ProfileProjectCard({ project, verified = false }: ProfileProjectCardProps) {
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [reported, setReported] = useState(() => !!getReportData(project.id));
  const [undoing, setUndoing] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (reportRef.current && !reportRef.current.contains(e.target as Node)) {
        setShowReportMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [reportStatus, setReportStatus] = useState<"" | "success" | "error">("");

  async function handleReport(reason: string) {
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
      className="flex flex-col overflow-hidden cursor-pointer transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#0F0F0F]"
      style={{
        backgroundColor: "#FFFFFF",
        border: "2px solid #0F0F0F",
        boxShadow: "var(--shadow-brutal-sm)",
      }}
    >
      {project.image_url && (
        <div className="relative w-full h-28 border-b-2 border-[#0F0F0F]">
          <Image src={project.image_url} alt={project.title} fill className="object-cover" />
        </div>
      )}
      <div className="flex flex-col gap-2 p-4 flex-grow">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <span className="text-[1.1rem] font-extrabold uppercase text-[#0F0F0F]">{project.title}</span>
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
              title={`Quality Score: ${project.quality_score}/100`}
              aria-label={`Quality score: ${project.quality_score} out of 100`}
            >
              <Activity size={14} />
              {project.quality_score}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(project.live_url || project.github_url) && (
            <a
              href={project.live_url || project.github_url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#71717A] hover:text-[var(--accent)] transition-colors"
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
                className="text-[#71717A] hover:text-red-500 transition-colors"
                title="Report project"
              >
                <Flag size={14} />
              </button>
            )}
            {showReportMenu && (
              <div
                className="absolute right-0 top-6 z-50 min-w-[160px] py-1"
                style={{ backgroundColor: "#fff", border: "2px solid #0F0F0F", boxShadow: "var(--shadow-brutal-sm)" }}
              >
                {REPORT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={(e) => { e.stopPropagation(); handleReport(reason); }}
                    className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-[#F5F5F5] text-[#0F0F0F]"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-[0.9rem] text-[#52525B] font-medium flex-grow">{project.description}</p>

      {project.endorsement_count > 0 && (
        <div
          className="flex items-center gap-1 text-xs font-bold text-emerald-600 mt-2"
          aria-label={`${project.endorsement_count} endorsement${project.endorsement_count !== 1 ? "s" : ""}`}
        >
          <ThumbsUp size={12} />
          {project.endorsement_count} endorsement{project.endorsement_count !== 1 ? "s" : ""}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mt-2">
        {(project.tech_stack ?? []).map((tech) => (
          <span
            key={tech}
            className="font-mono text-xs font-bold uppercase text-[#0F0F0F] px-2.5 py-1"
            style={{
              backgroundColor: "#F5F5F5",
              border: "1px solid #0F0F0F",
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
      </div>
    </div>
  );
}
