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
        backgroundColor: "#FFFFFF",
        border: "2px solid #0F0F0F",
        boxShadow: "var(--shadow-brutal)",
      }}
    >
      <h2 className="text-base font-extrabold uppercase flex items-center gap-2 text-[#0F0F0F] mb-4">
        <Eye size={16} className="text-[var(--accent)]" />
        Who Viewed Your Profile
      </h2>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div
          className="p-3 text-center"
          style={{ backgroundColor: "#FFF7ED", border: "2px solid #0F0F0F" }}
        >
          <TrendingUp size={16} className="mx-auto text-[var(--accent)] mb-1" />
          <div className="text-xl font-extrabold text-[#0F0F0F] font-mono">{data.views_today}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#71717A]">Today</div>
        </div>
        <div
          className="p-3 text-center"
          style={{ backgroundColor: "#F5F3FF", border: "2px solid #0F0F0F" }}
        >
          <Users size={16} className="mx-auto text-[#8B5CF6] mb-1" />
          <div className="text-xl font-extrabold text-[#0F0F0F] font-mono">{data.views_this_week}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#71717A]">This Week</div>
        </div>
      </div>

      {hasViews ? (
        <div className="space-y-2">
          {data.viewers.map((viewer) => (
            <a
              key={viewer.username}
              href={`/profile/${viewer.username}`}
              className="flex items-center gap-3 p-2 transition-colors hover:bg-[#F4F4F5]"
              style={{ border: "1px solid #E4E4E7" }}
            >
              <div
                className="w-8 h-8 flex items-center justify-center text-xs font-extrabold text-white shrink-0"
                style={{ backgroundColor: "#0F0F0F" }}
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
                <span className="text-sm font-bold text-[#0F0F0F]">@{viewer.username}</span>
              </div>
              <span className="text-[10px] font-medium text-[#A1A1AA]">
                {new Date(viewer.viewed_at).toLocaleDateString()}
              </span>
            </a>
          ))}
          {data.anonymous_count > 0 && (
            <div className="flex items-center gap-3 p-2" style={{ border: "1px solid #E4E4E7" }}>
              <div
                className="w-8 h-8 flex items-center justify-center text-xs font-extrabold text-white shrink-0"
                style={{ backgroundColor: "#71717A" }}
              >
                ?
              </div>
              <span className="text-sm font-medium text-[#71717A]">
                +{data.anonymous_count} anonymous visitor{data.anonymous_count !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <Eye size={24} className="mx-auto mb-2 text-[#A1A1AA]" />
          <p className="text-sm font-medium text-[#A1A1AA]">No profile views yet this week</p>
          <p className="text-xs text-[#A1A1AA] mt-1">Share your profile to get noticed!</p>
        </div>
      )}
    </div>
  );
}
