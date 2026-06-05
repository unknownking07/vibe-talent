// Shared fetchers & types for on-chain Featured promotions.
// Used by both the full <FeaturedCarousel /> and the compact <HeroFeaturedStrip />
// so both components render the same promo data without duplicating contract
// decoding or Supabase enrichment.

import { createClient } from "@/lib/supabase/client";
import { CHAIN_CONFIGS } from "@/lib/chains-config";
import { isEVMChain } from "@/lib/chains-config";
import type { BadgeLevel } from "@/lib/types/database";

// Base chain defaults — promotions are always read from the Base contract.
const BASE_CONFIG = CHAIN_CONFIGS.base;
const CONTRACT_ADDR = isEVMChain(BASE_CONFIG) ? BASE_CONFIG.contractAddr : "";
const BASE_RPC = isEVMChain(BASE_CONFIG) ? BASE_CONFIG.rpc : "";

// Function selectors (keccak256 of signature, first 4 bytes) — read-only calls
const SEL = {
  getActivePromotions: "0x5fd2d522",
};

export type Promotion = {
  id: number;
  promoter: string;
  projectId: string;
  projectName: string;
  expiresAt: number;
  paidAmount: number;
};

export type EnrichedProject = {
  id: string;
  title: string;
  description: string;
  tech_stack: string[];
  live_url: string | null;
  github_url: string | null;
  image_url: string | null;
  verified: boolean;
  quality_score: number;
  endorsement_count: number;
};

export type EnrichedAuthor = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  vibe_score: number;
  streak: number;
  badge_level: BadgeLevel;
};

export type EnrichedPromotion = Promotion & {
  project: EnrichedProject | null;
  author: EnrichedAuthor | null;
};

// ── ABI-free hex decoders for getActivePromotions return tuple ──

function decodeAddress(hex: string): string {
  return "0x" + hex.slice(24);
}

function decodeUint256(hex: string): number {
  return parseInt(hex, 16);
}

function decodeStringArray(data: string, arrayWordOffset: number): string[] {
  const arrayDataOffset = decodeUint256(data.slice(arrayWordOffset * 64, arrayWordOffset * 64 + 64)) * 2;
  const count = decodeUint256(data.slice(arrayDataOffset, arrayDataOffset + 64));
  const strings: string[] = [];
  for (let i = 0; i < count; i++) {
    const strRelOffset = decodeUint256(data.slice(arrayDataOffset + 64 + i * 64, arrayDataOffset + 64 + i * 64 + 64)) * 2;
    const strAbsOffset = arrayDataOffset + 64 + strRelOffset;
    const strLen = decodeUint256(data.slice(strAbsOffset, strAbsOffset + 64));
    const strBytes = data.slice(strAbsOffset + 64, strAbsOffset + 64 + strLen * 2);
    let s = "";
    for (let j = 0; j < strBytes.length; j += 2) {
      s += String.fromCharCode(parseInt(strBytes.slice(j, j + 2), 16));
    }
    strings.push(s);
  }
  return strings;
}

function decodeUint256Array(data: string, arrayWordOffset: number): number[] {
  const arrayDataOffset = decodeUint256(data.slice(arrayWordOffset * 64, arrayWordOffset * 64 + 64)) * 2;
  const count = decodeUint256(data.slice(arrayDataOffset, arrayDataOffset + 64));
  const nums: number[] = [];
  for (let i = 0; i < count; i++) {
    nums.push(decodeUint256(data.slice(arrayDataOffset + 64 + i * 64, arrayDataOffset + 64 + i * 64 + 64)));
  }
  return nums;
}

function decodeAddressArray(data: string, arrayWordOffset: number): string[] {
  const arrayDataOffset = decodeUint256(data.slice(arrayWordOffset * 64, arrayWordOffset * 64 + 64)) * 2;
  const count = decodeUint256(data.slice(arrayDataOffset, arrayDataOffset + 64));
  const addrs: string[] = [];
  for (let i = 0; i < count; i++) {
    addrs.push(decodeAddress(data.slice(arrayDataOffset + 64 + i * 64, arrayDataOffset + 64 + i * 64 + 64)));
  }
  return addrs;
}

export async function fetchPromotions(): Promise<Promotion[]> {
  try {
    const res = await fetch(BASE_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: CONTRACT_ADDR, data: SEL.getActivePromotions }, "latest"],
      }),
    });
    const json = await res.json();
    if (!json.result || json.result === "0x" || json.result.length < 10) return [];

    const data = json.result.slice(2); // strip 0x
    if (data.length < 384) return []; // minimum 6 offset words = 6*64 chars

    // Return type: (uint256[] ids, address[] promoters, string[] projectIds, string[] projectNames, uint256[] expiresAts, uint256[] paidAmounts)
    const ids = decodeUint256Array(data, 0);
    if (ids.length === 0) return [];

    const promoters = decodeAddressArray(data, 1);
    const projectIds = decodeStringArray(data, 2);
    const projectNames = decodeStringArray(data, 3);
    const expiresAts = decodeUint256Array(data, 4);
    const paidAmounts = decodeUint256Array(data, 5);

    // Drop anything the contract still lists but that has already expired.
    // expiresAt === 0 means lifetime; otherwise it's a Unix timestamp in seconds.
    const nowSec = Math.floor(Date.now() / 1000);

    return ids
      .map((id, i) => ({
        id,
        promoter: promoters[i],
        projectId: projectIds[i],
        projectName: projectNames[i],
        expiresAt: expiresAts[i],
        paidAmount: paidAmounts[i],
      }))
      .filter((p) => p.expiresAt === 0 || p.expiresAt > nowSec);
  } catch {
    return [];
  }
}

// Milliseconds until the earliest non-lifetime promotion expires, plus a 1s
// buffer so the re-fetch runs *after* the expiry clock has rolled over.
// Returns null if every promotion is lifetime or already expired.
// Capped at ~23 days to stay well under setTimeout's 2^31-1 ms ceiling —
// callers that outlive the cap will simply re-schedule on the next tick.
export function msUntilNextExpiry(promos: Pick<Promotion, "expiresAt">[]): number | null {
  const nowMs = Date.now();
  const future = promos
    .filter((p) => p.expiresAt !== 0)
    .map((p) => p.expiresAt * 1000)
    .filter((ms) => ms > nowMs);
  if (future.length === 0) return null;
  return Math.min(Math.min(...future) - nowMs + 1000, 2_000_000_000);
}

// Ownership verification for audit finding #8. The on-chain promote(projectId,…)
// call accepts an arbitrary projectId, so a payer can pay to feature a project
// they don't own. We render a promotion only if its on-chain payer was
// authorized by the project's owner (recorded server-side in featured_promotions,
// keyed by `${project_id}:${promoter_wallet}`). Pure + exported for unit testing.
export function filterAuthorizedPromotions<T extends { projectId: string; promoter: string }>(
  promotions: T[],
  authorizedKeys: Set<string>,
): T[] {
  return promotions.filter((p) =>
    authorizedKeys.has(`${p.projectId}:${(p.promoter || "").toLowerCase()}`),
  );
}

// Optional `client` lets callers (e.g. server components running inside
// `unstable_cache`) pass a cookie-free Supabase client — Next.js disallows
// reading `cookies()` inside cached scopes, which would happen if we always
// instantiated the request-bound browser/SSR client here.
type PromotionsClient = ReturnType<typeof createClient>;
type SolanaPromoRow = {
  project_id: string;
  promoter_wallet: string;
  package_id: number | null;
  expires_at: string | null;
  created_at: string;
};

export async function enrichPromotions(
  promotions: Promotion[],
  client?: PromotionsClient,
): Promise<EnrichedPromotion[]> {
  try {
    const supabase = client ?? createClient();

    // EVM (Base) ownership gate (#8): keep only on-chain promotions whose payer
    // was authorized by the project's owner. featured_promotions isn't in the
    // generated DB types yet, so these queries are cast.
    let verifiedEvm: Promotion[] = [];
    if (promotions.length > 0) {
      const evmProjectIds = [...new Set(promotions.map((p) => p.projectId))];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: auths } = await (supabase as any)
        .from("featured_promotions")
        .select("project_id, promoter_wallet")
        .in("project_id", evmProjectIds);
      const authorizedKeys = new Set(
        ((auths ?? []) as Array<{ project_id: string; promoter_wallet: string }>).map(
          (a) => `${a.project_id}:${a.promoter_wallet.toLowerCase()}`,
        ),
      );
      verifiedEvm = filterAuthorizedPromotions(promotions, authorizedKeys);
    }

    // Solana promotions: featured_promotions IS the registry (no contract).
    // Render rows that are still active (lifetime = null expiry, else future).
    const nowIso = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: solData } = await (supabase as any)
      .from("featured_promotions")
      .select("project_id, promoter_wallet, package_id, expires_at, created_at")
      .eq("chain", "solana")
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("created_at", { ascending: false });
    const solana = (solData ?? []) as SolanaPromoRow[];

    if (verifiedEvm.length === 0 && solana.length === 0) return [];

    // Resolve project + author for everything we'll render, in one pair of queries.
    const allProjectIds = [
      ...new Set([...verifiedEvm.map((p) => p.projectId), ...solana.map((s) => s.project_id)]),
    ];
    const { data: projects } = await supabase
      .from("projects")
      .select("id, title, description, tech_stack, live_url, github_url, image_url, verified, quality_score, endorsement_count, user_id")
      .in("id", allProjectIds);
    const projectRows = (projects ?? []) as Array<EnrichedProject & { user_id: string }>;
    const projectMap = new Map<string, EnrichedProject & { user_id: string }>();
    for (const p of projectRows) projectMap.set(p.id, p);

    const userIds = [...new Set(projectRows.map((p) => p.user_id))];
    const { data: users } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url, vibe_score, streak, badge_level")
      .in("id", userIds);
    const userRows = (users ?? []) as Array<EnrichedAuthor & { id: string }>;
    const userMap = new Map<string, EnrichedAuthor>();
    for (const u of userRows) userMap.set(u.id, u);

    const evmEnriched: EnrichedPromotion[] = verifiedEvm.map((promo) => {
      const proj = projectMap.get(promo.projectId) || null;
      const author = proj ? userMap.get(proj.user_id) || null : null;
      return { ...promo, project: proj, author };
    });

    const solEnriched: EnrichedPromotion[] = solana.map((row, i) => {
      const proj = projectMap.get(row.project_id) || null;
      const author = proj ? userMap.get(proj.user_id) || null : null;
      return {
        // Solana rows have no on-chain id; synthesize a stable, collision-free one.
        id: 1_000_000_000 + i,
        promoter: row.promoter_wallet,
        projectId: row.project_id,
        projectName: proj?.title ?? "",
        // EnrichedPromotion.expiresAt is Unix seconds; 0 = lifetime (matches EVM).
        expiresAt: row.expires_at ? Math.floor(new Date(row.expires_at).getTime() / 1000) : 0,
        paidAmount: 0,
        project: proj,
        author,
      };
    });

    return [...evmEnriched, ...solEnriched];
  } catch {
    // Fail closed: if we can't verify, render nothing rather than risk showing an
    // unverified (possibly hijacked) promotion. Promotions are non-critical UI.
    return [];
  }
}
