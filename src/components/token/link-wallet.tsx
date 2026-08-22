"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import {
  useWallets as useSolanaWallets,
  useSignMessage,
} from "@privy-io/react-auth/solana";
import {
  Wallet,
  CircleNotch,
  SealCheck,
  LinkBreak,
} from "@phosphor-icons/react";
import { signatureToString } from "@/lib/solana-payment";
import { formatTokenCount } from "@/lib/token-stats";
import { HOLDER_TIERS, BASE_FREEZES } from "@/lib/vibe-config";
import { BurnProvider, PRIVY_CONFIGURED } from "./burn-provider";
import { VerifyByTransfer } from "./verify-by-transfer";

function shortAddr(a: string) {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

type Linked = {
  address: string;
  balance: number;
  usd: number;
  freezes: number;
} | null;

export function LinkWallet({
  initialAddress,
}: {
  initialAddress: string | null;
}) {
  if (!PRIVY_CONFIGURED) {
    return (
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Wallet linking is unavailable because NEXT_PUBLIC_PRIVY_APP_ID is not
        set.
      </p>
    );
  }
  return (
    <BurnProvider>
      <LinkWalletBody initialAddress={initialAddress} />
    </BurnProvider>
  );
}

function LinkWalletBody({ initialAddress }: { initialAddress: string | null }) {
  const { login, authenticated, ready, connectWallet } = usePrivy();
  const { wallets } = useSolanaWallets();
  const { signMessage } = useSignMessage();
  const connected = wallets[0] ?? null;

  const [linked, setLinked] = useState<Linked>(
    initialAddress
      ? { address: initialAddress, balance: 0, usd: 0, freezes: BASE_FREEZES }
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet/balance", { method: "POST" });
      if (!res.ok) return;
      const d = await res.json();
      setLinked((prev) =>
        prev
          ? {
              ...prev,
              balance: d.wholeTokens ?? 0,
              usd: d.usd ?? 0,
              freezes: d.freezes ?? BASE_FREEZES,
            }
          : prev,
      );
    } catch {
      // Balance is decoration here; the tier that counts is granted monthly.
    }
  }, []);

  useEffect(() => {
    if (linked) refreshBalance();
    // Only on mount / after a link — not on every balance state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked?.address]);

  async function handleLink() {
    if (!connected) {
      if (authenticated) connectWallet({ walletChainType: "solana-only" });
      else login({ walletChainType: "solana-only" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const nonceRes = await fetch("/api/wallet/nonce");
      if (!nonceRes.ok) {
        const e = await nonceRes.json().catch(() => ({}));
        throw new Error(
          e.error || `Couldn't start wallet linking (HTTP ${nonceRes.status}).`,
        );
      }
      const parsed: unknown = await nonceRes.json();
      const message =
        typeof parsed === "object" && parsed !== null
          ? (parsed as Record<string, unknown>).message
          : undefined;
      if (typeof message !== "string" || message.length === 0) {
        throw new Error(
          "The server returned a malformed wallet-linking nonce.",
        );
      }

      const { signature } = await signMessage({
        message: new TextEncoder().encode(message),
        wallet: connected,
      });
      const sig =
        typeof signature === "string"
          ? signature
          : signatureToString(signature);

      const linkRes = await fetch("/api/wallet/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: connected.address, signature: sig }),
      });
      if (!linkRes.ok) {
        const e = await linkRes.json().catch(() => ({}));
        throw new Error(
          e.error || `Couldn't link that wallet (HTTP ${linkRes.status}).`,
        );
      }
      setLinked({
        address: connected.address,
        balance: 0,
        usd: 0,
        freezes: BASE_FREEZES,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't link that wallet.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlink() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/link", { method: "DELETE" });
      if (!res.ok)
        throw new Error(`Couldn't unlink that wallet (HTTP ${res.status}).`);
      setLinked(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't unlink that wallet.");
    } finally {
      setBusy(false);
    }
  }

  const topTier = HOLDER_TIERS[0];
  const nextTier = linked
    ? HOLDER_TIERS.slice()
        .reverse()
        .find((t) => linked.usd < t.minUsd)
    : null;

  if (linked) {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <SealCheck
            weight="fill"
            size={16}
            style={{ color: "var(--accent)" }}
            aria-hidden="true"
          />
          <code className="font-mono text-xs font-bold text-[var(--foreground)]">
            {shortAddr(linked.address)}
          </code>
          <button
            type="button"
            onClick={handleUnlink}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide cursor-pointer hover:opacity-70 disabled:opacity-50"
            style={{ color: "var(--text-muted)" }}
          >
            <LinkBreak size={12} aria-hidden="true" /> Unlink
          </button>
        </div>

        <p
          className="mt-2 text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Holding{" "}
          <strong className="font-mono text-[var(--foreground)]">
            {formatTokenCount(linked.balance)} $VIBE
          </strong>{" "}
          (~${linked.usd.toFixed(2)}) · {linked.freezes} free streak freezes a
          month
        </p>

        {nextTier ? (
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Hold ${nextTier.minUsd} to reach {nextTier.label} and get{" "}
            {nextTier.freezes}.
          </p>
        ) : (
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            You&apos;re at the top tier ({topTier.label}).
          </p>
        )}

        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          Want to vouch for someone? Go to their profile and hit{" "}
          <strong>Back this builder</strong>.{" "}
          <Link href="/explore" style={{ textDecoration: "underline" }}>
            Find a builder to back
          </Link>
        </p>

        {error && (
          <p
            role="alert"
            className="mt-2 text-xs font-bold"
            style={{ color: "var(--status-error-text)" }}
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p
        className="text-xs font-medium mb-3"
        style={{ color: "var(--text-secondary)" }}
      >
        Link a Solana wallet to earn extra free streak freezes for holding
        $VIBE. Linking is optional: you can still vouch for other builders
        without it. Signing proves ownership; it does not approve any
        transaction.
      </p>
      <button
        type="button"
        onClick={handleLink}
        disabled={busy || !ready}
        className="btn-brutal btn-brutal-primary btn-notched text-sm inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
      >
        {busy ? (
          <>
            <CircleNotch
              size={16}
              className="animate-spin"
              aria-hidden="true"
            />{" "}
            Linking...
          </>
        ) : (
          <>
            <Wallet size={16} aria-hidden="true" />{" "}
            {connected ? "Verify ownership" : "Connect Solana wallet"}
          </>
        )}
      </button>
      <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
        Vouching is done from another builder&apos;s profile: hit{" "}
        <strong>Back this builder</strong>.{" "}
        <Link href="/explore" style={{ textDecoration: "underline" }}>
          Find a builder to back
        </Link>
      </p>
      {error && (
        <p
          role="alert"
          className="mt-2 text-xs font-bold"
          style={{ color: "var(--status-error-text)" }}
        >
          {error}
        </p>
      )}
      {/* Second option, deliberately below the primary one: broadcasting a
          transaction is the riskier of the two operations, so connect-and-sign
          stays the recommendation and this is for people who decline it. */}
      <VerifyByTransfer
        onLinked={(address) =>
          setLinked({ address, balance: 0, usd: 0, freezes: BASE_FREEZES })
        }
      />
    </div>
  );
}
