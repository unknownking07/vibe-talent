// The Bags Hackathon cohort, matched to builders by GitHub owner.
//
// WHY THIS IS A STATIC LIST AND NOT AN INTEGRATION: the cohort is closed. The
// DoraHacks submission window ran to 2026-05-11 and produced exactly these 45
// entries, so there is nothing to poll. A cron that re-fetched a frozen list
// every day would be a live dependency bought for no freshness at all.
//
// WHY GITHUB AND NOT AN X HANDLE: every submission required a repository link,
// and GitHub is the identity VibeTalent actually verifies through OAuth. The
// Bags hackathon leaderboard exposes X handles instead, and joining on those
// would mean trusting a self-reported field to award a badge — the one thing
// this product must never do. Matching on the GitHub owner means a builder is
// only ever tied to a project whose repository they are already verified
// against.
//
// A badge from this list says "this builder entered the Bags Hackathon". It
// says nothing about how they placed, and nothing about any token.
//
// Source: https://dorahacks.io/hackathon/the-bags-hackathon/buidl

export type HackathonProject = {
  name: string;
  /** GitHub owner from the submitted repository URL. The join key. */
  githubOwner: string;
  track: string;
};

export const HACKATHON_PROJECTS: readonly HackathonProject[] = [
  { name: "Delphi", githubOwner: "NECOKIZZ", track: "Bags API" },
  { name: "Sentinel", githubOwner: "loquit-tud", track: "AI Agents" },
  { name: "BagsLink", githubOwner: "Vevolat", track: "Social Finance" },
  { name: "BagxPress", githubOwner: "nsdBRoficial", track: "Payments" },
  {
    name: "GhostComm - Social Proxy",
    githubOwner: "garib7",
    track: "Social Finance",
  },
  { name: "GhostAgent Protocol", githubOwner: "garib7", track: "AI Agents" },
  { name: "Bags Alpha", githubOwner: "Zink0909", track: "Bags API" },
  { name: "CreatorPass", githubOwner: "Ming7177", track: "Payments" },
  { name: "BagsPulse", githubOwner: "mrnetwork0001", track: "Social Finance" },
  { name: "ARGUS", githubOwner: "dotcom07", track: "Other" },
  { name: "PrivyBag", githubOwner: "ritesh59697", track: "Privacy" },
  { name: "Meshlens", githubOwner: "alvin20062006-beep", track: "DeFi" },
  { name: "Bags Index", githubOwner: "JMadhan1", track: "Fee Sharing" },
  { name: "GitShipt", githubOwner: "SYMBaiEX", track: "Bags API" },
  { name: "Loopin", githubOwner: "Loopin-game", track: "Social Finance" },
  { name: "CreatorRadar", githubOwner: "anjolagithub", track: "AI Agents" },
  { name: "Bags Boost", githubOwner: "yieio", track: "Fee Sharing" },
  { name: "nuke.fm", githubOwner: "nukefm", track: "Bags API" },
  { name: "Bags Launchpad", githubOwner: "vanvan95", track: "Bags API" },
  { name: "Backr", githubOwner: "elonmasai7", track: "DeFi" },
  { name: "TrustLink Pay", githubOwner: "bigdreamsweb3", track: "Payments" },
  { name: "Bags Strategy Bot", githubOwner: "vanvan95", track: "Bags API" },
  { name: "TokenSight Ai", githubOwner: "mrarindam", track: "AI Agents" },
  { name: "Bagflow", githubOwner: "Eniola3321", track: "AI Agents" },
  { name: "Patronage", githubOwner: "joachimber", track: "Bags API" },
  { name: "BagOS", githubOwner: "edycutjong", track: "Claude Skills" },
  { name: "blackhole", githubOwner: "YousufAziz1", track: "Social Finance" },
  { name: "MEMERUSH", githubOwner: "jesspoex", track: "Other" },
  { name: "Proof", githubOwner: "bellobambo", track: "DeFi" },
  { name: "Tend", githubOwner: "RedGnad", track: "Fee Sharing" },
  { name: "BagsLaunchKit", githubOwner: "YousufAziz1", track: "AI Agents" },
  { name: "SwarmFi", githubOwner: "zan-maker", track: "DeFi" },
  {
    name: "Bags Campaign Launcher",
    githubOwner: "Dev-In-Crypt",
    track: "Bags API",
  },
  { name: "Trenchy.fun", githubOwner: "trenchydotfun", track: "Bags API" },
  { name: "BagsBrain", githubOwner: "iam25th1", track: "Bags API" },
  {
    name: "The Bags - AI Token Launchpad",
    githubOwner: "mrcodexter",
    track: "Bags API",
  },
  {
    name: "Aura - Confidential Creator Fund",
    githubOwner: "dakshrawat298-gif",
    track: "Bags API",
  },
  { name: "CreatorLoop", githubOwner: "creatorloopxyz", track: "Bags API" },
  {
    name: "Anti-scam reputation layer",
    githubOwner: "rudimentall1",
    track: "AI Agents",
  },
  { name: "BagsAI-Lite", githubOwner: "cryptochitty", track: "AI Agents" },
  { name: "BagScan", githubOwner: "nrlartt", track: "Bags API" },
  {
    name: "Agro-Energy RWA Exchange",
    githubOwner: "EgorovDimaIT",
    track: "Bags API",
  },
  { name: "BagsBlitz", githubOwner: "Artem1981777", track: "AI Agents" },
  { name: "BagsShield", githubOwner: "kaminovaglobal", track: "Privacy" },
  { name: "BagsFuel", githubOwner: "minalkharat-cmd", track: "Claude Skills" },
] as const;

/**
 * Lowercased owner -> that owner's submissions.
 *
 * A list rather than a single project: several builders entered twice, and
 * showing one of two would quietly understate what they did.
 */
const BY_OWNER = new Map<string, HackathonProject[]>();
for (const project of HACKATHON_PROJECTS) {
  const key = project.githubOwner.toLowerCase();
  const existing = BY_OWNER.get(key);
  if (existing) existing.push(project);
  else BY_OWNER.set(key, [project]);
}

/**
 * The hackathon entries submitted by this GitHub owner, or an empty list.
 *
 * Case-insensitive: GitHub treats usernames that way, and a builder who signed
 * up as "IAm25th1" is the same person who submitted as "iam25th1".
 */
export function hackathonProjectsFor(
  githubUsername: string | null | undefined,
): HackathonProject[] {
  if (!githubUsername?.trim()) return [];
  return BY_OWNER.get(githubUsername.trim().toLowerCase()) ?? [];
}

/** Did this builder enter the hackathon at all? */
export function isHackathonBuilder(
  githubUsername: string | null | undefined,
): boolean {
  return hackathonProjectsFor(githubUsername).length > 0;
}
