import { describe, it, expect } from "vitest";
import {
  formatVibeBaseUnits,
  insufficientVibeMessage,
  friendlyBurnError,
} from "../burn-errors";

describe("formatVibeBaseUnits", () => {
  it("decimals6: exact whole and fractional values", () => {
    expect(formatVibeBaseUnits(1_000_000n, 6)).toBe("1");
    expect(formatVibeBaseUnits(1_500_000n, 6)).toBe("1.5");
    expect(formatVibeBaseUnits(1_234_567n, 6)).toBe("1.234");
    expect(formatVibeBaseUnits(1n, 6)).toBe("0");
  });

  it("decimals9: large value with comma grouping", () => {
    expect(formatVibeBaseUnits(2_100_000_000_000_000n, 9)).toBe("2,100,000");
  });

  it("huge bigint with decimals6", () => {
    expect(
      formatVibeBaseUnits(123456789012345678901234567890n, 6),
    ).toBe("123,456,789,012,345,678,901,234.567");
  });

  it("decimals0: whole-number display", () => {
    expect(formatVibeBaseUnits(1_000_000n, 0)).toBe("1,000,000");
    expect(formatVibeBaseUnits(1n, 0)).toBe("1");
  });

  it("invalid decimal fallback to zero", () => {
    expect(formatVibeBaseUnits(1_000_000n, -1)).toBe("1,000,000");
    expect(formatVibeBaseUnits(1_000_000n, 101)).toBe("1,000,000");
    expect(formatVibeBaseUnits(1_000_000n, NaN as unknown as number)).toBe(
      "1,000,000",
    );
  });
});

describe("insufficientVibeMessage", () => {
  it("exact required/available/shortfall", () => {
    const msg = insufficientVibeMessage(10_000_000n, 6_000_000n, 6);
    expect(msg).toBe(
      "You need 10 $VIBE, but this wallet has 6 $VIBE. Add 4 $VIBE or choose a smaller amount.",
    );
  });

  it("shortfall is nonnegative when available exceeds required", () => {
    const msg = insufficientVibeMessage(5_000_000n, 10_000_000n, 6);
    expect(msg).toBe(
      "You need 5 $VIBE, but this wallet has 10 $VIBE. Add 0 $VIBE or choose a smaller amount.",
    );
  });
});

describe("friendlyBurnError", () => {
  it("rejection maps to cancellation", () => {
    expect(friendlyBurnError("User rejected the request")).toBe(
      "Transaction cancelled. Your tokens were not burned.",
    );
    expect(friendlyBurnError("cancel")).toBe(
      "Transaction cancelled. Your tokens were not burned.",
    );
    expect(friendlyBurnError("declined by user")).toBe(
      "Transaction cancelled. Your tokens were not burned.",
    );
  });

  it("insufficient SOL fee/rent maps to SOL fee message", () => {
    expect(friendlyBurnError("insufficient sol for transaction fee")).toBe(
      "You need a small amount of SOL in this wallet to pay the network fee. Your $VIBE was not burned.",
    );
    expect(friendlyBurnError("Transaction results in an underfunded rent")).toBe(
      "You need a small amount of SOL in this wallet to pay the network fee. Your $VIBE was not burned.",
    );
  });

  it("network/fetch/RPC/blockhash maps to unavailable message", () => {
    expect(friendlyBurnError("Network request failed")).toBe(
      "Solana is temporarily unavailable. Your tokens were not burned. Please try again.",
    );
    expect(friendlyBurnError("fetch failed")).toBe(
      "Solana is temporarily unavailable. Your tokens were not burned. Please try again.",
    );
    expect(friendlyBurnError("RPC error")).toBe(
      "Solana is temporarily unavailable. Your tokens were not burned. Please try again.",
    );
    expect(friendlyBurnError("failed to get recent blockhash")).toBe(
      "Solana is temporarily unavailable. Your tokens were not burned. Please try again.",
    );
  });

  it("insufficient token maps to insufficient token message", () => {
    expect(friendlyBurnError("insufficient token funds")).toBe(
      "This wallet does not have enough $VIBE for this burn. Choose a smaller amount or add more $VIBE.",
    );
  });

  it("unknown error maps to generic fallback", () => {
    expect(friendlyBurnError("something weird happened")).toBe(
      "The burn could not be completed. Your tokens were not burned. Please try again.",
    );
  });

  it("handles Error objects", () => {
    expect(friendlyBurnError(new Error("User rejected the request"))).toBe(
      "Transaction cancelled. Your tokens were not burned.",
    );
  });

  it("handles null/undefined without crashing", () => {
    expect(friendlyBurnError(null)).toBe(
      "The burn could not be completed. Your tokens were not burned. Please try again.",
    );
    expect(friendlyBurnError(undefined)).toBe(
      "The burn could not be completed. Your tokens were not burned. Please try again.",
    );
  });

  it("raw provider detail never leaks", () => {
    const raw =
      "Error: failed to send transaction: Transaction simulation failed: Error processing Instruction 0: custom program error: 0x1";
    const result = friendlyBurnError(raw);
    expect(result).not.toContain("0x1");
    expect(result).not.toContain("Instruction 0");
    expect(result).not.toContain("simulation failed");
    expect(result).not.toContain("Error:");
  });

  it("no network claims", () => {
    const result = friendlyBurnError("network timeout");
    expect(result).not.toMatch(/claim/i);
    expect(result).not.toMatch(/rounding/i);
  });

  it("no rounding claims", () => {
    const result = friendlyBurnError("rounding error");
    expect(result).not.toMatch(/rounding/i);
    expect(result).not.toMatch(/claim/i);
  });
});
