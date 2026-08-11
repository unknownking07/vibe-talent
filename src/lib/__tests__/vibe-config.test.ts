import { describe, it, expect } from "vitest";
import {
  holderTierFor,
  freezeAllowanceFor,
  BASE_FREEZES,
  VIBE_MINT,
  VIBE_BUY_URL,
  VOUCH,
} from "../vibe-config";

describe("holderTierFor", () => {
  it("returns null below the lowest threshold", () => {
    expect(holderTierFor(0)).toBeNull();
    expect(holderTierFor(9.99)).toBeNull();
  });

  it("returns backer at the boundary and patron above it", () => {
    expect(holderTierFor(10)?.key).toBe("backer");
    expect(holderTierFor(39.99)?.key).toBe("backer");
    expect(holderTierFor(40)?.key).toBe("patron");
    expect(holderTierFor(10_000)?.key).toBe("patron");
  });
});

describe("freezeAllowanceFor", () => {
  it("gives the base allowance to non-holders", () => {
    expect(freezeAllowanceFor(0)).toBe(BASE_FREEZES);
  });

  it("raises the allowance by tier", () => {
    expect(freezeAllowanceFor(10)).toBe(3);
    expect(freezeAllowanceFor(40)).toBe(4);
  });

  it("never returns less than the base allowance", () => {
    expect(freezeAllowanceFor(-1)).toBe(BASE_FREEZES);
  });
});

describe("token constants", () => {
  it("resolves the $VIBE mint from the Solana chain config", () => {
    expect(VIBE_MINT).toBe("FfDYT3WqimMw7itMxw4kYJ26GPG78RfpZmepQCFpBAGS");
  });

  it("builds a Bags buy URL for the mint", () => {
    // Jupiter can't route $VIBE, so this link is the only buy path.
    expect(VIBE_BUY_URL).toBe(`https://bags.fm/${VIBE_MINT}`);
  });

  it("keeps the vouch minimum at or below the cheapest preset", () => {
    expect(Math.min(...VOUCH.presetsUsd)).toBeGreaterThanOrEqual(VOUCH.minUsd);
  });
});
