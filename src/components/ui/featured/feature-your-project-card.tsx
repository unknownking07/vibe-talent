"use client";

import { useState, useEffect, forwardRef } from "react";
import { Wallet, Loader2, Check } from "lucide-react";
import { encodeFunctionData, parseAbi } from "viem";
import { createClient } from "@/lib/supabase/client";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useWallets as useSolanaWallets, useSignAndSendTransaction } from "@privy-io/react-auth/solana";
import {
  CHAIN_CONFIGS,
  SUPPORTED_CHAINS,
  DEFAULT_CHAIN,
  getChainConfig,
  isEVMChain,
  isSolanaChain,
  type EVMChainConfig,
  type SolanaChainConfig,
} from "@/lib/chains-config";
import { buildSolanaUSDCTransfer, confirmSolanaTransaction, signatureToString } from "@/lib/solana-payment";
import { ChainDot, type ChainKey } from "./chain-dot";

const BASE_CONFIG = CHAIN_CONFIGS.base;
const CONTRACT_ADDR = isEVMChain(BASE_CONFIG) ? BASE_CONFIG.contractAddr : "";
const BASE_RPC = isEVMChain(BASE_CONFIG) ? BASE_CONFIG.rpc : "";

const PRIVY_CONFIGURED = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;

const SEL = { getPrices: "0xbd9a548b" };

// User-facing tiers. `value` is the contract package ID (uint8) which selects
// the on-chain duration: 0=1d, 1=3d (hidden), 2=7d, 3=30d, 4=Lifetime.
// "Annual" maps to package 4 — the slot persists indefinitely until a contract
// upgrade or removal. Frontend prices below are FALLBACKS only; the contract's
// actual on-chain prices govern what users pay (admin sets via setPrices).
const PACKAGES = [
  { label: "Day", value: 0 },
  { label: "Week", value: 2 },
  { label: "Month", value: 3 },
  { label: "Annual", value: 4 },
] as const;

// Contract enforces monotonically-increasing prices in setPrices(), so the
// hidden 3-day slot has to fit the curve even though we don't surface it.
const FALLBACK_PRICES: bigint[] = [
  BigInt(2_000_000),    // 0: Day        = $2.00
  BigInt(5_000_000),    // 1: 3-day      = $5.00 (hidden in UI; sits between Day and Week)
  BigInt(10_000_000),   // 2: Week       = $10.00  (29% off /day)
  BigInt(29_000_000),   // 3: Month      = $29.00  (52% off /day — best value)
  BigInt(199_000_000),  // 4: Annual     = $199.00 (73% off /day; contract = Lifetime)
];

const PROMOTE_ABI = parseAbi([
  "function promote(string projectId, string projectName, uint8 package_, uint256 maxPrice)",
]);

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

function shortAddr(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
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
    if (!json.result || typeof json.result !== "string") return FALLBACK_PRICES;
    const data = json.result.startsWith("0x") ? json.result.slice(2) : json.result;
    // Need 5 × 32-byte slots (320 hex chars) — anything shorter means the RPC
    // returned a truncated/error payload, not a valid getPrices() result.
    if (data.length < 5 * 64) return FALLBACK_PRICES;
    const prices: bigint[] = [];
    for (let i = 0; i < 5; i++) {
      prices.push(BigInt("0x" + data.slice(i * 64, i * 64 + 64)));
    }
    return prices;
  } catch {
    return FALLBACK_PRICES;
  }
}

async function waitForTx(txHash: string, rpcUrl: string = BASE_RPC, timeout = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
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

type UserProject = { id: string; title: string };

type Props = { onSuccess: () => void; isLoggedIn: boolean };

export const FeatureYourProjectCard = forwardRef<HTMLDivElement, Props>(function FeatureYourProjectCard(
  { onSuccess, isLoggedIn },
  ref,
) {
  if (!PRIVY_CONFIGURED) {
    return (
      <div
        ref={ref}
        tabIndex={-1}
        className="card-brutal relative p-6 flex flex-col md:min-h-[420px] overflow-hidden focus:outline-none"
        style={{ backgroundColor: "var(--bg-surface)" }}
      >
        <h3 className="text-2xl font-extrabold uppercase leading-tight">
          <span className="block text-[var(--foreground)]">Feature</span>
          <span className="block" style={{ color: "var(--accent)" }}>Your Project</span>
        </h3>
        {process.env.NODE_ENV !== "production" ? (
          <div
            className="mt-6 p-4 text-xs font-medium"
            style={{
              border: "2px dashed var(--border-hard)",
              color: "var(--text-secondary)",
              backgroundColor: "var(--bg-surface-light)",
            }}
          >
            <strong className="uppercase text-[var(--foreground)]">Promote form disabled.</strong>
            <span className="block mt-1">
              Set <code>NEXT_PUBLIC_PRIVY_APP_ID</code> in <code>.env.local</code> to enable wallet-based promotions.
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  return <FeatureCardBody ref={ref} onSuccess={onSuccess} isLoggedIn={isLoggedIn} />;
});

const FeatureCardBody = forwardRef<HTMLDivElement, Props>(function FeatureCardBody(
  { onSuccess, isLoggedIn },
  ref,
) {
  const {
    login: privyLogin,
    logout: privyLogout,
    connectWallet,
    authenticated: privyAuthenticated,
    ready: privyReady,
  } = usePrivy();
  const { wallets } = useWallets();
  const connectedWallet = wallets[0];
  const { wallets: solanaWallets } = useSolanaWallets();
  const { signAndSendTransaction: privySignAndSend } = useSignAndSendTransaction();
  const connectedSolanaWallet = solanaWallets[0] ?? null;

  const [prices, setPrices] = useState<bigint[]>(FALLBACK_PRICES);
  const [selectedPkg, setSelectedPkg] = useState(2);
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [status, setStatus] = useState<{ msg: string; type: "info" | "error" | "success" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedChain, setSelectedChain] = useState<ChainKey>(DEFAULT_CHAIN as ChainKey);

  useEffect(() => {
    fetchPrices().then(setPrices);
  }, []);

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
      if (!user) {
        setLoadingProjects(false);
        return;
      }
      loadProjects(user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
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
    const wantsSolana = isSolanaChain(getChainConfig(selectedChain));
    const walletChainType = wantsSolana ? "solana-only" : "ethereum-only";
    if (privyAuthenticated) {
      connectWallet({ walletChainType });
    } else {
      privyLogin({ walletChainType });
    }
  }

  async function handleDisconnectWallet() {
    await privyLogout();
  }

  async function handlePromoteEVM(project: UserProject, price: bigint, chainConfig: EVMChainConfig) {
    if (!connectedWallet) throw new Error("No EVM wallet connected");
    const provider = (await connectedWallet.getEthereumProvider()) as EthereumProvider;
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
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
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

  async function handlePromoteSolana(project: UserProject, price: bigint, chainConfig: SolanaChainConfig) {
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
      if (isEVM) await handlePromoteEVM(project, price, chainConfig);
      else if (isSol) await handlePromoteSolana(project, price, chainConfig);

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

  const isExpanded = privyReady && isLoggedIn && privyAuthenticated && hasWallet;
  // `prices[0]` is the per-day floor — used as the "From $X/day" label.
  // If admin reorders packages someday, this assumption breaks.
  const fromPerDay = `$${(Number(prices[0]) / 1e6).toFixed(2)}`;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="card-brutal relative p-6 flex flex-col md:min-h-[420px] overflow-hidden focus:outline-none"
      style={{ backgroundColor: "var(--bg-surface)" }}
    >
      <h3 className="text-2xl font-extrabold uppercase leading-tight">
        <span className="block text-[var(--foreground)]">Feature</span>
        <span className="block" style={{ color: "var(--accent)" }}>Your Project</span>
      </h3>
      <p className="mt-3 text-xs text-[var(--text-secondary)] leading-relaxed">
        Founders are scouting VibeTalent for talented devs. Featured projects land top of the marketplace — exactly where they&apos;re looking.
      </p>

      <div className="mt-5 flex-1 flex flex-col">
        {!isExpanded ? (
          <>
            {/* Idle stage */}
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Pay with USDC on
              </label>
              <span
                className="font-mono text-[10px] font-bold px-2 py-0.5"
                style={{ border: "1px solid var(--accent)", color: "var(--accent)" }}
              >
                From {fromPerDay}/day
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {SUPPORTED_CHAINS.map((key) => {
                const isActive = selectedChain === key;
                const chainKey = key as ChainKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedChain(chainKey)}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-extrabold uppercase transition-all"
                    style={{
                      border: `2px solid ${isActive ? "var(--accent)" : "var(--border-hard)"}`,
                      backgroundColor: isActive
                        ? "color-mix(in srgb, var(--accent) 14%, var(--bg-surface))"
                        : "var(--bg-surface)",
                      color: "var(--foreground)",
                      boxShadow: isActive ? "var(--shadow-brutal-xs)" : "none",
                    }}
                    aria-pressed={isActive}
                  >
                    <ChainDot chain={chainKey} />
                    <span>{chainKey === "base" ? "Base" : "Solana"}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1" />

            {!privyReady ? (
              <p className="text-xs font-bold text-[var(--text-muted)] animate-pulse text-center py-2">
                Loading wallet...
              </p>
            ) : (
              <button
                type="button"
                onClick={handleConnectWallet}
                className="btn-brutal btn-brutal-primary btn-notched w-full text-sm flex items-center justify-center gap-2"
              >
                <Wallet size={16} /> Connect {isSol ? "Solana" : "EVM"} Wallet
              </button>
            )}

            <a
              href="/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 text-center text-[10px] font-bold uppercase underline underline-offset-4 hover:opacity-80 transition-opacity"
              style={{ color: "var(--accent)" }}
            >
              View Pricing &amp; Guidelines
            </a>
          </>
        ) : (
          <>
            {/* Expanded stage */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono truncate">
                {walletDisplay}
              </span>
              <button
                type="button"
                onClick={handleDisconnectWallet}
                className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Disconnect
              </button>
            </div>

            <div className="mb-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Project
              </label>
              {loadingProjects ? (
                <p className="text-xs text-[var(--text-muted)] animate-pulse">Loading projects...</p>
              ) : projects.length === 0 ? (
                <div
                  className="p-3 text-center"
                  style={{ border: "2px solid var(--border-hard)", backgroundColor: "var(--background)" }}
                >
                  <p className="text-xs font-bold text-[var(--text-muted)] mb-2">No projects yet</p>
                  <a href="/dashboard" className="btn-brutal btn-brutal-primary text-[10px] inline-flex items-center gap-1">
                    Add a Project
                  </a>
                </div>
              ) : (
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium"
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

            <div className="mb-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Package
              </label>
              <div className="flex flex-col gap-1.5">
                {PACKAGES.map((pkg) => {
                  const isActive = selectedPkg === pkg.value;
                  return (
                    <button
                      key={pkg.value}
                      type="button"
                      onClick={() => setSelectedPkg(pkg.value)}
                      className="flex items-center justify-between px-3 py-2 transition-colors"
                      style={{
                        border: `2px solid ${isActive ? "var(--accent)" : "var(--border-hard)"}`,
                        backgroundColor: isActive
                          ? "color-mix(in srgb, var(--accent) 14%, var(--bg-surface))"
                          : "var(--bg-surface)",
                      }}
                      aria-pressed={isActive}
                    >
                      <span className="text-xs font-extrabold uppercase text-[var(--foreground)]">{pkg.label}</span>
                      <span className="font-mono text-[11px] font-bold text-[var(--foreground)]">
                        ${(Number(prices[pkg.value]) / 1e6).toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {status && (
              <div
                className="mb-3 px-3 py-2 text-[11px] font-bold uppercase"
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
              type="button"
              onClick={handlePromote}
              disabled={busy || !hasProject}
              className="btn-brutal btn-brutal-primary btn-notched w-full text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Processing...
                </>
              ) : (
                <>
                  <Check size={16} /> Approve {priceStr} &amp; Promote
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Decorative progress bar */}
      <div
        className="absolute bottom-0 left-0 h-1"
        style={{ width: "60%", backgroundColor: "var(--accent)" }}
        aria-hidden="true"
      />
    </div>
  );
});
