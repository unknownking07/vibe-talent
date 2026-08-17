import { describe, it, expect } from "vitest";
import {
  expectedTokenAmount,
  passesSlippage,
  expiresAtFor,
  isValidPackageId,
  pickReceivedDelta,
  extractMemos,
  pickPriceFromPools,
  extractSimplePrice,
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

// ── pickPriceFromPools unit tests ──

const MINT = "777";

function pool(
  baseId: string,
  quoteId: string,
  basePrice: number | string | null,
  quotePrice: number | string | null,
  reserve: unknown,
) {
  return {
    attributes: {
      base_token_price_usd: basePrice,
      quote_token_price_usd: quotePrice,
      reserve_in_usd: reserve,
    },
    relationships: {
      base_token: { data: { id: baseId } },
      quote_token: { data: { id: quoteId } },
    },
  };
}

function payload(pools: unknown[]) {
  return { data: pools };
}

describe("pickPriceFromPools", () => {
  it("returns the price when the target is the base token", () => {
    const json = payload([pool(`solana_${MINT}`, "solana_other", 0.0042, 238.09, 5000)]);
    expect(pickPriceFromPools(json, MINT)).toBe(0.0042);
  });

  it("returns the price when the target is the quote token", () => {
    const json = payload([pool("solana_other", `solana_${MINT}`, 238.09, 0.0042, 5000)]);
    expect(pickPriceFromPools(json, MINT)).toBe(0.0042);
  });

  it("selects the highest-reserve valid pool", () => {
    const json = payload([
      pool(`solana_${MINT}`, "solana_a", 0.001, 1000, 100),
      pool(`solana_${MINT}`, "solana_b", 0.0042, 238.09, 9000),
    ]);
    expect(pickPriceFromPools(json, MINT)).toBe(0.0042);
  });

  it("ignores pools unrelated to the target mint", () => {
    const json = payload([
      pool("solana_x", "solana_y", 0.001, 1000, 5000),
      pool("solana_z", "solana_w", 0.009, 111.11, 5000),
    ]);
    expect(pickPriceFromPools(json, MINT)).toBeNull();
  });

  it("ignores candidates with null price", () => {
    const json = payload([
      pool(`solana_${MINT}`, "solana_a", null, 1000, 5000),
      pool(`solana_${MINT}`, "solana_b", 0.0042, 238.09, 5000),
    ]);
    expect(pickPriceFromPools(json, MINT)).toBe(0.0042);
  });

  it("ignores candidates with zero price", () => {
    const json = payload([
      pool(`solana_${MINT}`, "solana_a", 0, 999, 5000),
      pool(`solana_${MINT}`, "solana_b", 0.0042, 238.09, 5000),
    ]);
    expect(pickPriceFromPools(json, MINT)).toBe(0.0042);
  });

  it("ignores candidates with negative price", () => {
    const json = payload([
      pool(`solana_${MINT}`, "solana_a", -0.001, -1000, 5000),
      pool(`solana_${MINT}`, "solana_b", 0.0042, 238.09, 5000),
    ]);
    expect(pickPriceFromPools(json, MINT)).toBe(0.0042);
  });

  it("ignores candidates with non-finite price", () => {
    const json = payload([
      pool(`solana_${MINT}`, "solana_a", NaN, Infinity, 5000),
      pool(`solana_${MINT}`, "solana_b", 0.0042, 238.09, 5000),
    ]);
    expect(pickPriceFromPools(json, MINT)).toBe(0.0042);
  });

  it("returns null when all candidates are invalid", () => {
    const json = payload([
      pool(`solana_${MINT}`, "solana_a", null, null, 5000),
      pool(`solana_${MINT}`, "solana_b", 0, 0, 5000),
      pool(`solana_${MINT}`, "solana_c", -1, -1, 5000),
    ]);
    expect(pickPriceFromPools(json, MINT)).toBeNull();
  });

  it("returns null for malformed input (no data array)", () => {
    expect(pickPriceFromPools(null, MINT)).toBeNull();
    expect(pickPriceFromPools({}, MINT)).toBeNull();
    expect(pickPriceFromPools({ data: "not-an-array" }, MINT)).toBeNull();
    expect(pickPriceFromPools(undefined, MINT)).toBeNull();
  });

  it("returns null when data items are not objects", () => {
    expect(pickPriceFromPools({ data: ["string", 42, null] }, MINT)).toBeNull();
  });

  it("rejects a pool whose matching token id only partially matches", () => {
    // A mint that is merely a substring of the target must not match.
    const json = payload([pool("solana_77", "solana_other", 0.0042, 238.09, 5000)]);
    expect(pickPriceFromPools(json, MINT)).toBeNull();
  });

  it("uses base_token_price_usd when the base token matches", () => {
    const json = payload([pool(`solana_${MINT}`, "solana_usdc", 0.0042, 1.0, 5000)]);
    expect(pickPriceFromPools(json, MINT)).toBe(0.0042);
  });

  it("uses quote_token_price_usd when the quote token matches", () => {
    const json = payload([pool("solana_usdc", `solana_${MINT}`, 1.0, 0.0042, 5000)]);
    expect(pickPriceFromPools(json, MINT)).toBe(0.0042);
  });

  it("accepts a decimal-string reserve from a live-shaped pool", () => {
    const json = payload([pool(`solana_${MINT}`, "solana_usdc", "0.0042", "238.09", "5000.50")]);
    expect(pickPriceFromPools(json, MINT)).toBe(0.0042);
  });

  it("accepts numeric reserve and numeric price", () => {
    const json = payload([pool(`solana_${MINT}`, "solana_usdc", 0.0042, 238.09, 5000)]);
    expect(pickPriceFromPools(json, MINT)).toBe(0.0042);
  });

  it("accepts a decimal-string price", () => {
    const json = payload([pool(`solana_${MINT}`, "solana_usdc", "0.0042", "238.09", "5000")]);
    expect(pickPriceFromPools(json, MINT)).toBe(0.0042);
  });

  it("rejects whitespace-only reserve", () => {
    const json = payload([pool(`solana_${MINT}`, "solana_a", 0.0042, 238.09, "   ")]);
    expect(pickPriceFromPools(json, MINT)).toBeNull();
  });

  it("rejects malformed reserve strings", () => {
    const json = payload([pool(`solana_${MINT}`, "solana_a", 0.0042, 238.09, "bad")]);
    expect(pickPriceFromPools(json, MINT)).toBeNull();
  });

  it("rejects boolean reserve", () => {
    const json = payload([pool(`solana_${MINT}`, "solana_a", 0.0042, 238.09, true)]);
    expect(pickPriceFromPools(json, MINT)).toBeNull();
  });

  it("rejects negative reserve", () => {
    const json = payload([
      pool(`solana_${MINT}`, "solana_a", 0.0042, 238.09, -1),
      pool(`solana_${MINT}`, "solana_b", 0.0042, 238.09, "-5"),
    ]);
    expect(pickPriceFromPools(json, MINT)).toBeNull();
  });

  it("rejects NaN and Infinity reserve", () => {
    const json = payload([
      pool(`solana_${MINT}`, "solana_a", 0.0042, 238.09, NaN),
      pool(`solana_${MINT}`, "solana_b", 0.0042, 238.09, Infinity),
    ]);
    expect(pickPriceFromPools(json, MINT)).toBeNull();
  });

  it("catches the top-level-vs-nested relationship regression (nested-only relationships must return null)", () => {
    // Old buggy shape: relationships nested inside attributes.
    const nested = {
      attributes: {
        base_token_price_usd: 0.0042,
        quote_token_price_usd: 238.09,
        reserve_in_usd: 5000,
        relationships: {
          base_token: { data: { id: `solana_${MINT}` } },
          quote_token: { data: { id: "solana_other" } },
        },
      },
    };
    expect(pickPriceFromPools({ data: [nested] }, MINT)).toBeNull();
  });

  it("chooses exact base match and highest reserve", () => {
    const json = payload([
      pool(`solana_${MINT}`, "solana_a", 0.001, 1000, "100"),
      pool(`solana_${MINT}`, "solana_b", 0.0042, 238.09, "9000"),
    ]);
    expect(pickPriceFromPools(json, MINT)).toBe(0.0042);
  });

  it("prefers exact base match when both sides match the target id", () => {
    // Both base and quote equal the target; base_token_price_usd must win.
    const json = payload([pool(`solana_${MINT}`, `solana_${MINT}`, 0.0042, 238.09, 5000)]);
    expect(pickPriceFromPools(json, MINT)).toBe(0.0042);
  });
});

// ── extractSimplePrice unit tests ──

describe("extractSimplePrice", () => {
  function simplePayload(price: unknown) {
    return { data: { attributes: { token_prices: { [MINT]: price } } } };
  }

  it("extracts a numeric price", () => {
    expect(extractSimplePrice(simplePayload(0.0042), MINT)).toBe(0.0042);
  });

  it("extracts a decimal-string price", () => {
    expect(extractSimplePrice(simplePayload("0.0042"), MINT)).toBe(0.0042);
  });

  it("rejects null response", () => {
    expect(extractSimplePrice(null, MINT)).toBeNull();
  });

  it("rejects missing data", () => {
    expect(extractSimplePrice({}, MINT)).toBeNull();
  });

  it("rejects missing attributes", () => {
    expect(extractSimplePrice({ data: {} }, MINT)).toBeNull();
  });

  it("rejects missing token_prices", () => {
    expect(extractSimplePrice({ data: { attributes: {} } }, MINT)).toBeNull();
  });

  it("rejects when the mint is absent from token_prices", () => {
    expect(extractSimplePrice({ data: { attributes: { token_prices: { other: 0.0042 } } } }, MINT)).toBeNull();
  });

  it("rejects non-string/non-number price values", () => {
    expect(extractSimplePrice(simplePayload(null), MINT)).toBeNull();
    expect(extractSimplePrice(simplePayload(true), MINT)).toBeNull();
    expect(extractSimplePrice(simplePayload({}), MINT)).toBeNull();
  });

  it("rejects empty and whitespace-only string prices", () => {
    expect(extractSimplePrice(simplePayload(""), MINT)).toBeNull();
    expect(extractSimplePrice(simplePayload("   "), MINT)).toBeNull();
  });

  it("rejects zero, negative, NaN and Infinity", () => {
    expect(extractSimplePrice(simplePayload(0), MINT)).toBeNull();
    expect(extractSimplePrice(simplePayload(-0.001), MINT)).toBeNull();
    expect(extractSimplePrice(simplePayload(NaN), MINT)).toBeNull();
    expect(extractSimplePrice(simplePayload(Infinity), MINT)).toBeNull();
  });

  it("rejects malformed string prices", () => {
    expect(extractSimplePrice(simplePayload("bad"), MINT)).toBeNull();
  });
});
