"use client";

import { ExternalLink, Github, Clock, Tag } from "lucide-react";
import type { Project } from "@/lib/types/database";

interface ProjectCardProps {
  project: Project;
  showAuthor?: boolean;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <div
      className="card-brutal p-5 transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#0F0F0F]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-extrabold uppercase text-[#0F0F0F]">{project.title}</h3>
        <div className="flex shrink-0 gap-2">
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
