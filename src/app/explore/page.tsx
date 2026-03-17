"use client";

import { useState, useEffect, useMemo } from "react";
import { VibecoderCard } from "@/components/ui/vibecoder-card";
import { fetchUsers } from "@/lib/supabase/queries";
import { Search, SlidersHorizontal, Bot } from "lucide-react";
import Link from "next/link";
import type { BadgeLevel, UserWithSocials } from "@/lib/types/database";

type SortOption = "vibe_score" | "streak" | "projects" | "newest";

export default function ExplorePage() {
  const [allUsers, setAllUsers] = useState<UserWithSocials[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("vibe_score");
  const [badgeFilter, setBadgeFilter] = useState<BadgeLevel | "all">("all");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchUsers().then((users) => {
      setAllUsers(users);
      setLoading(false);
    });
  }, []);

  const filteredUsers = useMemo(() => {
    let users = [...allUsers];

    if (search) {
      const q = search.toLowerCase();
      users = users.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.bio?.toLowerCase().includes(q) ||
          u.projects.some((p) =>
            p.tech_stack.some((t) => t.toLowerCase().includes(q)) ||
            p.tags.some((t) => t.toLowerCase().includes(q))
          )
      );
    }

    if (badgeFilter !== "all") {
      users = users.filter((u) => u.badge_level === badgeFilter);
    }

    switch (sortBy) {
      case "vibe_score":
        users.sort((a, b) => b.vibe_score - a.vibe_score);
        break;
      case "streak":
        users.sort((a, b) => b.streak - a.streak);
        break;
      case "projects":
        users.sort((a, b) => b.projects.length - a.projects.length);
        break;
      case "newest":
        users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    return users;
  }, [allUsers, search, sortBy, badgeFilter]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold uppercase text-[#0F0F0F]">Explore Talent</h1>
        <p className="mt-2 text-[#52525B] font-medium">
          Discover talented vibe coders and find the perfect builder for your project
        </p>
      </div>

      {/* AI Agent Banner */}
      <Link
        href="/agent/find"
        className="flex items-center gap-4 p-4 mb-10 transition-all hover:translate-x-[1px] hover:translate-y-[1px]"
        style={{
          backgroundColor: "#0F0F0F",
          border: "2px solid #0F0F0F",
          boxShadow: "var(--shadow-brutal-sm)",
        }}
      >
        <div
          className="w-10 h-10 shrink-0 flex items-center justify-center"
          style={{ backgroundColor: "var(--accent)" }}
        >
          <Bot size={20} className="text-white" />
        </div>
        <div>
          <div className="text-sm font-extrabold uppercase text-white">
            Let AI Find Your Perfect Match
          </div>
          <div className="text-xs font-medium text-zinc-400">
            Describe your project and our agent will rank the best vibe coders for you
          </div>
        </div>
      </Link>

      {/* Search & Filters */}
      <div className="mb-8 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
            <input
              type="text"
              placeholder="Search by name, tech stack, or tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-brutal" style={{ paddingLeft: "2.5rem" }}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-3 text-sm font-extrabold uppercase tracking-wide cursor-pointer transition-colors"
            style={{
              backgroundColor: showFilters ? "var(--accent)" : "#FFFFFF",
              color: showFilters ? "#FFFFFF" : "#0F0F0F",
              border: "2px solid #0F0F0F",
            }}
          >
            <SlidersHorizontal size={16} />
            Filters
          </button>
        </div>

        {showFilters && (
          <div
            className="flex flex-wrap gap-4 p-4"
            style={{
              backgroundColor: "#FFFFFF",
              border: "2px solid #0F0F0F",
              boxShadow: "var(--shadow-brutal-sm)",
            }}
          >
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="input-brutal py-2 w-auto"
              >
                <option value="vibe_score">Highest Vibe Score</option>
                <option value="streak">Longest Streak</option>
                <option value="projects">Most Projects</option>
                <option value="newest">Newest</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">Badge Level</label>
              <select
                value={badgeFilter}
                onChange={(e) => setBadgeFilter(e.target.value as BadgeLevel | "all")}
                className="input-brutal py-2 w-auto"
              >
                <option value="all">All Badges</option>
                <option value="diamond">Diamond</option>
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
                <option value="bronze">Bronze</option>
                <option value="none">No Badge</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results count */}
      <p className="mb-4 text-sm font-bold uppercase tracking-wide text-[#71717A]">
        {loading ? "Loading..." : `${filteredUsers.length} builder${filteredUsers.length !== 1 ? "s" : ""} found`}
      </p>

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-64" />
          ))}
        </div>
      ) : filteredUsers.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
          {filteredUsers.map((user) => (
            <VibecoderCard key={user.id} user={user} />
          ))}
        </div>
      ) : (
        <div
          className="p-12 text-center"
          style={{
            backgroundColor: "#FFFFFF",
            border: "2px solid #0F0F0F",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <p className="text-[#52525B] font-bold uppercase">No builders match your search.</p>
          <button
            onClick={() => { setSearch(""); setBadgeFilter("all"); }}
            className="mt-3 text-sm font-bold uppercase text-[var(--accent)] hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
