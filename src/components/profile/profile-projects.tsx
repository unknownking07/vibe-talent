"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/types/database";
import { ProfileProjectCard } from "@/components/profile/profile-project-card";

const PROJECT_FIELDS = "id, user_id, title, description, tech_stack, live_url, github_url, image_url, build_time, tags, verified, quality_score, quality_metrics, endorsement_count, is_private, created_at";

export function ProfileProjects({
  builderId,
  username,
  publicProjects,
  variant,
}: {
  builderId: string;
  username: string;
  publicProjects: Project[];
  variant: "preview" | "all";
}) {
  const [isOwner, setIsOwner] = useState(false);
  const [privateProjects, setPrivateProjects] = useState<Project[]>([]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function loadOwnerProjects() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || user?.id !== builderId) return;

      setIsOwner(true);
      // RLS permits this read only for the owner. Public profile HTML never
      // contains private project data, so it can be cached for every visitor.
      const { data, error } = await supabase
        .from("projects")
        .select(PROJECT_FIELDS)
        .eq("user_id", builderId)
        .eq("is_private", true)
        .order("created_at", { ascending: false });

      if (active && !error && data) setPrivateProjects(data as Project[]);
    }

    loadOwnerProjects().catch(() => {});
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && session?.user.id !== builderId)) {
        setIsOwner(false);
        setPrivateProjects([]);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [builderId]);

  const projects = isOwner
    ? [...privateProjects, ...publicProjects]
    : publicProjects;
  const visibleProjects = variant === "preview" ? projects.slice(0, 4) : projects;

  return (
    <>
      {variant === "preview" ? (
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-[var(--foreground)]">Featured Projects</h3>
          {projects.length > 4 && (
            <Link
              href={`/profile/${username}/projects`}
              className="btn-brutal btn-brutal-dark text-xs py-1.5 px-4"
            >
              View All ({projects.length})
            </Link>
          )}
        </div>
      ) : (
        <p className="mt-2 mb-8 text-[var(--text-secondary)] font-medium">
          {projects.length} project{projects.length === 1 ? "" : "s"} shipped
        </p>
      )}

      {visibleProjects.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {visibleProjects.map((project) => (
            <ProfileProjectCard
              key={project.id}
              project={project}
              verified={!!project.verified}
              isOwner={isOwner}
            />
          ))}
        </div>
      ) : (
        <div
          className="p-8 text-center font-semibold text-[var(--text-muted)] rounded-2xl"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          No projects yet.
        </div>
      )}
    </>
  );
}
