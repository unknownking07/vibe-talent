"use client";

import { useState, useEffect, useCallback } from "react";
import { ThumbsUp } from "lucide-react";

interface EndorseButtonProps {
  projectId: string;
  initialCount: number;
  /** If true, the current viewer is the project owner (can't endorse own project) */
  isOwner?: boolean;
}

export function EndorseButton({ projectId, initialCount, isOwner = false }: EndorseButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [endorsed, setEndorsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check endorsement state on mount so button shows correct state after refresh
  const checkEndorsementState = useCallback(async () => {
    try {
      const res = await fetch(`/api/endorsements?project_id=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setEndorsed(data.user_endorsed);
        setCount(data.count);
      }
    } catch {
      // silent — use initial values
    }
  }, [projectId]);

  useEffect(() => {
    if (!isOwner) {
      checkEndorsementState();
    }
  }, [isOwner, checkEndorsementState]);

  async function handleToggle() {
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      if (endorsed) {
        // Remove endorsement
        const res = await fetch("/api/endorsements", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: projectId }),
        });
        if (res.ok) {
          const data = await res.json();
          setEndorsed(false);
          setCount(data.count ?? count - 1);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to remove endorsement");
        }
      } else {
        // Add endorsement
        const res = await fetch("/api/endorsements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: projectId }),
        });
        if (res.ok) {
          const data = await res.json();
          setEndorsed(true);
          setCount(data.count ?? count + 1);
        } else {
          const data = await res.json();
          if (res.status === 401) {
            setError("Sign in to endorse");
          } else if (res.status === 403) {
            setError("Can't endorse own project");
          } else if (res.status === 409) {
            // Already endorsed — sync state and count
            setEndorsed(true);
            checkEndorsementState();
          } else {
            setError(data.error || "Failed to endorse");
          }
        }
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  if (isOwner) {
    // Owner sees count but can't endorse
    return count > 0 ? (
      <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
        <ThumbsUp size={12} />
        {count}
      </div>
    ) : null;
  }

  return (
    <div className="inline-flex flex-col items-start">
      <button
        onClick={(e) => { e.stopPropagation(); handleToggle(); }}
        onMouseEnter={checkEndorsementState}
        disabled={loading}
        className={`inline-flex items-center gap-1 text-xs font-bold transition-all ${
          endorsed
            ? "text-emerald-600 hover:text-emerald-800"
            : "text-[var(--text-muted-soft)] hover:text-emerald-600"
        } disabled:opacity-50`}
        title={endorsed ? "Remove endorsement" : "Endorse this project"}
      >
        <ThumbsUp size={12} className={endorsed ? "fill-current" : ""} />
        {count > 0 && <span>{count}</span>}
        {count === 0 && !endorsed && <span className="text-[10px]">Endorse</span>}
      </button>
      {error && (
        <span className="text-[9px] font-bold text-red-500 mt-0.5">{error}</span>
      )}
    </div>
  );
}
