"use client";

import { ExternalLink } from "lucide-react";
import type { Project } from "@/lib/types/database";

interface ProfileProjectCardProps {
  project: Project;
}

export function ProfileProjectCard({ project }: ProfileProjectCardProps) {
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
        {(project.live_url || project.github_url) && (
          <a
            href={project.live_url || project.github_url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#71717A] hover:text-[var(--accent)] transition-colors shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={16} />
          </a>
        )}
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
