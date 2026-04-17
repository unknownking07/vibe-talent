"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Megaphone, ChevronLeft, ChevronRight, ExternalLink, Sparkles, Wallet, Loader2, Check, Github, Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useWallets as useSolanaWallets, useSignAndSendTransaction } from "@privy-io/react-auth/solana";
import { encodeFunctionData, parseAbi } from "viem";
import Image from "next/image";
import Link from "next/link";
import { VibeScore } from "@/components/ui/vibe-score";
import { BadgeDisplay } from "@/components/ui/badge-display";
import { CHAIN_CONFIGS, SUPPORTED_CHAINS, DEFAULT_CHAIN, getChainConfig, isEVMChain, isSolanaChain } from "@/lib/chains-config";
import { buildSolanaUSDCTransfer, confirmSolanaTransaction, signatureToString } from "@/lib/solana-payment";
import { fetchPromotions, enrichPromotions, msUntilNextExpiry, type EnrichedPromotion } from "@/lib/featured-promotions";

// Base chain defaults (for fetching promotions — always read from Base contract)
const BASE_CONFIG = CHAIN_CONFIGS.base;
const CONTRACT_ADDR = isEVMChain(BASE_CONFIG) ? BASE_CONFIG.contractAddr : "";
const BASE_RPC = isEVMChain(BASE_CONFIG) ? BASE_CONFIG.rpc : "";

// Privy must be configured for PromoteForm to mount — its hooks require PrivyProvider.
// Providers.tsx bails out when this is unset, so rendering PromoteForm would crash.
const PRIVY_CONFIGURED = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// Function selectors (keccak256 of signature, first 4 bytes) — read-only calls
const SEL = {
  getPrices: "0xbd9a548b",
};

const PACKAGES = [
  { label: "1 Day", value: 0 },
  { label: "3 Days", value: 1 },
  { label: "7 Days", value: 2 },
  { label: "30 Days", value: 3 },
  { label: "Lifetime", value: 4 },
] as const;

// Fallback prices matching contract defaults (in USDC 6 decimals)
const FALLBACK_PRICES: bigint[] = [
  BigInt(500000),   // $0.50
  BigInt(1000000),  // $1.00
  BigInt(2000000),  // $2.00
  BigInt(5000000),  // $5.00
  BigInt(15000000), // $15.00
];

// ── ABI definitions for viem encoding ──

const PROMOTE_ABI = parseAbi([
  "function promote(string projectId, string projectName, uint8 package_, uint256 maxPrice)",
]);

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

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

// ── Ethereum provider type (from Privy wallet) ──

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

function shortAddr(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}


export function FeaturedCarousel() {
  const [promotions, setPromotions] = useState<EnrichedPromotion[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const pausedRef = useRef(false);

  // Check if user is logged in (Supabase auth, not Privy)
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
      setAuthChecked(true);
    });
  }, []);

  const refreshPromotions = useCallback(() => {
    fetchPromotions()
      .then((raw) => enrichPromotions(raw))
      .then((enriched) => {
        setPromotions(enriched);
        setLoading(false);
      })
      .catch(() => {
        setPromotions([]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    refreshPromotions();
  }, [authChecked, refreshPromotions]);

  // Re-fetch at the moment the soonest promotion expires so the carousel
  // drops back to its empty state without a manual refresh.
  useEffect(() => {
    const delay = msUntilNextExpiry(promotions);
    if (delay === null) return;
    const timer = setTimeout(refreshPromotions, delay);
    return () => clearTimeout(timer);
  }, [promotions, refreshPromotions]);

  // Auto-advance every 8s, pause on hover
  useEffect(() => {
    if (promotions.length <= 1) return;
    const interval = setInterval(() => {
      if (!pausedRef.current) {
        setCurrent((c) => (c + 1) % promotions.length);
      }
    }, 8000);
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
          <div
            className="relative"
            onMouseEnter={() => { pausedRef.current = true; }}
            onMouseLeave={() => { pausedRef.current = false; }}
          >
            {/* Carousel container */}
            <div
              className="overflow-hidden"
              style={{
                border: "2px solid var(--border-hard)",
                borderLeft: "4px solid var(--accent)",
                boxShadow: "var(--shadow-brutal), 0 0 24px rgba(255, 58, 0, 0.08)",
              }}
            >
              <div
                className="flex transition-transform duration-300 ease-in-out"
                style={{ transform: `translateX(-${current * 100}%)` }}
              >
                {promotions.map((promo) => (
                  <div
                    key={promo.id}
                    className="min-w-full"
                    style={{ backgroundColor: "var(--bg-surface)" }}
                  >
                    <div className="flex flex-col sm:flex-row">
                      {/* Left: Content */}
                      <div className="flex-1 min-w-0 p-6 sm:p-8 flex flex-col">
                        {/* Badges row */}
                        <div className="flex items-center gap-2 mb-3">
                          <Crown size={14} style={{ color: "var(--accent)" }} />
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

                        {/* Title */}
                        <h3 className="text-xl sm:text-2xl font-extrabold uppercase text-[var(--foreground)] line-clamp-2 leading-tight">
                          {promo.project?.title || promo.projectName}
                        </h3>

                        {/* Description */}
                        {promo.project?.description && (
                          <p className="mt-2 text-sm font-medium text-[var(--text-secondary)] line-clamp-2">
                            {promo.project.description}
                          </p>
                        )}

                        {/* Tech stack */}
                        {(promo.project?.tech_stack ?? []).length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {promo.project!.tech_stack.slice(0, 5).map((tech) => (
                              <span
                                key={tech}
                                className="px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--text-tertiary)]"
                                style={{
                                  backgroundColor: "var(--bg-surface-light)",
                                  border: "1px solid var(--border-hard)",
                                }}
                              >
                                {tech}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Spacer */}
                        <div className="flex-1 min-h-3" />

                        {/* Author row */}
                        {promo.author && (
                          <Link
                            href={`/profile/${promo.author.username}`}
                            className="mt-3 flex items-center gap-2.5 group"
                          >
                            {promo.author.avatar_url ? (
                              <Image
                                src={promo.author.avatar_url}
                                alt={promo.author.display_name || promo.author.username}
                                width={28}
                                height={28}
                                className="object-cover"
                                style={{ border: "2px solid var(--border-hard)" }}
                              />
                            ) : (
                              <div
                                className="w-7 h-7 flex items-center justify-center text-xs font-extrabold uppercase text-[var(--text-muted)]"
                                style={{
                                  backgroundColor: "var(--bg-surface-light)",
                                  border: "2px solid var(--border-hard)",
                                }}
                              >
                                {(promo.author.display_name || promo.author.username).charAt(0)}
                              </div>
                            )}
                            <span className="text-xs font-bold text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors truncate">
                              {promo.author.display_name || `@${promo.author.username}`}
                            </span>
                            <VibeScore score={promo.author.vibe_score} size="sm" />
                            <BadgeDisplay level={promo.author.badge_level} size="sm" showLabel={false} />
                          </Link>
                        )}

                        {/* Action row */}
                        <div className="mt-4 flex items-center gap-3">
                          {promo.project?.live_url ? (
                            <a
                              href={promo.project.live_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-brutal btn-brutal-primary text-xs whitespace-nowrap flex items-center gap-2"
                            >
                              View Live <ExternalLink size={12} />
                            </a>
                          ) : promo.author ? (
                            <Link
                              href={`/profile/${promo.author.username}`}
                              className="btn-brutal btn-brutal-primary text-xs whitespace-nowrap flex items-center gap-2"
                            >
                              View Profile <ExternalLink size={12} />
                            </Link>
                          ) : (
                            <a
                              href={`/explore?q=${encodeURIComponent(promo.projectName)}`}
                              className="btn-brutal btn-brutal-primary text-xs whitespace-nowrap flex items-center gap-2"
                            >
                              View Project <ExternalLink size={12} />
                            </a>
                          )}
                          {promo.project?.github_url && (
                            <a
                              href={promo.project.github_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                              style={{
                                border: "2px solid var(--border-hard)",
                                backgroundColor: "var(--bg-surface)",
                              }}
                              aria-label="View on GitHub"
                            >
                              <Github size={14} />
                            </a>
                          )}
                          {promo.project?.endorsement_count ? (
                            <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] flex items-center gap-1">
                              <Sparkles size={10} style={{ color: "var(--accent)" }} />
                              {promo.project.endorsement_count} endorsement{promo.project.endorsement_count !== 1 ? "s" : ""}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Right: Project image in browser mockup */}
                      <div
                        className="hidden sm:flex sm:w-[320px] md:w-[420px] shrink-0 flex-col border-l-2 border-[var(--border-hard)]"
                        style={{ backgroundColor: "hsl(14, 6%, 12%)" }}
                      >
                        {promo.project?.image_url ? (
                          <>
                            {/* Browser chrome bar */}
                            <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: "hsl(14, 6%, 14%)", borderBottom: "1px solid hsl(14, 6%, 20%)" }}>
                              <div className="flex gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#FF5F56" }} />
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#FFBD2E" }} />
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#27C93F" }} />
                              </div>
                              <div className="flex-1 mx-2 px-2 py-0.5 text-[9px] font-mono truncate" style={{ backgroundColor: "hsl(14, 6%, 18%)", borderRadius: "3px", color: "hsl(14, 6%, 50%)" }}>
                                {promo.project.live_url || promo.project.title.toLowerCase().replace(/\s+/g, "") + ".com"}
                              </div>
                            </div>
                            {/* Screenshot fills remaining space */}
                            <div className="relative flex-1 min-h-0">
                              <Image
                                src={promo.project.image_url}
                                alt={promo.project.title}
                                fill
                                className="object-cover object-top"
                                sizes="(max-width: 768px) 320px, 420px"
                              />
                            </div>
                          </>
                        ) : (
                          <div className="flex-1 flex items-center justify-center">
                            <span className="text-6xl font-extrabold uppercase opacity-20 select-none tracking-widest" style={{ color: "hsl(14, 6%, 30%)" }}>
                              {(promo.project?.title || promo.projectName).charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>
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

        {/* Promote Form — gated on Privy config; PromoteForm's hooks require PrivyProvider */}
        {PRIVY_CONFIGURED ? (
          <PromoteForm onSuccess={refreshPromotions} isLoggedIn={isLoggedIn} />
        ) : process.env.NODE_ENV !== "production" ? (
          <div
            className="mt-6 p-4 text-sm font-medium"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "2px dashed var(--border-hard)",
              color: "var(--text-secondary)",
            }}
          >
            <strong className="uppercase text-[var(--foreground)]">Promote form disabled</strong>
            <span className="ml-2">
              Set <code>NEXT_PUBLIC_PRIVY_APP_ID</code> in <code>.env.local</code> to enable wallet-based promotions.
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ── Promote Form (wallet connect + project dropdown + USDC approve + promote) ──

type UserProject = { id: string; title: string };

const CHAIN_LABELS: Record<string, string> = { base: "Base", solana: "Solana" };

function PromoteForm({ onSuccess, isLoggedIn }: { onSuccess: () => void; isLoggedIn: boolean }) {
  const { login: privyLogin, logout: privyLogout, connectWallet, authenticated: privyAuthenticated, ready: privyReady, user: privyUser } = usePrivy();
  const { wallets } = useWallets();
  const connectedWallet = wallets[0];
  // Solana wallets via Privy's standard wallet interface (detects Phantom, Backpack, etc.)
  const { wallets: solanaWallets } = useSolanaWallets();
  const { signAndSendTransaction: privySignAndSend } = useSignAndSendTransaction();
  const connectedSolanaWallet = solanaWallets[0] ?? null;

  const [prices, setPrices] = useState<bigint[]>(FALLBACK_PRICES);
  const [selectedPkg, setSelectedPkg] = useState(2); // default 7 days
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [status, setStatus] = useState<{ msg: string; type: "info" | "error" | "success" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedChain, setSelectedChain] = useState(DEFAULT_CHAIN);

  // Load prices on mount
  useEffect(() => {
    fetchPrices().then(setPrices);
  }, []);

  // Load user's projects + listen for auth changes
  useEffect(() => {
    const supabase = createClient();

    const loadProjects = (userId: string) => {
      supabase
        .from("projects")
        .select("id, title")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          setProjects(data || []);
          setLoadingProjects(false);
        });
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoadingProjects(false); return; }
      loadProjects(user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        setProjects([]);
        setSelectedProject("");
        setLoadingProjects(false);
      } else if (event === "SIGNED_IN" && session?.user) {
        loadProjects(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleConnectWallet() {
    if (!isLoggedIn) {
      window.location.href = "/auth/login?redirect=/&reason=promote";
      return;
    }
    // Filter the Privy wallet modal to the chain the user has selected, so
    // picking SOLANA surfaces Phantom/Backpack/Solflare first (and ONLY),
    // and picking BASE surfaces EVM wallets only. Both login() and
    // connectWallet() accept walletChainType for this purpose.
    const wantsSolana = isSolanaChain(getChainConfig(selectedChain));
    const walletChainType = wantsSolana ? "solana-only" : "ethereum-only";

    if (privyAuthenticated) {
      // Already have a Privy session but no wallet connected — use
      // connectWallet() instead of login() to avoid "already logged in" error.
      connectWallet({ walletChainType });
    } else {
      privyLogin({ walletChainType });
    }
  }

  async function handleDisconnectWallet() {
    await privyLogout();
  }

  async function handlePromoteEVM(project: UserProject, price: bigint, chainConfig: import("@/lib/chains-config").EVMChainConfig) {
    if (!connectedWallet) throw new Error("No EVM wallet connected");

    const provider = await connectedWallet.getEthereumProvider() as EthereumProvider;
    const walletAddr = connectedWallet.address.toLowerCase();

    setStatus({ msg: "Checking USDC allowance...", type: "info" });
    const allowanceData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [walletAddr as `0x${string}`, chainConfig.contractAddr as `0x${string}`],
    });
    const allowanceRes = await fetch(chainConfig.rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "eth_call",
        params: [{ to: chainConfig.usdcAddr, data: allowanceData }, "latest"],
      }),
    });
    const allowanceJson = await allowanceRes.json();
    const currentAllowance = BigInt(allowanceJson.result || "0x0");

    if (currentAllowance < price) {
      setStatus({ msg: `Approving $${(Number(price) / 1e6).toFixed(2)} USDC on ${chainConfig.name}...`, type: "info" });
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [chainConfig.contractAddr as `0x${string}`, price],
      });
      const approveTxHash = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: walletAddr, to: chainConfig.usdcAddr, data: approveData }],
      });
      setStatus({ msg: "Waiting for approval...", type: "info" });
      await waitForTx(approveTxHash as string, chainConfig.rpc);
    }

    setStatus({ msg: `Promoting "${project.title}" on ${chainConfig.name}...`, type: "info" });
    const promoteData = encodeFunctionData({
      abi: PROMOTE_ABI,
      functionName: "promote",
      args: [project.id, project.title, selectedPkg, price],
    });
    const txHash = await provider.request({
      method: "eth_sendTransaction",
      params: [{ from: walletAddr, to: chainConfig.contractAddr, data: promoteData }],
    });
    setStatus({ msg: "Waiting for confirmation...", type: "info" });
    await waitForTx(txHash as string, chainConfig.rpc);
  }

  async function handlePromoteSolana(project: UserProject, price: bigint, chainConfig: import("@/lib/chains-config").SolanaChainConfig) {
    if (!connectedSolanaWallet) throw new Error("No Solana wallet connected");

    setStatus({ msg: `Building USDC transfer on Solana...`, type: "info" });
    void project;

    const serializedTx = await buildSolanaUSDCTransfer({
      senderAddress: connectedSolanaWallet.address,
      rpcUrl: chainConfig.rpc,
      usdcMint: chainConfig.usdcMint,
      receivingWallet: chainConfig.receivingWallet,
      amount: price,
    });

    setStatus({ msg: `Sending $${(Number(price) / 1e6).toFixed(2)} USDC on Solana...`, type: "info" });

    // Use Privy's standard wallet interface (works with Phantom, Backpack, Solflare, etc.)
    const { signature } = await privySignAndSend({
      transaction: serializedTx,
      wallet: connectedSolanaWallet,
      chain: "solana:mainnet",
    });

    setStatus({ msg: `Confirming transaction...`, type: "info" });
    await confirmSolanaTransaction(chainConfig.rpc, signatureToString(signature));
  }

  async function handlePromote() {
    const project = projects.find((p) => p.id === selectedProject);
    if (!project) {
      setStatus({ msg: "Select a project first", type: "error" });
      return;
    }

    const chainConfig = getChainConfig(selectedChain);
    const isEVM = isEVMChain(chainConfig);
    const isSol = isSolanaChain(chainConfig);

    if (isEVM && !connectedWallet) {
      setStatus({ msg: "Connect an EVM wallet first", type: "error" });
      return;
    }
    if (isSol && !connectedSolanaWallet) {
      setStatus({ msg: "Connect a Solana wallet first", type: "error" });
      return;
    }

    const price = prices[selectedPkg];
    setBusy(true);

    try {
      if (isEVM) {
        await handlePromoteEVM(project, price, chainConfig);
      } else if (isSol) {
        await handlePromoteSolana(project, price, chainConfig);
      }

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
  const chainConfig = getChainConfig(selectedChain);
  const isSol = isSolanaChain(chainConfig);
  const hasWallet = isSol ? !!connectedSolanaWallet : !!connectedWallet;
  const walletDisplay = isSol
    ? connectedSolanaWallet ? shortAddr(connectedSolanaWallet.address) : ""
    : connectedWallet ? shortAddr(connectedWallet.address) : "";

  return (
    <div
      className="mt-8 p-6 max-w-xl"
      style={{
        border: "2px solid var(--border-hard)",
        boxShadow: "var(--shadow-brutal-sm)",
        backgroundColor: "var(--bg-surface)",
      }}
    >
      <h3 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">
        Feature Your Project
      </h3>

      {/* Chain selector */}
      <div className="mb-4">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
          Pay with USDC on
        </label>
        <div className="flex gap-2">
          {SUPPORTED_CHAINS.map(key => (
            <button
              key={key}
              onClick={() => setSelectedChain(key)}
              className="px-4 py-2 text-xs font-extrabold uppercase transition-all"
              style={{
                border: `2px solid ${selectedChain === key ? "var(--accent)" : "var(--border-hard)"}`,
                backgroundColor: selectedChain === key ? "var(--accent)" : "var(--bg-surface)",
                color: selectedChain === key ? "white" : "var(--foreground)",
                boxShadow: selectedChain === key ? "var(--shadow-brutal-xs)" : "none",
              }}
            >
              {CHAIN_LABELS[key] || key}
            </button>
          ))}
        </div>
      </div>

      {!privyReady ? (
        <p className="text-sm font-bold text-[var(--text-muted)] animate-pulse">Loading wallet...</p>
      ) : !isLoggedIn || !privyAuthenticated || !hasWallet ? (
        <button
          onClick={handleConnectWallet}
          className="btn-brutal btn-brutal-primary text-sm flex items-center gap-2"
        >
          <Wallet size={16} /> Connect {isSol ? "Solana" : "EVM"} Wallet
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-[var(--text-muted)] font-mono">
              Connected: {walletDisplay}
            </p>
            <button
              onClick={handleDisconnectWallet}
              className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Disconnect
            </button>
          </div>

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

async function waitForTx(txHash: string, rpcUrl: string = BASE_RPC, timeout = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const res = await fetch(rpcUrl, {
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
