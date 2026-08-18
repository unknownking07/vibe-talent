import { describe, it, expect, afterEach, vi } from "vitest";

import { solanaRpcUrl } from "@/lib/solana-rpc";
import { CHAIN_CONFIGS, isSolanaChain } from "@/lib/chains-config";

const solana = CHAIN_CONFIGS.solana;
const PUBLIC_DEFAULT = isSolanaChain(solana) ? solana.rpc : "";

describe("solanaRpcUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
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

  // Regression: the first real deploy set this to the bare Helius API key
  // rather than the endpoint URL. fetch() threw on it and every caller
  // reported the same opaque 503 the variable was added to fix.
  it("ignores a bare API key and falls back, rather than returning it", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("SOLANA_RPC_URL", "77046988-b68d-41c2-9570-013c70abcdef");

    expect(solanaRpcUrl()).toBe(PUBLIC_DEFAULT);
    expect(err).toHaveBeenCalledOnce();
  });

  it("ignores any non-http scheme", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("SOLANA_RPC_URL", "ftp://example-rpc.test");

    expect(solanaRpcUrl()).toBe(PUBLIC_DEFAULT);
    expect(err).toHaveBeenCalledOnce();
  });

  it("accepts a plain http endpoint for local validators", () => {
    vi.stubEnv("SOLANA_RPC_URL", "http://127.0.0.1:8899");
    expect(solanaRpcUrl()).toBe("http://127.0.0.1:8899");
  });

  it("never returns an empty string while Solana is configured", () => {
    vi.stubEnv("SOLANA_RPC_URL", undefined);
    expect(solanaRpcUrl().length).toBeGreaterThan(0);
  });
});
