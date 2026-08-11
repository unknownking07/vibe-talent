"use client";

import { useState, useEffect, useRef } from "react";
import { fetchEndorsementState } from "@/lib/endorsement-batch";
import { ThumbsUp } from "@phosphor-icons/react";

interface EndorseButtonProps {
  projectId: string;
  initialCount: number;
  /** If true, the current viewer is the project owner (can't endorse own project) */
  isOwner?: boolean;
}

export function EndorseButton({ projectId, initialCount, isOwner = false }: EndorseButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [endorsed, setEndorsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against overlapping requests without blocking the optimistic UI —
  // a click mid-flight is dropped rather than racing a POST against a DELETE.
  const inFlight = useRef(false);
  // Once the user interacts, the (slow) mount state-check must not overwrite
  // their optimistic toggle with stale pre-click values.
  const interacted = useRef(false);

  // Check endorsement state on mount so button shows correct state after refresh.
  // Goes through the batcher: every card on the page mounts in the same tick, so
  // they share one request instead of one Worker invocation each.
  useEffect(() => {
    if (isOwner) return;
    let cancelled = false;
    fetchEndorsementState(projectId)
      .then((data) => {
        if (!cancelled && !interacted.current) {
          setEndorsed(data.user_endorsed);
          setCount(data.count);
        }
      })
.catch(() => { /* silent: the card keeps its server-rendered count */ });
    return () => { cancelled = true; };
  }, [projectId, isOwner]);

  async function handleToggle() {
    if (inFlight.current) return;
    inFlight.current = true;
    interacted.current = true;
    setError(null);

    // Snapshot for rollback, then update the UI immediately so the click feels
    // instant — the network request runs in the background and only reconciles
    // (or reverts) the count once the server responds.
    const wasEndorsed = endorsed;
    const prevCount = count;
    const nextEndorsed = !wasEndorsed;
    setEndorsed(nextEndorsed);
    setCount((c) => c + (nextEndorsed ? 1 : -1));

    try {
      const res = await fetch("/api/endorsements", {
        method: wasEndorsed ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        // Reconcile the optimistic count with the server's authoritative value.
        if (typeof data.count === "number") setCount(data.count);
      } else if (res.status === 409) {
        // Already endorsed — server agrees with the optimistic state; just sync.
        setEndorsed(true);
        if (typeof data.count === "number") setCount(data.count);
      } else {
        // Roll back the optimistic update and surface the reason.
        setEndorsed(wasEndorsed);
        setCount(prevCount);
        setError(res.status === 401 ? "Sign in to endorse" : (data.error || "Couldn't endorse"));
      }
    } catch {
      setEndorsed(wasEndorsed);
      setCount(prevCount);
      setError("Network error");
    } finally {
      inFlight.current = false;
    }
  }

  if (isOwner) {
    // Owner sees count but can't endorse
    return count > 0 ? (
      <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
        <ThumbsUp weight="fill" size={12} />
        {count}
      </div>
    ) : null;
  }

  return (
    <div className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleToggle(); }}
        aria-pressed={endorsed}
        className={`inline-flex items-center gap-1 text-xs font-semibold transition-all ${
          endorsed
            ? "text-emerald-600 hover:text-emerald-800"
            : "text-[var(--text-muted-soft)] hover:text-emerald-600"
        }`}
        title={endorsed ? "Remove endorsement" : "Endorse this project"}
      >
        <ThumbsUp weight="fill" size={12} className={endorsed ? "fill-current" : ""} />
        {count > 0 && <span>{count}</span>}
        {count === 0 && !endorsed && <span className="text-[10px]">Endorse</span>}
      </button>
      {error && (
        <span className="text-[9px] font-semibold text-red-500 mt-0.5">{error}</span>
      )}
    </div>
  );
}
