"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Eye, TrendingUp, Users } from "lucide-react";

interface Viewer {
  username: string;
  avatar_url: string | null;
  viewed_at: string;
}

interface ProfileViewsData {
  views_today: number;
  views_this_week: number;
  viewers: Viewer[];
  anonymous_count: number;
}

export function ProfileViewsWidget() {
  const [data, setData] = useState<ProfileViewsData | null>(null);

  useEffect(() => {
    fetch("/api/profile-views")
      .then((res) => res.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  const hasViews = data.views_this_week > 0;

  return (
    <div
      className="p-5"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "2px solid var(--border-hard)",
        boxShadow: "var(--shadow-brutal)",
      }}
    >
      <h2 className="text-base font-extrabold uppercase flex items-center gap-2 text-[var(--foreground)] mb-4">
        <Eye size={16} className="text-[var(--accent)]" />
        Who Viewed Your Profile
      </h2>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div
          className="p-3 text-center"
          style={{ backgroundColor: "var(--status-warning-bg)", border: "2px solid var(--border-hard)" }}
        >
          <TrendingUp size={16} className="mx-auto text-[var(--accent)] mb-1" />
          <div className="text-xl font-extrabold text-[var(--foreground)] font-mono">{data.views_today}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Today</div>
        </div>
        <div
          className="p-3 text-center"
          style={{ backgroundColor: "var(--bg-surface-light)", border: "2px solid var(--border-hard)" }}
        >
          <Users size={16} className="mx-auto text-[var(--accent)] mb-1" />
          <div className="text-xl font-extrabold text-[var(--foreground)] font-mono">{data.views_this_week}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">This Week</div>
        </div>
      </div>

      {hasViews ? (
        <div className="space-y-2">
          {data.viewers.map((viewer) => (
            <a
              key={viewer.username}
              href={`/profile/${viewer.username}`}
              className="flex items-center gap-3 p-2 transition-colors hover:bg-[var(--bg-surface-light)]"
              style={{ border: "1px solid var(--border-subtle)" }}
            >
              <div
                className="w-8 h-8 flex items-center justify-center text-xs font-extrabold text-white shrink-0"
                style={{ backgroundColor: "var(--bg-inverted)" }}
              >
                {viewer.avatar_url ? (
                  <Image
                    src={viewer.avatar_url}
                    alt={viewer.username}
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  viewer.username.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-bold text-[var(--foreground)]">@{viewer.username}</span>
              </div>
              <span className="text-[10px] font-medium text-[var(--text-muted-soft)]">
                {new Date(viewer.viewed_at).toLocaleDateString()}
              </span>
            </a>
          ))}
        </div>
      ) : (
        <div className="text-center py-4">
          <Eye size={24} className="mx-auto mb-2 text-[var(--text-muted-soft)]" />
          <p className="text-sm font-medium text-[var(--text-muted-soft)]">No profile views yet this week</p>
          <p className="text-xs text-[var(--text-muted-soft)] mt-1">Share your profile to get noticed!</p>
        </div>
      )}
    </div>
  );
}
