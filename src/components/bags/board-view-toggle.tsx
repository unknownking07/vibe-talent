"use client";

import { useState, type ReactNode } from "react";

/**
 * Switches /bags between the launches board and the hackathon roster.
 *
 * Both panels are rendered on the server and passed in as children, so the
 * toggle only changes which one is mounted. That keeps every row a server
 * component — the rows use the /ssr icon entrypoint and hit the database — and
 * keeps this page static rather than turning it dynamic on a search param.
 */
export function BoardViewToggle({
  launches,
  hackathon,
  launchCount,
  hackathonCount,
}: {
  launches: ReactNode;
  hackathon: ReactNode;
  launchCount: number;
  hackathonCount: number;
}) {
  const [view, setView] = useState<"launches" | "hackathon">("launches");

  return (
    <>
      <div
        className="mb-6 inline-flex rounded-full p-1"
        role="tablist"
        aria-label="What to show on the board"
        style={{
          backgroundColor: "var(--bags-surface)",
          border: "1px solid var(--bags-border)",
        }}
      >
        <Tab
          active={view === "launches"}
          onClick={() => setView("launches")}
          label="Launches"
          count={launchCount}
        />
        <Tab
          active={view === "hackathon"}
          onClick={() => setView("hackathon")}
          label="Hackathon projects"
          count={hackathonCount}
        />
      </div>

      {view === "launches" ? launches : hackathon}
    </>
  );
}

function Tab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="rounded-full px-4 py-1.5 text-[12px] font-bold transition-colors"
      style={
        active
          ? { backgroundColor: "var(--bags-green)", color: "var(--bags-bg)" }
          : { color: "var(--bags-text-muted)" }
      }
    >
      {label}
      <span className="ml-1.5 font-mono opacity-70">{count}</span>
    </button>
  );
}
