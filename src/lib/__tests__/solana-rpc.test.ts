import { describe, it, expect, afterEach, vi } from "vitest";

import { solanaRpcUrl } from "@/lib/solana-rpc";
import { CHAIN_CONFIGS, isSolanaChain } from "@/lib/chains-config";

const solana = CHAIN_CONFIGS.solana;
const PUBLIC_DEFAULT = isSolanaChain(solana) ? solana.rpc : "";

describe("solanaRpcUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the public endpoint when SOLANA_RPC_URL is unset", () => {
    vi.stubEnv("SOLANA_RPC_URL", undefined);
    expect(solanaRpcUrl()).toBe(PUBLIC_DEFAULT);
  });

  it("prefers SOLANA_RPC_URL when it is set", () => {
    vi.stubEnv("SOLANA_RPC_URL", "https://example-rpc.test/?api-key=abc");
    expect(solanaRpcUrl()).toBe("https://example-rpc.test/?api-key=abc");
  });

  it("trims surrounding whitespace", () => {
    vi.stubEnv("SOLANA_RPC_URL", "  https://example-rpc.test  ");
    expect(solanaRpcUrl()).toBe("https://example-rpc.test");
  });

  it("treats a blank value as unset rather than returning an empty URL", () => {
    vi.stubEnv("SOLANA_RPC_URL", "   ");
    expect(solanaRpcUrl()).toBe(PUBLIC_DEFAULT);
  });

  // The point of the helper: Workers bind the environment per request, so a
  // value captured at module scope would be frozen for the isolate's lifetime.
  it("re-reads the environment on every call", () => {
    vi.stubEnv("SOLANA_RPC_URL", undefined);
    expect(solanaRpcUrl()).toBe(PUBLIC_DEFAULT);

    vi.stubEnv("SOLANA_RPC_URL", "https://later-bound.test");
    expect(solanaRpcUrl()).toBe("https://later-bound.test");
  });

  it("never returns an empty string while Solana is configured", () => {
    vi.stubEnv("SOLANA_RPC_URL", undefined);
    expect(solanaRpcUrl().length).toBeGreaterThan(0);
  });
});
