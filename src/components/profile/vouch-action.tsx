"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Fire } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { VOUCH } from "@/lib/vibe-config";

const VouchButton = dynamic(() =>
  import("@/components/token/vouch-button").then((m) => ({ default: m.VouchButton })),
);

export function VouchAction({
  builderId,
  builderUsername,
  hasBackers,
}: {
  builderId: string;
  builderUsername: string;
  hasBackers: boolean;
}) {
  const [viewer, setViewer] = useState<{ id: string; vibeScore: number } | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function loadViewer() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user || user.id === builderId) return;

      const { data } = await supabase
        .from("users")
        .select("vibe_score")
        .eq("id", user.id)
        .maybeSingle();
      const score = (data as { vibe_score?: number } | null)?.vibe_score ?? 0;
      if (active) setViewer({ id: user.id, vibeScore: score });
    }

    loadViewer().catch(() => {});
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setViewer(null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [builderId]);

  if (!viewer) return null;

  const button = (
    <VouchButton
      viewerId={viewer.id}
      viewerVibeScore={viewer.vibeScore}
      builderUsername={builderUsername}
      builderId={builderId}
    />
  );

  if (hasBackers) return <div className="mt-4">{button}</div>;

  return (
    <section className="card-brutal p-5" aria-labelledby="backed-by-heading">
      <div className="flex items-center gap-2">
        <Fire weight="fill" size={18} style={{ color: "var(--accent)" }} />
        <h2
          id="backed-by-heading"
          className="text-sm font-extrabold uppercase tracking-wide text-[var(--foreground)]"
        >
          Back this builder
        </h2>
      </div>
      <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Nobody has backed @{builderUsername} yet. Burn $VIBE to put real
        conviction behind them — your name and the amount show here
        permanently. From ${VOUCH.minUsd}.
      </p>
      <div className="mt-4">{button}</div>
    </section>
  );
}
