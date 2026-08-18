// Server-side Solana RPC endpoint.
//
// Solana's public endpoint — the CHAIN_CONFIGS default — refuses traffic from
// datacenter IPs, which is exactly what a Cloudflare Worker is. Every server
// call therefore failed in production: `fetchVibeBalance` returned null so
// holder balances read as zero, /token showed no supply, and the burn
// preflight 503'd on every attempt, meaning a burn could never be signed.
//
// SOLANA_RPC_URL points those calls at a provider that actually answers.
// Unset, this falls back to the public endpoint, so local development and
// tests keep working with no configuration.

import { CHAIN_CONFIGS, isSolanaChain } from "@/lib/chains-config";

function publicFallback(): string {
  const solana = CHAIN_CONFIGS.solana;
  return isSolanaChain(solana) ? solana.rpc : "";
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The Solana JSON-RPC endpoint for server-side calls.
 *
 * Read at call time rather than module scope: on Workers the environment is
 * bound per request, so a module-level read can execute before the value
 * exists and would cache an empty string for the life of the isolate.
 *
 * Server-only by design. Provider URLs carry the API key in the path, so this
 * must never reach the browser bundle — client code keeps using the public
 * endpoint from CHAIN_CONFIGS, which works from a residential IP.
 */
export function solanaRpcUrl(): string {
  const configured = process.env.SOLANA_RPC_URL?.trim();

  if (configured) {
    if (isHttpUrl(configured)) return configured;

    // Pasting the bare API key is the easy mistake: providers show the key and
    // the endpoint as separate fields. `fetch()` would throw on it and the
    // caller would report the same opaque "Solana unavailable" 503 this
    // variable exists to fix, so name the misconfiguration instead of
    // failing over in silence.
    console.error(
      "SOLANA_RPC_URL is set but is not an http(s) URL, so it was ignored. " +
        "Expected the provider's full endpoint, e.g. " +
        "https://mainnet.helius-rpc.com/?api-key=<key> — not the key alone.",
    );
  }

  return publicFallback();
}
