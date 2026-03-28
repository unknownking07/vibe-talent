"use client";

import { useEffect } from "react";

export function ProfileViewTracker({ viewedUserId }: { viewedUserId: string }) {
  useEffect(() => {
    fetch("/api/profile-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewed_user_id: viewedUserId }),
    }).catch(() => {});
  }, [viewedUserId]);

  return null;
}
