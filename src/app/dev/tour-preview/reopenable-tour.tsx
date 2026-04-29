"use client";

import { useState } from "react";
import { OnboardingTour } from "@/components/onboarding/onboarding-tour";

/**
 * Wrapper that re-opens the tour after dismissal so the preview page stays
 * useful for repeat clicks. The actual tour component handles its own state;
 * we just remount it with a fresh key when the user closes it.
 */
export function ReopenableTour({ username }: { username: string }) {
  const [openId, setOpenId] = useState(0);

  return (
    <>
      <OnboardingTour
        key={openId}
        username={username}
        forceOpen
        onClose={() => {
          // Tiny delay so the modal animation doesn't visibly snap-restart.
          setTimeout(() => setOpenId((id) => id + 1), 250);
        }}
      />
    </>
  );
}
