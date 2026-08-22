import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

type TestNonceGlobalThis = typeof globalThis & {
  __vibe_wallet_nonce_store?: Map<string, unknown>;
};

// process.env.NODE_ENV is typed read-only, so the env is driven through
// vi.stubEnv and unwound with vi.unstubAllEnvs() rather than direct assignment.

// We need to test the local store helpers. Since they live in the same file as
// the shared exports, we import them directly.
import {
  NONCE_TTL_SECONDS,
  nonceKey,
  nonceMessage,
  SOLANA_ADDRESS_RE,
  BASE58_SIGNATURE_RE,
  WALLET_LINK_DOMAIN,
  localStoreNonce,
  localConsumeNonce,
  isLocalWalletNonceStoreEnabled,
} from "@/lib/wallet-link";

// ---------------------------------------------------------------------------
// nonceMessage
// ---------------------------------------------------------------------------
describe("nonceMessage", () => {
  it("includes the nonce verbatim", () => {
    const msg = nonceMessage("abc123");
    expect(msg).toContain("Nonce: abc123");
  });

  it("states that no transaction is approved", () => {
    const msg = nonceMessage("x");
    expect(msg).toContain("does not approve any transaction");
  });

  it("is multi-line", () => {
    expect(nonceMessage("n").split("\n").length).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// nonceKey
// ---------------------------------------------------------------------------
describe("nonceKey", () => {
  it("prefixes the user id", () => {
    expect(nonceKey("user-1")).toBe("wallet-nonce:user-1");
  });
});

// ---------------------------------------------------------------------------
// SOLANA_ADDRESS_RE
// ---------------------------------------------------------------------------
describe("SOLANA_ADDRESS_RE", () => {
  it("matches a valid 44-char base58 pubkey", () => {
    expect(
      SOLANA_ADDRESS_RE.test("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"),
    ).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(SOLANA_ADDRESS_RE.test("")).toBe(false);
  });

  it("rejects strings with invalid base58 characters", () => {
    expect(SOLANA_ADDRESS_RE.test("0invalid!")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isLocalWalletNonceStoreEnabled
// ---------------------------------------------------------------------------
describe("isLocalWalletNonceStoreEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is true when both NODE_ENV and VIBE_STAGING are set", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VIBE_STAGING", "1");
    expect(isLocalWalletNonceStoreEnabled()).toBe(true);
  });

  it("is false when NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VIBE_STAGING", "1");
    expect(isLocalWalletNonceStoreEnabled()).toBe(false);
  });

  it("is false when VIBE_STAGING is not set", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VIBE_STAGING", undefined);
    expect(isLocalWalletNonceStoreEnabled()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// localStoreNonce / localConsumeNonce
// ---------------------------------------------------------------------------
// These helpers only activate when isLocalWalletNonceStoreEnabled() is true,
// which requires NODE_ENV === 'development' AND VIBE_STAGING === '1'. We set
// both before each test and restore afterwards.

describe("local nonce store", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VIBE_STAGING", "1");
    // Reset the global store between tests so entries don't leak.
    delete (globalThis as TestNonceGlobalThis).__vibe_wallet_nonce_store;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (globalThis as TestNonceGlobalThis).__vibe_wallet_nonce_store;
    vi.restoreAllMocks();
  });

  it("stores and consumes a nonce exactly once", () => {
    const key = nonceKey("user-a");
    const stored = localStoreNonce(key, "nonce-1");
    expect(stored).toBe(true);

    const first = localConsumeNonce(key);
    expect(first).toBe("nonce-1");

    // Second consume returns null: single-use.
    const second = localConsumeNonce(key);
    expect(second).toBeNull();
  });

  it("returns null for an unknown key", () => {
    expect(localConsumeNonce(nonceKey("nobody"))).toBeNull();
  });

  it("returns null when not in local mode", () => {
    // Flip the env so isLocalWalletNonceStoreEnabled() is false.
    vi.stubEnv("NODE_ENV", "production");
    expect(localStoreNonce(nonceKey("u"), "n")).toBe(false);
    expect(localConsumeNonce(nonceKey("u"))).toBeNull();
  });

  it("creates the global Map on first store", () => {
    const global = globalThis as TestNonceGlobalThis;
    expect(global.__vibe_wallet_nonce_store).toBeUndefined();
    localStoreNonce(nonceKey("user-c"), "nonce-c");
    expect(global.__vibe_wallet_nonce_store).toBeInstanceOf(Map);
  });

  it("treats exact-expiry as expired (Date.now() === expiresAt returns null)", () => {
    const key = nonceKey("user-d");
    const base = 1_000_000_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(base);

    localStoreNonce(key, "exact");

    // Store set expiresAt = base + TTL. Freeze time exactly there.
    nowSpy.mockReturnValue(base + NONCE_TTL_SECONDS * 1000);
    expect(localConsumeNonce(key)).toBeNull();

    nowSpy.mockRestore();
  });
});

describe("nonceMessage: what the signer is shown", () => {
  it("names the site, so a wallet prompt can be checked against the address bar", () => {
    // Hardcoded rather than derived from a request header, which an attacker
    // controls. Someone reading the prompt should see where it came from.
    expect(nonceMessage("abc")).toContain(`Site: ${WALLET_LINK_DOMAIN}`);
    expect(WALLET_LINK_DOMAIN).toBe("vibetalent.work");
  });

  it("states how long the challenge is good for", () => {
    expect(nonceMessage("abc")).toContain("Valid for: 5 minutes");
  });

  it("still says it authorises nothing", () => {
    // A signature prompt is what a drainer looks like. The scope has to be
    // legible before anyone approves it.
    const msg = nonceMessage("abc");
    expect(msg).toContain("does not approve any transaction");
    expect(msg.toLowerCase()).toContain("proves you own the wallet");
  });

  it("changes with the nonce, so two challenges never share a signature", () => {
    expect(nonceMessage("one")).not.toBe(nonceMessage("two"));
  });
});

describe("BASE58_SIGNATURE_RE", () => {
  const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const sig = (n: number) =>
    Array.from({ length: n }, (_, i) => B58[i % B58.length]).join("");

  it("accepts the lengths a 64-byte ed25519 signature encodes to", () => {
    for (const n of [86, 87, 88])
      expect(BASE58_SIGNATURE_RE.test(sig(n))).toBe(true);
  });

  it("rejects input too short to be a signature", () => {
    // The old guard was `length < 64`, which reads like a byte count and let
    // anything above it through to the verifier.
    expect(BASE58_SIGNATURE_RE.test(sig(64))).toBe(false);
    expect(BASE58_SIGNATURE_RE.test("")).toBe(false);
  });

  it("rejects base58's excluded characters", () => {
    // 0, O, I and l are absent from the alphabet precisely to stop confusion.
    for (const c of ["0", "O", "I", "l"]) {
      expect(BASE58_SIGNATURE_RE.test(sig(85) + c)).toBe(false);
    }
  });
});
