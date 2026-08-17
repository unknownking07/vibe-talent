"use client";

import { useState, useCallback } from "react";
import {
  useWallets as useSolanaWallets,
  useSignAndSendTransaction,
} from "@privy-io/react-auth/solana";
import { CHAIN_CONFIGS, isSolanaChain } from "@/lib/chains-config";
import { buildSolanaTokenBurn, signatureToString } from "@/lib/solana-payment";
import { buildBurnMemo, type BurnAction } from "@/lib/vibe-burn";
import { insufficientVibeMessage, friendlyBurnError } from "@/lib/burn-errors";

export type BurnStatus = { msg: string; type: "info" | "error" | "success" } | null;

export type BurnQuote = { amount: bigint; wholeTokens: number; usd: number };

const SOLANA_UNAVAILABLE =
  "Solana is temporarily unavailable. Your tokens were not burned. Please try again.";

class UserFacingBurnError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseBaseUnits(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

/**
 * The shared burn flow: quote → preflight → build → sign → verify server-side.
 *
 * Both burn features run exactly this sequence, so keeping it in one place
 * means the retry policy and the memo binding can't drift between them.
 */
export function useBurnFlow() {
  const { wallets } = useSolanaWallets();
  const wallet = wallets[0] ?? null;
  const { signAndSendTransaction } = useSignAndSendTransaction();

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<BurnStatus>(null);
  const [signature, setSignature] = useState<string | null>(null);

  /** Ask the server what `usd` is worth in $VIBE right now. */
  const quote = useCallback(async (usd: number): Promise<BurnQuote> => {
    const res = await fetch(`/api/vibe/quote?usd=${encodeURIComponent(usd)}`);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || "Couldn't price $VIBE right now.");
    }
    const q = await res.json();
    return { amount: BigInt(q.amount), wholeTokens: q.wholeTokens, usd: q.usd };
  }, []);

  /**
   * Burn `amount` base units bound to `action`, then POST the signature to
   * `endpoint` for verification.
   *
   * Retries only 404 and 503 — the transaction may not have propagated yet, or
   * an RPC hiccuped. Anything else is surfaced immediately, because the tokens
   * are already gone and the user needs to know why it didn't count.
   */
  const burn = useCallback(
    async (opts: {
      action: BurnAction;
      amount: bigint;
      endpoint: string;
      body: Record<string, unknown>;
    }): Promise<{ signature: string; result: unknown }> => {
      const solana = CHAIN_CONFIGS.solana;
      if (!isSolanaChain(solana)) throw new Error("Solana is not configured.");
      if (!wallet) throw new Error("Connect a Solana wallet first.");

      setBusy(true);
      setSignature(null);
      let broadcastSignature: string | null = null;

      try {
        setStatus({ msg: "Checking your $VIBE balance...", type: "info" });

        let preflightRes: Response;
        try {
          preflightRes = await fetch("/api/vibe/preflight", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet: wallet.address, amount: opts.amount.toString() }),
          });
        } catch {
          throw new UserFacingBurnError(SOLANA_UNAVAILABLE);
        }

        let preflight: unknown;
        try {
          preflight = await preflightRes.json();
        } catch {
          throw new UserFacingBurnError(SOLANA_UNAVAILABLE);
        }

        if (!isRecord(preflight)) {
          throw new UserFacingBurnError(SOLANA_UNAVAILABLE);
        }

        if (!preflightRes.ok) {
          if (
            preflightRes.status === 409 &&
            preflight.code === "INSUFFICIENT_VIBE"
          ) {
            const required = parseBaseUnits(preflight.required);
            const available = parseBaseUnits(preflight.available);
            if (required !== null && available !== null) {
              throw new UserFacingBurnError(
                insufficientVibeMessage(required, available, solana.vibeDecimals),
              );
            }
          }
          throw new UserFacingBurnError(SOLANA_UNAVAILABLE);
        }

        if (
          preflight.ok !== true ||
          typeof preflight.blockhash !== "string" ||
          preflight.blockhash.length === 0
        ) {
          throw new UserFacingBurnError(SOLANA_UNAVAILABLE);
        }

        setStatus({ msg: "Building the burn...", type: "info" });
        const serialized = await buildSolanaTokenBurn({
          senderAddress: wallet.address,
          mint: solana.vibeMint,
          decimals: solana.vibeDecimals,
          amount: opts.amount,
          memo: buildBurnMemo(opts.action),
          recentBlockhash: preflight.blockhash,
        });

        setStatus({ msg: "Confirm in your wallet...", type: "info" });
        const { signature: sigBytes } = await signAndSendTransaction({
          transaction: serialized,
          wallet,
          chain: "solana:mainnet",
        });
        broadcastSignature =
          typeof sigBytes === "string" ? sigBytes : signatureToString(sigBytes);
        setSignature(broadcastSignature);

        setStatus({ msg: "Verifying the burn...", type: "info" });
        for (let attempt = 0; attempt < 6; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 2500));
          const res = await fetch(opts.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...opts.body, signature: broadcastSignature }),
          });
          if (res.ok) {
            return { signature: broadcastSignature, result: await res.json() };
          }
          if (res.status !== 404 && res.status !== 503) {
            const payload: unknown = await res.json().catch(() => null);
            const message =
              isRecord(payload) && typeof payload.error === "string"
                ? payload.error
                : "That burn couldn't be verified.";
            throw new UserFacingBurnError(message);
          }
        }

        throw new UserFacingBurnError(
          "Your $VIBE was burned, but the network hasn't confirmed it yet. It'll count once it finalizes.",
        );
      } catch (error) {
        if (error instanceof UserFacingBurnError) throw error;
        if (broadcastSignature === null) {
          throw new Error(friendlyBurnError(error));
        }
        throw new Error(
          "Your $VIBE was burned, but verification could not complete yet. It will count once the network catches up.",
        );
      } finally {
        setBusy(false);
      }
    },
    [wallet, signAndSendTransaction],
  );

  return { wallet, busy, status, setStatus, signature, quote, burn };
}
