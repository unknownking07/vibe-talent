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
  if (configured) return configured;

  const solana = CHAIN_CONFIGS.solana;
  return isSolanaChain(solana) ? solana.rpc : "";
}
