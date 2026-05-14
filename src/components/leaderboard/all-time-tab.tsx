"use client";

import { LeaderboardContent } from "./leaderboard-content";
import type { UserWithSocials } from "@/lib/types/database";

export function AllTimeTab({ users }: { users: UserWithSocials[] }) {
  return <LeaderboardContent users={users} />;
}
