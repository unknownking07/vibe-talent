"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, X, LifeBuoy, Search } from "lucide-react";

/**
 * Site-wide floating chat launcher. One always-visible button (bottom-right)
 * that expands into a two-item menu:
 *   - Get help    → /support     (VibeFinder Support bot)
 *   - Find talent → /agent/chat  (VibeFinder matching bot)
 *
 * Fixes discoverability: the AI tools were buried behind the "More" nav
 * dropdown where few people found them. Mounted once in the root layout.
 *
 * Positioning reuses the signup bar's `body[data-signup-bar="visible"]`
 * attribute to lift above the sticky CTA when it's showing, so the two never
 * overlap.
 */
export function FloatingChat() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close on outside click or Escape while the menu is open.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Don't show the launcher on the chat destinations themselves — you're
  // already there, so a "get help" bubble would be redundant.
  if (pathname.startsWith("/support") || pathname.startsWith("/agent")) {
    return null;
  }

  return (
    <>
      <style>{`
        .vt-fab-wrap { position: fixed; right: 20px; bottom: 20px; z-index: 60; }
        body[data-signup-bar="visible"] .vt-fab-wrap { bottom: 88px; }

        .vt-fab {
          width: 56px; height: 56px; display: flex; align-items: center; justify-content: center;
          background: var(--accent); color: #0A0A0E;
          border: 2px solid var(--border-hard); box-shadow: 4px 4px 0 var(--border-hard);
          cursor: pointer; border-radius: 4px;
          transition: transform .12s ease, box-shadow .12s ease;
        }
        .vt-fab:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 var(--border-hard); }
        .vt-fab:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0 var(--border-hard); }

        .vt-fab-menu {
          position: absolute; right: 0; bottom: calc(100% + 12px); width: 264px;
          background: var(--bg-surface); border: 2px solid var(--border-hard);
          box-shadow: 4px 4px 0 var(--border-hard); overflow: hidden;
          animation: vt-fab-in .14s ease-out;
        }
        @keyframes vt-fab-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

        .vt-fab-head {
          padding: 10px 14px; font-size: 11px; font-weight: 800; text-transform: uppercase;
          letter-spacing: .06em; color: var(--text-muted);
          background: var(--bg-inverted); border-bottom: 2px solid var(--border-hard);
        }
        .vt-fab-item { display: flex; align-items: center; gap: 12px; padding: 14px; text-decoration: none; color: var(--foreground); transition: background .12s ease; }
        .vt-fab-item + .vt-fab-item { border-top: 2px solid var(--border-hard); }
        .vt-fab-item:hover { background: var(--bg-inverted); }
        .vt-fab-ico {
          width: 36px; height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
          background: var(--bg-inverted); border: 2px solid var(--border-hard); color: var(--accent);
          transition: background .12s ease, color .12s ease;
        }
        .vt-fab-item:hover .vt-fab-ico { background: var(--accent); color: #0A0A0E; }
        .vt-fab-title { display: block; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: .02em; line-height: 1.1; }
        .vt-fab-sub { display: block; font-size: 12px; color: var(--text-muted); font-weight: 500; margin-top: 3px; }
      `}</style>

      <div className="vt-fab-wrap" ref={wrapRef}>
        {open && (
          <div className="vt-fab-menu" role="menu" aria-label="Chat options">
            <div className="vt-fab-head">How can we help?</div>
            <Link href="/support" className="vt-fab-item" role="menuitem" onClick={() => setOpen(false)}>
              <span className="vt-fab-ico"><LifeBuoy size={18} /></span>
              <span>
                <span className="vt-fab-title">Get help</span>
                <span className="vt-fab-sub">Questions &amp; support</span>
              </span>
            </Link>
            <Link href="/agent/chat" className="vt-fab-item" role="menuitem" onClick={() => setOpen(false)}>
              <span className="vt-fab-ico"><Search size={18} /></span>
              <span>
                <span className="vt-fab-title">Find talent</span>
                <span className="vt-fab-sub">AI-matched builders</span>
              </span>
            </Link>
          </div>
        )}

        <button
          type="button"
          className="vt-fab"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={open ? "Close chat menu" : "Open chat menu"}
        >
          {open ? <X size={24} /> : <MessageCircle size={24} />}
        </button>
      </div>
    </>
  );
}
