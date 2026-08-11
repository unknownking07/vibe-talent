"use client";

import { useRef, useState } from "react";
import { Copy } from "lucide-react";
import { Check } from "@phosphor-icons/react";

type CopyState = "idle" | "copied" | "selected";

/**
 * Contract address with a copy button.
 *
 * navigator.clipboard can reject — insecure context, a permissions policy, or
 * the user denying access. Swallowing that leaves the button looking broken
 * (it was: a blocked clipboard produced no visible change at all), so on
 * failure we select the address and tell the user to press the copy shortcut.
 * Either path ends with them able to copy it.
 */
export function CopyAddress({ address }: { address: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const addressRef = useRef<HTMLElement>(null);

  function selectAddress() {
    const node = addressRef.current;
    if (!node) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      setState("copied");
    } catch {
      selectAddress();
      setState("selected");
    }
    setTimeout(() => setState("idle"), 2500);
  }

  const label =
    state === "copied"
      ? "Contract address copied"
      : state === "selected"
        ? "Contract address selected, press the copy shortcut"
        : "Copy contract address";

  return (
    <div>
      <div className="flex items-stretch gap-2">
        <code
          ref={addressRef}
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
          aria-label={label}
          className="px-3 shrink-0 transition-colors"
          style={{
            border: "2px solid var(--border-hard)",
            backgroundColor: state === "copied" ? "var(--accent)" : "var(--bg-surface)",
            color: state === "copied" ? "var(--bg-surface)" : "var(--foreground)",
          }}
        >
          {state === "copied" ? (
            <Check weight="bold" size={16} aria-hidden="true" />
          ) : (
            <Copy size={16} aria-hidden="true" />
          )}
        </button>
      </div>

      <p
        role="status"
        aria-live="polite"
        className="mt-1.5 text-[11px] font-bold uppercase tracking-wide"
        style={{
          color: state === "selected" ? "var(--foreground)" : "var(--accent)",
          minHeight: "1rem",
        }}
      >
        {state === "copied"
          ? "Copied"
          : state === "selected"
            ? "Selected, press Cmd+C or Ctrl+C"
            : ""}
      </p>
    </div>
  );
}
