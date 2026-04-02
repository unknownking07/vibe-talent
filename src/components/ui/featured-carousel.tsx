"use client";

import { useState, useEffect, useCallback } from "react";
import { Megaphone, ChevronLeft, ChevronRight, ExternalLink, Clock, Sparkles, Wallet, Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const CONTRACT_ADDR = "0x2cDB438f418f5cb53e8Ea87cFD981397FDe3d0da";
const USDC_ADDR = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_CHAIN_ID = 8453;
const BASE_RPC = "https://mainnet.base.org";

// Function selectors (keccak256 of signature, first 4 bytes)
const SEL = {
  getActivePromotions: "0x5fd2d522",
  getPrices: "0xbd9a548b",
  promote: "0x511c3fa5",
  approve: "0x095ea7b3",
  allowance: "0xdd62ed3e",
  balanceOf: "0x70a08231",
};

const PACKAGES = [
  { label: "1 Day", value: 0 },
  { label: "3 Days", value: 1 },
  { label: "7 Days", value: 2 },
  { label: "30 Days", value: 3 },
  { label: "Lifetime", value: 4 },
] as const;

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

// Fallback prices matching contract defaults (in USDC 6 decimals)
const FALLBACK_PRICES: bigint[] = [
  BigInt(500000),   // $0.50
  BigInt(1000000),  // $1.00
  BigInt(2000000),  // $2.00
  BigInt(5000000),  // $5.00
  BigInt(15000000), // $15.00
];

async function fetchPromotions(): Promise<Promotion[]> {
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

// ── ABI encoding helpers for wallet transactions ──

function padLeft(hex: string, bytes: number): string {
  return hex.padStart(bytes * 2, "0");
}

function encodeUint256(n: number | bigint): string {
  return padLeft(BigInt(n).toString(16), 32);
}

function encodeAddress(addr: string): string {
  return padLeft(addr.replace("0x", "").toLowerCase(), 32);
}

function encodeString(s: string): string {
  const hex = Array.from(new TextEncoder().encode(s))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const paddedLen = Math.ceil(hex.length / 64) * 64;
  return encodeUint256(s.length) + hex.padEnd(paddedLen, "0");
}

// promote(string projectId, string projectName, uint8 package_, uint256 maxPrice)
function encodePromoteCalldata(
  projectId: string,
  projectName: string,
  pkg: number,
  maxPrice: bigint
): string {
  // Head: 4 offsets for (string, string, uint8, uint256)
  // string offsets point to tail data, uint8 and uint256 are inline
  const headSlots = 4; // 4 params
  const pidEncoded = encodeString(projectId);
  const pnameEncoded = encodeString(projectName);

  // Offsets: projectId at slot 4*32=128, projectName after that
  const pidOffset = headSlots * 32;
  const pnameOffset = pidOffset + pidEncoded.length / 2;

  return (
    SEL.promote +
    encodeUint256(pidOffset) + // offset to projectId
    encodeUint256(pnameOffset) + // offset to projectName
    encodeUint256(pkg) + // package_ (uint8 but padded to 32)
    encodeUint256(maxPrice) + // maxPrice
    pidEncoded +
    pnameEncoded
  );
}

function encodeApproveCalldata(spender: string, amount: bigint): string {
  return SEL.approve + encodeAddress(spender) + encodeUint256(amount);
}

function encodeAllowanceCalldata(owner: string, spender: string): string {
  return SEL.allowance + encodeAddress(owner) + encodeAddress(spender);
}

async function fetchPrices(): Promise<bigint[]> {
  try {
    const res = await fetch(BASE_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: CONTRACT_ADDR, data: SEL.getPrices }, "latest"],
      }),
    });
    const json = await res.json();
    if (!json.result || json.result === "0x" || json.result.length < 10) return FALLBACK_PRICES;
    const data = json.result.slice(2);
    const prices: bigint[] = [];
    for (let i = 0; i < 5; i++) {
      prices.push(BigInt("0x" + data.slice(i * 64, i * 64 + 64)));
    }
    return prices;
  } catch {
    return FALLBACK_PRICES;
  }
}

// ── Ethereum wallet helpers ──

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
}

function getEthereum(): EthereumProvider | null {
  if (typeof window !== "undefined" && (window as unknown as { ethereum?: EthereumProvider }).ethereum) {
    return (window as unknown as { ethereum: EthereumProvider }).ethereum;
  }
  return null;
}

async function ensureBaseChain(ethereum: EthereumProvider): Promise<boolean> {
  const chainId = (await ethereum.request({ method: "eth_chainId" })) as string;
  if (parseInt(chainId, 16) === BASE_CHAIN_ID) return true;
  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x" + BASE_CHAIN_ID.toString(16) }],
    });
    return true;
  } catch {
    return false;
  }
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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Check if user is logged in
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
      setAuthChecked(true);
    });
  }, []);

  const refreshPromotions = useCallback(() => {
    fetchPromotions().then((p) => {
      setPromotions(p);
      setLoading(false);
    }).catch(() => {
      setPromotions([]);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    refreshPromotions();
  }, [authChecked, refreshPromotions]);

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
              Loading promotions...
            </p>
          </div>
        )}

        {!loading && promotions.length === 0 && (
          <div
            className="p-8 text-center"
            style={{
              border: "2px solid var(--border-hard)",
              backgroundColor: "var(--bg-surface)",
            }}
          >
            <p className="text-sm font-bold uppercase text-[var(--text-muted)]">
              No active promotions yet — be the first!
            </p>
          </div>
        )}

        {!loading && promotions.length > 0 && (
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

        {/* Promote Form */}
        <PromoteForm onSuccess={refreshPromotions} isLoggedIn={isLoggedIn} />
      </div>
    </section>
  );
}

// ── Promote Form (wallet connect + project dropdown + USDC approve + promote) ──

type UserProject = { id: string; title: string };

function PromoteForm({ onSuccess, isLoggedIn }: { onSuccess: () => void; isLoggedIn: boolean }) {
  const [wallet, setWallet] = useState<string | null>(null);
  const [prices, setPrices] = useState<bigint[]>(FALLBACK_PRICES);
  const [selectedPkg, setSelectedPkg] = useState(2); // default 7 days
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [status, setStatus] = useState<{ msg: string; type: "info" | "error" | "success" } | null>(null);
  const [busy, setBusy] = useState(false);

  // Load prices + user's projects on mount
  useEffect(() => {
    fetchPrices().then(setPrices);

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoadingProjects(false); return; }
      supabase
        .from("projects")
        .select("id, title")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          setProjects(data || []);
          setLoadingProjects(false);
        });
    });
  }, []);

  async function connectWallet() {
    const ethereum = getEthereum();
    if (!ethereum) {
      setStatus({ msg: "Install MetaMask to continue", type: "error" });
      return;
    }
    try {
      const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
      if (accounts[0]) {
        const ok = await ensureBaseChain(ethereum);
        if (!ok) {
          setStatus({ msg: "Please switch to Base network", type: "error" });
          return;
        }
        setWallet(accounts[0].toLowerCase());
        setStatus(null);
      }
    } catch {
      setStatus({ msg: "Wallet connection failed", type: "error" });
    }
  }

  async function handlePromote() {
    const project = projects.find((p) => p.id === selectedProject);
    if (!wallet || !project) {
      setStatus({ msg: "Select a project first", type: "error" });
      return;
    }

    const ethereum = getEthereum();
    if (!ethereum) return;

    const price = prices[selectedPkg];
    setBusy(true);

    try {
      setStatus({ msg: "Checking USDC allowance...", type: "info" });
      const allowanceData = encodeAllowanceCalldata(wallet, CONTRACT_ADDR);
      const allowanceRes = await fetch(BASE_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "eth_call",
          params: [{ to: USDC_ADDR, data: allowanceData }, "latest"],
        }),
      });
      const allowanceJson = await allowanceRes.json();
      const currentAllowance = BigInt(allowanceJson.result || "0x0");

      if (currentAllowance < price) {
        setStatus({ msg: `Approving $${(Number(price) / 1e6).toFixed(2)} USDC...`, type: "info" });
        const approveTx = encodeApproveCalldata(CONTRACT_ADDR, price);
        const approveTxHash = await ethereum.request({
          method: "eth_sendTransaction",
          params: [{ from: wallet, to: USDC_ADDR, data: approveTx }],
        });
        setStatus({ msg: "Waiting for approval...", type: "info" });
        await waitForTx(approveTxHash as string);
      }

      setStatus({ msg: `Promoting "${project.title}"...`, type: "info" });
      const promoteData = encodePromoteCalldata(project.id, project.title, selectedPkg, price);
      const txHash = await ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: wallet, to: CONTRACT_ADDR, data: promoteData }],
      });
      setStatus({ msg: "Waiting for confirmation...", type: "info" });
      await waitForTx(txHash as string);

      setStatus({ msg: `"${project.title}" is now featured!`, type: "success" });
      setSelectedProject("");
      onSuccess();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Transaction failed";
      setStatus({ msg, type: "error" });
    } finally {
      setBusy(false);
    }
  }

  const currentPrice = prices[selectedPkg];
  const priceStr = `$${(Number(currentPrice) / 1e6).toFixed(2)}`;
  const hasProject = selectedProject !== "";

  return (
    <div
      className="mt-8 p-6"
      style={{
        border: "2px solid var(--border-hard)",
        boxShadow: "var(--shadow-brutal-sm)",
        backgroundColor: "var(--bg-surface)",
      }}
    >
      <h3 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">
        Feature Your Project
      </h3>

      {!wallet ? (
        <button
          onClick={() => {
            if (!isLoggedIn) { window.location.href = "/auth/login?redirect=/&reason=promote"; return; }
            connectWallet();
          }}
          className="btn-brutal btn-brutal-primary text-sm flex items-center gap-2"
        >
          <Wallet size={16} /> Connect Wallet
        </button>
      ) : (
        <div className="space-y-4">
          <p className="text-xs font-bold text-[var(--text-muted)] font-mono">
            Connected: {shortAddr(wallet)}
          </p>

          {/* Project dropdown */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Select Project
            </label>
            {loadingProjects ? (
              <p className="text-xs text-[var(--text-muted)] animate-pulse">Loading your projects...</p>
            ) : projects.length === 0 ? (
              <div
                className="p-4 text-center"
                style={{ border: "2px solid var(--border-hard)", backgroundColor: "var(--background)" }}
              >
                <p className="text-sm font-bold text-[var(--text-muted)] mb-2">No projects on your profile yet</p>
                <a
                  href="/dashboard"
                  className="btn-brutal btn-brutal-primary text-xs inline-flex items-center gap-1"
                >
                  Add a Project
                </a>
              </div>
            ) : (
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 text-sm font-medium"
                style={{
                  backgroundColor: "var(--background)",
                  border: "2px solid var(--border-hard)",
                  color: "var(--foreground)",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="">Choose a project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            )}
          </div>

          {/* Package selector */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Package
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {PACKAGES.map((pkg) => (
                <button
                  key={pkg.value}
                  onClick={() => setSelectedPkg(pkg.value)}
                  className="p-3 text-center transition-all"
                  style={{
                    border: `2px solid ${selectedPkg === pkg.value ? "var(--accent)" : "var(--border-hard)"}`,
                    backgroundColor: selectedPkg === pkg.value ? "var(--accent)" : "var(--bg-surface)",
                    boxShadow: selectedPkg === pkg.value ? "var(--shadow-brutal-xs)" : "none",
                    color: selectedPkg === pkg.value ? "white" : "var(--foreground)",
                  }}
                >
                  <div className="text-xs font-extrabold uppercase">{pkg.label}</div>
                  <div className="text-[10px] font-bold font-mono mt-0.5">
                    ${(Number(prices[pkg.value]) / 1e6).toFixed(2)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {status && (
            <div
              className="px-3 py-2 text-xs font-bold uppercase"
              style={{
                border: "2px solid var(--border-hard)",
                backgroundColor:
                  status.type === "error" ? "var(--status-error-bg)" :
                  status.type === "success" ? "var(--status-success-bg)" :
                  "var(--bg-surface)",
                color:
                  status.type === "error" ? "var(--status-error-text)" :
                  status.type === "success" ? "var(--status-success-text)" :
                  "var(--foreground)",
              }}
            >
              {status.msg}
            </div>
          )}

          <button
            onClick={handlePromote}
            disabled={busy || !hasProject}
            className="btn-brutal btn-brutal-primary text-sm w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? (
              <><Loader2 size={16} className="animate-spin" /> Processing...</>
            ) : (
              <><Check size={16} /> Approve {priceStr} USDC &amp; Promote</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Wait for tx confirmation ──

async function waitForTx(txHash: string, timeout = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const res = await fetch(BASE_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt",
        params: [txHash],
      }),
    });
    const json = await res.json();
    if (json.result) {
      if (json.result.status === "0x1") return;
      throw new Error("Transaction reverted");
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Transaction timed out");
}
