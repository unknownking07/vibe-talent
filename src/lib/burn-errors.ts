/**
 * Format a bigint $VIBE base-unit value as a human-readable string.
 *
 * - Splits at the FULL token `decimals` (not min(decimals, 3)).
 * - Displays at most the first 3 fractional digits, trailing zeros removed.
 * - No Number conversion (avoids precision loss on large bigint values).
 * - Comma-separated whole part.
 * - Supports decimals=0; rejects/normalizes invalid decimal counts safely.
 */
export function formatVibeBaseUnits(value: bigint, decimals: number): string {
  const d =
    Number.isSafeInteger(decimals) && decimals >= 0 && decimals <= 100
      ? decimals
      : 0;
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString();
  const sign = negative ? "-" : "";

  if (d === 0) {
    return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  // Pad to at least one whole digit, then split at the token's FULL decimal
  // precision. Only the display is truncated to three fractional digits.
  const padded = digits.padStart(d + 1, "0");
  const wholePart = padded.slice(0, -d);
  const fractionalPart = padded.slice(-d);
  const displayFraction = fractionalPart.slice(0, 3).replace(/0+$/, "");
  const withCommas = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `${sign}${withCommas}${displayFraction ? `.${displayFraction}` : ""}`;
}

/**
 * Build the insufficient-$VIBE message with exact amounts.
 * Shortfall is clamped to zero — never negative.
 */
export function insufficientVibeMessage(
  required: bigint,
  available: bigint,
  decimals: number,
): string {
  const shortfall = required > available ? required - available : 0n;
  const requiredStr = formatVibeBaseUnits(required, decimals);
  const availableStr = formatVibeBaseUnits(available, decimals);
  const shortfallStr = formatVibeBaseUnits(shortfall, decimals);
  return `You need ${requiredStr} $VIBE, but this wallet has ${availableStr} $VIBE. Add ${shortfallStr} $VIBE or choose a smaller amount.`;
}

/**
 * Map a raw burn/provider error to a friendly, non-technical message.
 *
 * Never returns the raw provider text — all branches produce a fixed string
 * so users never see RPC internals or wallet-provider jargon.
 */
export function friendlyBurnError(error: unknown): string {
  const text =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : String(error ?? "");

  const lower = text.toLowerCase();

  if (lower.includes("reject") || lower.includes("cancel") || lower.includes("decline")) {
    return "Transaction cancelled. Your tokens were not burned.";
  }

  if (
    lower.includes("insufficient sol") ||
    lower.includes("fee") ||
    lower.includes("rent")
  ) {
    return "You need a small amount of SOL in this wallet to pay the network fee. Your $VIBE was not burned.";
  }

  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("rpc") ||
    lower.includes("blockhash") ||
    lower.includes("failed to get recent blockhash")
  ) {
    return "Solana is temporarily unavailable. Your tokens were not burned. Please try again.";
  }

  if (lower.includes("insufficient") || lower.includes("token funds")) {
    return "This wallet does not have enough $VIBE for this burn. Choose a smaller amount or add more $VIBE.";
  }

  return "The burn could not be completed. Your tokens were not burned. Please try again.";
}
