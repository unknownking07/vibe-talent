import { describe, it, expect } from "vitest";
import {
  expectedTokenAmount,
  passesSlippage,
  expiresAtFor,
  isValidPackageId,
  pickReceivedDelta,
  extractMemos,
} from "../promotion-pricing";

describe("expectedTokenAmount", () => {
  it("returns the USDC base units unchanged for USDC", () => {
    expect(expectedTokenAmount(BigInt(10_000_000), "usdc", 0)).toBe(BigInt(10_000_000));
  });

  it("converts USD to $VIBE base units via the price", () => {
    // $5 at $0.000005/token = 1,000,000 $VIBE = 1e15 base units (9 decimals)
    expect(expectedTokenAmount(BigInt(5_000_000), "vibe", 0.000005)).toBe(
      BigInt(1_000_000_000_000_000)
    );
  });

  it("throws when the $VIBE price is missing or non-positive", () => {
    expect(() => expectedTokenAmount(BigInt(5_000_000), "vibe", 0)).toThrow();
    expect(() => expectedTokenAmount(BigInt(5_000_000), "vibe", -1)).toThrow();
  });
});

describe("passesSlippage", () => {
  it("accepts payment exactly at the 90% floor", () => {
    expect(passesSlippage(BigInt(900), BigInt(1000))).toBe(true);
  });
  it("accepts overpayment", () => {
    expect(passesSlippage(BigInt(1500), BigInt(1000))).toBe(true);
  });
  it("rejects payment below the floor", () => {
    expect(passesSlippage(BigInt(899), BigInt(1000))).toBe(false);
  });
  it("respects a custom floor", () => {
    expect(passesSlippage(BigInt(949), BigInt(1000), 9500)).toBe(false);
    expect(passesSlippage(BigInt(950), BigInt(1000), 9500)).toBe(true);
  });
});

describe("expiresAtFor", () => {
  const now = 1_700_000_000_000;
  it("computes a future expiry for timed packages", () => {
    expect(new Date(expiresAtFor(2, now)!).getTime() - now).toBe(7 * 86_400_000);
    expect(new Date(expiresAtFor(3, now)!).getTime() - now).toBe(30 * 86_400_000);
  });
  it("returns null (lifetime) for the Annual package", () => {
    expect(expiresAtFor(4, now)).toBeNull();
  });
});

describe("isValidPackageId", () => {
  it("accepts 0..4 and rejects others", () => {
    expect([0, 1, 2, 3, 4].every(isValidPackageId)).toBe(true);
    expect(isValidPackageId(5)).toBe(false);
    expect(isValidPackageId(-1)).toBe(false);
  });
});

describe("pickReceivedDelta", () => {
  const R = "ReceivingOwner";
  const M = "MintAddr";
  const bal = (owner: string, mint: string, amount: string) => ({
    owner,
    mint,
    uiTokenAmount: { amount },
  });

  it("computes the net delta for the receiving owner + mint", () => {
    expect(pickReceivedDelta([bal(R, M, "100")], [bal(R, M, "600")], R, M)).toBe(BigInt(500));
  });

  it("treats a freshly-created ATA (no pre entry) as 0", () => {
    expect(pickReceivedDelta([], [bal(R, M, "500")], R, M)).toBe(BigInt(500));
  });

  it("ignores other owners and other mints", () => {
    const pre = [bal(R, M, "0")];
    const post = [bal(R, M, "500"), bal("someoneElse", M, "999"), bal(R, "OtherMint", "999")];
    expect(pickReceivedDelta(pre, post, R, M)).toBe(BigInt(500));
  });
});

describe("extractMemos", () => {
  const memo = (text: string) => ({
    program: "spl-memo",
    programId: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
    parsed: text,
  });

  it("returns memo text from spl-memo instructions", () => {
    expect(extractMemos([memo("proj-123"), { program: "system", parsed: {} }])).toEqual([
      "proj-123",
    ]);
  });

  it("ignores non-memo instructions and empty memos", () => {
    expect(extractMemos([{ program: "spl-token", parsed: {} }, memo("")])).toEqual([]);
  });

  it("handles an empty instruction list", () => {
    expect(extractMemos([])).toEqual([]);
  });
});
