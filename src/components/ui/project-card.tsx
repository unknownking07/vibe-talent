"use client";

import { useState, useRef, useEffect } from "react";
import { ExternalLink, Github, Clock, Tag, Pencil, Flag } from "lucide-react";
import type { Project } from "@/lib/types/database";

const REPORT_REASONS = [
  "Spam/Fake",
  "Inappropriate content",
  "Broken links",
  "Other",
];

interface ProjectCardProps {
  project: Project;
  showAuthor?: boolean;
  showReport?: boolean;
  onEdit?: (project: Project) => void;
}

export function ProjectCard({ project, onEdit, showReport = true }: ProjectCardProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [reporting, setReporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        setReported(true);
      }
    } catch {
      // silently fail
    }
    setReporting(false);
    setReportOpen(false);
  };

  return (
    <div
      className="card-brutal p-5 transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#0F0F0F]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-extrabold uppercase text-[#0F0F0F]">{project.title}</h3>
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
                <span className="text-xs font-bold text-[#71717A]">Reported</span>
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
                <div className="absolute right-0 top-6 z-50 w-44 border-2 border-[#0F0F0F] bg-white shadow-[4px_4px_0_#0F0F0F]">
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
    </div>
  );
}
