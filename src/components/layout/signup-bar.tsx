"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** localStorage key — namespaced so it doesn't collide with other dismissed UI. */
const DISMISSED_KEY = "vibetalent_signup_bar_dismissed_at";

/** Re-show the bar this many days after a dismiss. Per locked decision in
 *  the plan: 7 days is persistent enough to convert returning anon visitors
 *  without feeling pushy. */
const DISMISSED_TTL_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Sticky bottom signup CTA shown to anonymous visitors on every page.
 *
 * Mounted once in the root layout — checks Supabase auth client-side and
 * returns null for logged-in users. Dismissible: a 7-day TTL stored in
 * localStorage prevents the bar from re-appearing on every page transition,
 * but eventually returns so a visitor who never signed up sees it again.
 *
 * Positioning: `position: fixed; bottom: 0; z-index: 50`. Does not displace
 * the page footer (which sits at the bottom of normal flow); when visible,
 * it overlays the bottom of the viewport. The body adds bottom padding via
 * the `data-signup-bar="visible"` attribute so the last fold of content is
 * never permanently obscured.
 *
 * Why a client island and not a server component:
 *  1. We need `supabase.auth.getUser()` and `localStorage` for the dismiss
 *     state, both of which are browser-only.
 *  2. The bar must not block the cached server response — keeping it client-
 *     side means the page paints with the bar absent on first byte and the
 *     bar fades in once auth state is resolved.
 */
export function SignupBar() {
  // We start hidden and only flip to visible after we've confirmed the
  // viewer is anon AND not dismissed. Avoids a flash on logged-in pages.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // Check the dismiss timestamp first — cheaper than a network round-trip.
      try {
        const dismissedAt = localStorage.getItem(DISMISSED_KEY);
        if (dismissedAt) {
          const ts = Number(dismissedAt);
          if (Number.isFinite(ts) && Date.now() - ts < DISMISSED_TTL_DAYS * DAY_MS) {
            return; // still within dismissal window
          }
          // stale dismissal — clear so we don't re-check every page nav
          localStorage.removeItem(DISMISSED_KEY);
        }
      } catch {
        // localStorage can throw in private mode / disabled storage — fail
        // open and show the bar.
      }

      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          setVisible(true);
        }
      } catch {
        // If auth check fails, default to NOT showing — better to under-show
        // than to flash a "Sign up" CTA at someone who's already signed in.
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reflect visibility on the body so global CSS can add bottom padding to
  // <main>. We keep the attribute even after the bar mounts so any layout-
  // dependent rules can react synchronously.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (visible) {
      document.body.setAttribute("data-signup-bar", "visible");
    } else {
      document.body.removeAttribute("data-signup-bar");
    }
    return () => {
      document.body.removeAttribute("data-signup-bar");
    };
  }, [visible]);

  if (!visible) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // can't persist — at least hide for the current session
    }
    setVisible(false);
  };

  return (
    <>
      <style>{`
        body[data-signup-bar="visible"] main { padding-bottom: 72px; }
        .signup-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; background: var(--bg-surface, #15151A); border-top: 2px solid var(--border-hard, #2A2A33); padding: 12px 16px; box-shadow: 0 -4px 24px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .signup-bar__copy { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
        .signup-bar__heading { font-size: 14px; font-weight: 700; color: var(--foreground, #fff); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .signup-bar__sub { font-size: 13px; color: var(--text-muted, #8A8B94); display: none; }
        .signup-bar__actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .signup-bar__signin { font-size: 13px; font-weight: 600; color: var(--text-secondary); text-decoration: none; padding: 8px 12px; border-radius: 6px; transition: color 0.15s ease; }
        .signup-bar__signin:hover { color: var(--foreground); }
        .signup-bar__cta { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; padding: 9px 14px; background: var(--accent, #FF4A2A); color: #0A0A0E; text-decoration: none; border-radius: 6px; transition: transform 0.15s ease; }
        .signup-bar__cta:hover { transform: translateY(-1px); }
        .signup-bar__dismiss { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px; background: none; border: none; color: var(--text-muted, #8A8B94); cursor: pointer; transition: color 0.15s ease, background 0.15s ease; }
        .signup-bar__dismiss:hover { color: var(--foreground); background: var(--bg-surface-light, rgba(255,255,255,0.04)); }
        @media(min-width: 640px) {
          .signup-bar__sub { display: inline; }
        }
      `}</style>
      <div className="signup-bar" role="region" aria-label="Sign up call to action">
        <div className="signup-bar__copy">
          <strong className="signup-bar__heading">Build your streak. Get discovered.</strong>
          <span className="signup-bar__sub">Free profile · GitHub-verified · proof of work over resumes.</span>
        </div>
        <div className="signup-bar__actions">
          <Link href="/auth/login" className="signup-bar__signin">
            Sign in
          </Link>
          <Link href="/auth/login" className="signup-bar__cta">
            Create profile <ArrowRight size={14} />
          </Link>
          <button
            type="button"
            className="signup-bar__dismiss"
            onClick={handleDismiss}
            aria-label="Dismiss signup bar (re-shows in 7 days)"
            title="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </>
  );
}
