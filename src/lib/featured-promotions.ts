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

    return ids.map((id, i) => ({
      id,
      promoter: promoters[i],
      projectId: projectIds[i],
      projectName: projectNames[i],
      expiresAt: expiresAts[i],
      paidAmount: paidAmounts[i],
    }));
  } catch {
    return [];
  }
}

export async function enrichPromotions(promotions: Promotion[]): Promise<EnrichedPromotion[]> {
  if (promotions.length === 0) return [];
  try {
    const supabase = createClient();
    const projectIds = [...new Set(promotions.map((p) => p.projectId))];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: projects } = await (supabase as any)
      .from("projects")
      .select("id, title, description, tech_stack, live_url, github_url, image_url, verified, quality_score, endorsement_count, user_id")
      .in("id", projectIds);

    const projectMap = new Map<string, EnrichedProject & { user_id: string }>();
    for (const p of projects || []) {
      projectMap.set(p.id, p);
    }

    const userIds = [...new Set((projects || []).map((p: { user_id: string }) => p.user_id))];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: users } = await (supabase as any)
      .from("users")
      .select("id, username, display_name, avatar_url, vibe_score, streak, badge_level")
      .in("id", userIds);

    const userMap = new Map<string, EnrichedAuthor>();
    for (const u of users || []) {
      userMap.set(u.id, u);
    }

    return promotions.map((promo) => {
      const proj = projectMap.get(promo.projectId) || null;
      const author = proj ? userMap.get(proj.user_id) || null : null;
      return { ...promo, project: proj, author };
    });
  } catch {
    // Graceful fallback — show basic promotion data
    return promotions.map((promo) => ({ ...promo, project: null, author: null }));
  }
}
