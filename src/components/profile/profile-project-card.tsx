"use client";

import { useState, useRef, useEffect } from "react";
import { ExternalLink, Flag } from "lucide-react";
import type { Project } from "@/lib/types/database";

interface ProfileProjectCardProps {
  project: Project;
}

const REPORT_REASONS = ["Spam/Fake", "Inappropriate content", "Broken links", "Other"];

export function ProfileProjectCard({ project }: ProfileProjectCardProps) {
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [reported, setReported] = useState(false);
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

  async function handleReport(reason: string) {
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.id, reason }),
      });
      if (res.ok) {
        setReported(true);
        setShowReportMenu(false);
        alert("Thanks for the report! We'll review this project shortly.");
      } else {
        alert("Failed to submit report. Please try again.");
      }
    } catch {
      alert("Failed to submit report. Please try again.");
    }
  }

  return (
    <div
      className="flex flex-col gap-3 p-5 cursor-pointer transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#0F0F0F]"
      style={{
        backgroundColor: "#FFFFFF",
        border: "2px solid #0F0F0F",
        boxShadow: "var(--shadow-brutal-sm)",
      }}
    >
      <div className="flex justify-between items-start">
        <span className="text-[1.1rem] font-extrabold uppercase text-[#0F0F0F]">{project.title}</span>
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
              <span className="text-xs text-red-500 font-bold">Reported</span>
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

      <div className="flex flex-wrap gap-1.5 mt-2">
        {project.tech_stack.map((tech) => (
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
    </div>
  );
}
