"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Lazy-loaded so the Privy / WalletConnect / Coinbase / Solana / viem stack
// (~60 chunks) stays off /pricing's critical path. The placeholder matches the
// real card's dimensions to avoid CLS when it swaps in — same approach the
// homepage's featured-section used before the carousel was removed.
const FeatureYourProjectCard = dynamic(
  () =>
    import("@/components/ui/featured/feature-your-project-card").then((m) => ({
      default: m.FeatureYourProjectCard,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading promote-your-project card"
        className="card-brutal relative p-6 flex flex-col md:min-h-[420px] overflow-hidden"
        style={{ backgroundColor: "var(--bg-surface)" }}
      >
        <h3 className="text-2xl font-extrabold uppercase leading-tight">
          <span className="block text-[var(--foreground)]">Feature</span>
          <span className="block" style={{ color: "var(--accent)" }}>Your Project</span>
        </h3>
        <div className="mt-6 space-y-3">
          <div className="h-3 w-3/4 animate-pulse" style={{ backgroundColor: "var(--border-subtle)" }} />
          <div className="h-3 w-2/3 animate-pulse" style={{ backgroundColor: "var(--border-subtle)" }} />
        </div>
      </div>
    ),
  },
);

export function FeatureCheckout() {
  const searchParams = useSearchParams();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Supabase auth check — only gates the claim-flow UX inside the card. Mirrors
  // featured-section's pattern: the card itself loads the user's projects.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
  }, []);

  return (
    <section
      id="feature-checkout"
      className="p-6 mt-10"
      style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}
    >
      <div className="flex items-center gap-3 mb-4">
        <Megaphone size={20} style={{ color: "var(--accent)" }} />
        <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)]">Feature Your Project</h2>
      </div>
      <p className="text-sm text-[var(--text-secondary)] font-medium mb-5 leading-relaxed">
        Connect your wallet, pick a project, and pay with USDC on Base or Solana. Your slot goes live within
        seconds of the transaction confirming.
      </p>
      <div className="max-w-md">
        <FeatureYourProjectCard
          preselectedProjectId={searchParams.get("project") ?? undefined}
          isLoggedIn={isLoggedIn}
          onSuccess={() => {}}
        />
      </div>
    </section>
  );
}
