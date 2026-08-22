import { describe, it, expect } from "vitest";
import {
  buildBurnMemo,
  parseBurnMemo,
  sameBurnAction,
  netTokenDelta,
  burnedAtLeast,
} from "../vibe-burn";

const MINT = "FfDYT3WqimMw7itMxw4kYJ26GPG78RfpZmepQCFpBAGS";
const OTHER = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const bal = (owner: string, mint: string, amount: string) => ({
  owner,
  mint,
  uiTokenAmount: { amount },
});

describe("buildBurnMemo / parseBurnMemo", () => {
  it("round-trips a vouch memo", () => {
    const memo = buildBurnMemo({
      kind: "vouch",
      actorId: "aaa",
      targetId: "bbb",
    });
    expect(memo).toBe("vouch:aaa:bbb");
    expect(parseBurnMemo(memo)).toEqual({
      kind: "vouch",
      actorId: "aaa",
      targetId: "bbb",
    });
  });

  it("round-trips a protect memo", () => {
    const memo = buildBurnMemo({
      kind: "protect",
      actorId: "aaa",
      breakDate: "2026-08-10",
    });
    expect(memo).toBe("protect:aaa:2026-08-10");
    expect(parseBurnMemo(memo)).toEqual({
      kind: "protect",
      actorId: "aaa",
      breakDate: "2026-08-10",
    });
  });

  it("rejects malformed and unknown memos", () => {
    expect(parseBurnMemo("vouch:only-two")).toBeNull();
    expect(parseBurnMemo("vouch:aaa:bbb:extra")).toBeNull();
    expect(parseBurnMemo("transfer:aaa:bbb")).toBeNull();
    expect(parseBurnMemo("vouch::bbb")).toBeNull();
    expect(parseBurnMemo("")).toBeNull();
  });
});

describe("sameBurnAction", () => {
  it("matches identical actions", () => {
    expect(
      sameBurnAction(
        { kind: "vouch", actorId: "me", targetId: "you" },
        { kind: "vouch", actorId: "me", targetId: "you" },
      ),
    ).toBe(true);
  });

  it("rejects a different actor — this is the credit-theft guard", () => {
    // Someone submitting another user's broadcast burn must not be credited.
    expect(
      sameBurnAction(
        { kind: "vouch", actorId: "me", targetId: "builder" },
        { kind: "vouch", actorId: "someone-else", targetId: "builder" },
      ),
    ).toBe(false);
  });

  it("rejects a different target", () => {
    expect(
      sameBurnAction(
        { kind: "vouch", actorId: "me", targetId: "builder-a" },
        { kind: "vouch", actorId: "me", targetId: "builder-b" },
      ),
    ).toBe(false);
  });

  it("rejects a different kind even when the ids line up", () => {
    expect(
      sameBurnAction(
        { kind: "vouch", actorId: "a", targetId: "b" },
        { kind: "protect", actorId: "a", breakDate: "b" },
      ),
    ).toBe(false);
  });

  it("rejects a protect for a different break date", () => {
    expect(
      sameBurnAction(
        { kind: "protect", actorId: "a", breakDate: "2026-08-10" },
        { kind: "protect", actorId: "a", breakDate: "2026-08-11" },
      ),
    ).toBe(false);
  });
});

describe("netTokenDelta", () => {
  it("nets to zero for a transfer between two accounts", () => {
    const pre = [bal("alice", MINT, "1000"), bal("bob", MINT, "0")];
    const post = [bal("alice", MINT, "400"), bal("bob", MINT, "600")];
    expect(netTokenDelta(pre, post, MINT)).toBe(BigInt(0));
  });

  it("nets to zero when the destination account is created in-transaction", () => {
    // The receiving ATA has no `pre` entry at all.
    const pre = [bal("alice", MINT, "1000")];
    const post = [bal("alice", MINT, "400"), bal("bob", MINT, "600")];
    expect(netTokenDelta(pre, post, MINT)).toBe(BigInt(0));
  });

  it("goes negative by exactly the burned amount", () => {
    const pre = [bal("alice", MINT, "1000")];
    const post = [bal("alice", MINT, "400")];
    expect(netTokenDelta(pre, post, MINT)).toBe(BigInt(-600));
  });

  it("reflects the burn when the account is closed afterwards", () => {
    const pre = [bal("alice", MINT, "600")];
    const post: typeof pre = [];
    expect(netTokenDelta(pre, post, MINT)).toBe(BigInt(-600));
  });

  it("ignores balances belonging to other mints", () => {
    const pre = [bal("alice", MINT, "1000"), bal("alice", OTHER, "5000")];
    const post = [bal("alice", MINT, "400"), bal("alice", OTHER, "0")];
    expect(netTokenDelta(pre, post, MINT)).toBe(BigInt(-600));
  });

  it("handles empty balance arrays", () => {
    expect(netTokenDelta([], [], MINT)).toBe(BigInt(0));
  });
});

describe("burnedAtLeast", () => {
  const pre = [bal("alice", MINT, "1000")];
  const post = [bal("alice", MINT, "100")]; // 900 destroyed

  it("accepts a burn at or above the expected amount", () => {
    expect(burnedAtLeast(pre, post, MINT, BigInt(900))).toBe(true);
    expect(burnedAtLeast(pre, post, MINT, BigInt(500))).toBe(true);
  });

  it("accepts a burn exactly on the 10% slippage floor", () => {
    // 900 destroyed against 1000 expected is 90%.
    expect(burnedAtLeast(pre, post, MINT, BigInt(1000))).toBe(true);
  });

  it("rejects a burn below the slippage floor", () => {
    expect(burnedAtLeast(pre, post, MINT, BigInt(1100))).toBe(false);
  });

  it("rejects a transfer of the same amount — the core guarantee", () => {
    // Tokens moved to the treasury rather than being destroyed. The invariant
    // is what distinguishes the two.
    const tPre = [bal("alice", MINT, "1000")];
    const tPost = [bal("alice", MINT, "100"), bal("treasury", MINT, "900")];
    expect(burnedAtLeast(tPre, tPost, MINT, BigInt(900))).toBe(false);
  });

  it("rejects a transaction that destroyed nothing", () => {
    expect(burnedAtLeast(pre, pre, MINT, BigInt(1))).toBe(false);
  });

  it("rejects a burn of a different mint", () => {
    const oPre = [bal("alice", OTHER, "1000")];
    const oPost = [bal("alice", OTHER, "100")];
    expect(burnedAtLeast(oPre, oPost, MINT, BigInt(900))).toBe(false);
  });
});
