"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/**
 * Contract address with a copy button. The address stays selectable as text so
 * a clipboard failure (permissions policy, insecure context) still leaves the
 * user able to copy it manually.
 */
export function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the address is on screen and selectable.
    }
  }

  return (
    <div className="flex items-stretch gap-2">
      <code
        className="flex-1 px-3 py-2.5 font-mono text-[11px] sm:text-xs font-bold break-all"
        style={{
          border: "2px solid var(--border-hard)",
          backgroundColor: "var(--bg-surface)",
          color: "var(--foreground)",
        }}
      >
        {address}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Contract address copied" : "Copy contract address"}
        className="px-3 shrink-0 transition-colors"
        style={{
          border: "2px solid var(--border-hard)",
          backgroundColor: copied ? "var(--accent)" : "var(--bg-surface)",
          color: copied ? "var(--bg-surface)" : "var(--foreground)",
        }}
      >
        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Contract address copied to clipboard" : ""}
      </span>
    </div>
  );
}
