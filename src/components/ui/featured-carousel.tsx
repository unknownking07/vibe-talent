"use client";

import { useState, useEffect, useCallback } from "react";
import { Megaphone, ChevronLeft, ChevronRight, ExternalLink, Clock, Sparkles, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const CONTRACT_ADDR = "0x2cDB438f418f5cb53e8Ea87cFD981397FDe3d0da";
const BASE_RPC = "https://mainnet.base.org";

// Only these GitHub users can see the full carousel during testing
const PREVIEW_USERS = ["stuart5915", "unknownking07"];

// ABI-encoded selector for getActivePromotions()
const GET_ACTIVE_PROMOS_SELECTOR = "0x5fd2d522";

type Promotion = {
  id: number;
  promoter: string;
  projectId: string;
  projectName: string;
  expiresAt: number;
  paidAmount: number;
};

function decodeAddress(hex: string): string {
  return "0x" + hex.slice(24);
}

function decodeUint256(hex: string): number {
  return parseInt(hex, 16);
}

function decodeStringArray(data: string, arrayWordOffset: number): string[] {
  // arrayWordOffset points to the word that contains the offset to the array
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

async function fetchPromotions(): Promise<Promotion[]> {
  const res = await fetch(BASE_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: CONTRACT_ADDR, data: GET_ACTIVE_PROMOS_SELECTOR }, "latest"],
    }),
  });
  const json = await res.json();
  if (!json.result || json.result === "0x") return [];

  const data = json.result.slice(2); // strip 0x

  // Return type: (uint256[] ids, address[] promoters, string[] projectIds, string[] projectNames, uint256[] expiresAts, uint256[] paidAmounts)
  // First 6 words are offsets to each dynamic array
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
}

function shortAddr(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function timeLeft(expiresAt: number): string {
  if (expiresAt === 0) return "Lifetime";
  const now = Math.floor(Date.now() / 1000);
  const diff = expiresAt - now;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h left`;
}

export function FeaturedCarousel() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Check if current user is in the preview list
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const gh = (
          user.user_metadata?.user_name ||
          user.user_metadata?.preferred_username ||
          ""
        ).toLowerCase();
        setHasAccess(PREVIEW_USERS.includes(gh));
      }
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    // Always fetch promotions — we show "coming soon" to non-preview users
    // but still want to know if there are any (to decide whether to render at all)
    fetchPromotions()
      .then((p) => {
        setPromotions(p);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [authChecked]);

  // Auto-advance every 5s
  useEffect(() => {
    if (promotions.length <= 1) return;
    const interval = setInterval(() => {
      setCurrent((c) => (c + 1) % promotions.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [promotions.length]);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + promotions.length) % promotions.length);
  }, [promotions.length]);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % promotions.length);
  }, [promotions.length]);

  // Don't render until auth check is done
  if (!authChecked) return null;

  // For non-preview users: show "Coming Soon" teaser
  if (!hasAccess) {
    return (
      <section
        style={{
          borderTop: "2px solid var(--border-hard)",
          borderBottom: "2px solid var(--border-hard)",
          backgroundColor: "var(--bg-surface)",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
          <div
            className="p-8 sm:p-12 text-center"
            style={{
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal)",
              backgroundColor: "var(--bg-surface)",
            }}
          >
            <Lock size={28} className="mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <h2 className="text-2xl font-extrabold uppercase text-[var(--foreground)] mb-2">
              Featured Projects — Coming Soon
            </h2>
            <p className="text-sm font-medium text-[var(--text-secondary)] max-w-md mx-auto">
              Pay with USDC to feature your project on the VibeTalent homepage.
              On-chain. Transparent. Launching soon.
            </p>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Powered by{" "}
              <a
                href="https://inclawbate.app"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[var(--accent)] transition-colors"
              >
                Inclawbate
              </a>
            </p>
          </div>
        </div>
      </section>
    );
  }

  // For preview users: hide if no promotions
  if (!loading && !error && promotions.length === 0) return null;

  return (
    <section
      style={{
        borderTop: "2px solid var(--border-hard)",
        borderBottom: "2px solid var(--border-hard)",
        backgroundColor: "var(--bg-surface)",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="flex items-center gap-3 mb-6">
          <Megaphone size={20} style={{ color: "var(--accent)" }} />
          <h2 className="text-xl font-extrabold uppercase text-[var(--foreground)]">
            Featured Projects
          </h2>
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5"
            style={{
              backgroundColor: "var(--accent)",
              color: "white",
            }}
          >
            Sponsored
          </span>
        </div>

        {loading && (
          <div
            className="p-8 text-center"
            style={{
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal-sm)",
              backgroundColor: "var(--bg-surface)",
            }}
          >
            <p className="text-sm font-bold uppercase text-[var(--text-muted)] animate-pulse">
              Loading on-chain promotions...
            </p>
          </div>
        )}

        {error && (
          <div
            className="p-8 text-center"
            style={{
              border: "2px solid var(--border-hard)",
              backgroundColor: "var(--bg-surface)",
            }}
          >
            <p className="text-sm font-bold uppercase text-[var(--text-muted)]">
              Could not load promotions
            </p>
          </div>
        )}

        {!loading && !error && promotions.length > 0 && (
          <div className="relative">
            {/* Carousel container */}
            <div
              className="overflow-hidden"
              style={{
                border: "2px solid var(--border-hard)",
                boxShadow: "var(--shadow-brutal)",
              }}
            >
              <div
                className="flex transition-transform duration-300 ease-in-out"
                style={{ transform: `translateX(-${current * 100}%)` }}
              >
                {promotions.map((promo) => (
                  <div
                    key={promo.id}
                    className="min-w-full p-6 sm:p-8"
                    style={{ backgroundColor: "var(--bg-surface)" }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles size={16} style={{ color: "var(--accent)" }} />
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5"
                            style={{
                              backgroundColor: promo.expiresAt === 0
                                ? "var(--badge-gold)"
                                : "var(--accent)",
                              color: "white",
                            }}
                          >
                            {promo.expiresAt === 0 ? "Lifetime" : "Featured"}
                          </span>
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-extrabold uppercase text-[var(--foreground)] truncate">
                          {promo.projectName}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-bold uppercase text-[var(--text-muted)]">
                          <span className="font-mono">{shortAddr(promo.promoter)}</span>
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {timeLeft(promo.expiresAt)}
                          </span>
                        </div>
                      </div>
                      <a
                        href={`/explore?q=${encodeURIComponent(promo.projectName)}`}
                        className="btn-brutal btn-brutal-primary text-sm whitespace-nowrap flex items-center gap-2"
                      >
                        View Project <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation */}
            {promotions.length > 1 && (
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={prev}
                  className="p-2 transition-all hover:translate-x-[-2px] hover:translate-y-[-2px]"
                  style={{
                    border: "2px solid var(--border-hard)",
                    boxShadow: "var(--shadow-brutal-xs)",
                    backgroundColor: "var(--bg-surface)",
                  }}
                  aria-label="Previous promotion"
                >
                  <ChevronLeft size={16} style={{ color: "var(--foreground)" }} />
                </button>

                <div className="flex items-center gap-2">
                  {promotions.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrent(i)}
                      className="transition-all"
                      style={{
                        width: i === current ? 24 : 8,
                        height: 8,
                        backgroundColor: i === current ? "var(--accent)" : "var(--border-subtle)",
                        border: "2px solid var(--border-hard)",
                      }}
                      aria-label={`Go to slide ${i + 1}`}
                    />
                  ))}
                </div>

                <button
                  onClick={next}
                  className="p-2 transition-all hover:translate-x-[2px] hover:translate-y-[-2px]"
                  style={{
                    border: "2px solid var(--border-hard)",
                    boxShadow: "var(--shadow-brutal-xs)",
                    backgroundColor: "var(--bg-surface)",
                  }}
                  aria-label="Next promotion"
                >
                  <ChevronRight size={16} style={{ color: "var(--foreground)" }} />
                </button>
              </div>
            )}
          </div>
        )}

        <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] text-center">
          On-chain promotions powered by{" "}
          <a
            href="https://inclawbate.app"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--accent)] transition-colors"
          >
            Inclawbate
          </a>
        </p>
      </div>
    </section>
  );
}
