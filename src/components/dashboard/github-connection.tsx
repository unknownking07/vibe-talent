"use client";

import { useState } from "react";
import { Github, CheckCircle2, Unlink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface GithubConnectionProps {
  /** The currently verified GitHub handle, or null when nothing is linked. */
  githubUsername: string | null;
  /** Called after a successful unlink so the parent can drop the handle from its state. */
  onUnlinked: () => void;
  /** `error_code` from the OAuth callback redirect, used to show the post-connect banner. */
  oauthErrorCode: string | null;
}

/**
 * GitHub connection control for the settings profile card. Renders as a single
 * grid cell (label + control) with three states:
 *
 *  - Connected: a verified pill plus an "Unlink account" affordance that expands
 *    an inline confirm. Unlinking removes the GitHub OAuth identity from Supabase
 *    Auth and clears the mirrored handle/id so a *different* account can be linked
 *    afterwards — the recovery path for a builder who lost access to their GitHub.
 *  - Not connected: a "Connect GitHub" button (OAuth linkIdentity round-trip).
 *
 * Supabase requires at least two linked identities to unlink one, so a builder
 * whose only sign-in method is GitHub is told to add another first rather than
 * being locked out of their own account.
 */
export function GithubConnection({ githubUsername, onUnlinked, oauthErrorCode }: GithubConnectionProps) {
  const [connecting, setConnecting] = useState(false);
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Suppress the OAuth round-trip banners once the user starts the unlink flow,
  // so a stale ?error_code from an earlier connect can't render a wrong message.
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    const supabase = createClient();
    const { error: linkError } = await supabase.auth.linkIdentity({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/settings` },
    });
    if (linkError) {
      setError(`Couldn't connect GitHub: ${linkError.message}`);
      setConnecting(false);
    }
    // On success the browser redirects to GitHub, so no further UI update needed.
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    setError(null);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const { data: identityData, error: idError } = await supabase.auth.getUserIdentities();
    if (idError || !identityData?.identities) {
      setError("Couldn't load your linked accounts. Please try again.");
      setUnlinking(false);
      return;
    }
    const identities = identityData.identities;
    const githubIdentity = identities.find((i) => i.provider === "github");

    // The GitHub auth identity is still attached — remove it. Supabase rejects
    // unlinking the *only* identity (it would orphan the login), so guard first.
    if (githubIdentity) {
      if (identities.length < 2) {
        setError(
          "GitHub is your only sign-in method. Add Google or email login first, then unlink — otherwise you'd be locked out."
        );
        setUnlinking(false);
        return;
      }
      const { error: unlinkError } = await supabase.auth.unlinkIdentity(githubIdentity);
      if (unlinkError) {
        setError(`Couldn't unlink GitHub: ${unlinkError.message}`);
        setUnlinking(false);
        return;
      }
    }

    // Whether we just removed the identity or it was already gone (a partial
    // prior failure), clear the mirrored handle + stable id so the badge drops
    // and a fresh account links cleanly. Clearing github_id matters: the OAuth
    // callback only backfills it when null, so a lingering id would attach to a
    // newly-linked account and defeat github-sync's rename/reclaim guard.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await sb.from("users").update({ github_username: null, github_id: null }).eq("id", user.id);
      await sb.from("social_links").update({ github: null }).eq("user_id", user.id);
    }

    setConfirmingUnlink(false);
    setUnlinking(false);
    onUnlinked();
  };

  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5 block">GitHub</label>

      {/* Post-connect banners from the OAuth callback round-trip. Supabase
          returns error_code=identity_already_exists both when the link
          succeeds (handle now mirrored) and when the account belongs to
          someone else (handle absent) — disambiguate on githubUsername. */}
      {!bannerDismissed && oauthErrorCode === "identity_already_exists" && githubUsername && (
        <div
          className="mb-2 p-3 flex items-start gap-2 text-sm"
          style={{ backgroundColor: "var(--status-success-bg)", border: "2px solid var(--border-hard)" }}
        >
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: "var(--status-success-text)" }} />
          <span className="font-bold text-[var(--status-success-text)]">GitHub connected successfully!</span>
        </div>
      )}
      {!bannerDismissed && oauthErrorCode === "identity_already_exists" && !githubUsername && (
        <div
          className="mb-2 p-3 flex items-start gap-2 text-sm"
          style={{ backgroundColor: "var(--status-error-bg)", border: "2px solid var(--border-hard)" }}
        >
          <Github size={16} className="mt-0.5 shrink-0" style={{ color: "var(--status-error-text)" }} />
          <span className="font-bold text-[var(--foreground)]">
            This GitHub account is already linked to another user. Use a different GitHub account or contact support.
          </span>
        </div>
      )}

      {githubUsername ? (
        <div className="space-y-2">
          <div
            className="flex items-center gap-2 px-3 py-2.5 text-sm"
            style={{ backgroundColor: "var(--status-success-bg)", border: "2px solid var(--border-hard)" }}
          >
            <CheckCircle2 size={16} className="text-[var(--status-success-text)] flex-shrink-0" />
            <span className="font-bold text-[var(--status-success-text)] truncate">@{githubUsername}</span>
            <span className="text-xs font-bold uppercase text-[var(--status-success-text)] opacity-70 ml-auto">Verified</span>
          </div>

          {confirmingUnlink ? (
            <div
              className="p-3 space-y-2"
              style={{ backgroundColor: "var(--status-error-bg)", border: "2px solid var(--border-hard)" }}
            >
              <p className="text-xs font-bold text-[var(--foreground)] leading-relaxed">
                Unlink @{githubUsername}? Daily streak sync stops until you connect a GitHub account again. Your projects, score, and endorsements stay.
              </p>
              {error && <p className="text-xs font-bold text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleUnlink}
                  disabled={unlinking}
                  className="btn-brutal text-xs py-1.5 px-3 bg-red-500 text-white hover:bg-red-600"
                >
                  {unlinking ? "Unlinking..." : "Unlink"}
                </button>
                <button
                  onClick={() => { setConfirmingUnlink(false); setError(null); }}
                  disabled={unlinking}
                  className="btn-brutal text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setConfirmingUnlink(true); setBannerDismissed(true); }}
              className="inline-flex items-center gap-1 text-xs font-bold text-[var(--text-muted)] hover:text-red-500 transition-colors"
            >
              <Unlink size={12} />
              Unlink account
            </button>
          )}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-extrabold uppercase tracking-wide text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-[var(--bg-pill-hover)]"
            style={{ backgroundColor: "var(--bg-inverted)", border: "2px solid var(--border-hard)" }}
          >
            <Github size={16} />
            {connecting ? "Connecting..." : "Connect GitHub"}
          </button>
          {error && <p className="mt-1.5 text-xs font-bold text-red-600">{error}</p>}
        </>
      )}

      <p className="mt-1.5 text-xs font-medium text-[var(--text-muted)]">
        {githubUsername
          ? "Ownership verified via GitHub OAuth. Unlink to switch to a different account."
          : "Verify ownership to enable streak sync."}
      </p>
    </div>
  );
}
