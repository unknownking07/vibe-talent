"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut, Settings, Sparkles, Trophy, User, Users, BadgeCheck, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/ui/notification-bell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { resetTourForReplay, TOUR_FLAG_ENABLED } from "@/lib/onboarding";

const exploreSubLinks = [
  { href: "/explore", label: "Talent" },
  { href: "/projects", label: "Projects" },
];

const navLinks = [
  { href: "/feed", label: "Feed" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/agent", label: "AI Agents" },
  { href: "/dashboard", label: "Dashboard" },
];

const DOCS_URL = "https://vibe-talent.gitbook.io/untitled";

export type NavbarProfile = {
  username: string;
  avatar_url: string | null;
  github_username: string | null;
  display_name: string | null;
};

interface NavbarClientProps {
  initialIsLoggedIn: boolean;
  initialProfile: NavbarProfile | null;
}

// Cache the navbar profile in localStorage so a hard refresh renders the
// avatar from the first post-hydration paint instead of flashing the
// "Create Profile" CTA and "??" initials while supabase.auth.getUser() and
// the profile DB query resolve. The background auth check below still runs
// and overwrites stale entries (logout in another tab, profile renamed, etc.).
const NAV_PROFILE_CACHE_KEY = "vt-navbar-profile-v1";

function readCachedNavProfile(): NavbarProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(NAV_PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.username !== "string") return null;
    return {
      username: parsed.username,
      avatar_url: typeof parsed.avatar_url === "string" ? parsed.avatar_url : null,
      github_username: typeof parsed.github_username === "string" ? parsed.github_username : null,
      display_name: typeof parsed.display_name === "string" ? parsed.display_name : null,
    };
  } catch {
    return null;
  }
}

function writeCachedNavProfile(profile: NavbarProfile | null): void {
  if (typeof window === "undefined") return;
  try {
    if (profile === null) {
      window.localStorage.removeItem(NAV_PROFILE_CACHE_KEY);
    } else {
      window.localStorage.setItem(NAV_PROFILE_CACHE_KEY, JSON.stringify(profile));
    }
  } catch {
    // Private mode / quota / disabled storage — best-effort cache.
  }
}

function ProfileAvatar({
  avatarUrl,
  username,
  initials,
  size,
}: {
  avatarUrl: string | null | undefined;
  username: string | undefined;
  initials: string;
  size: number;
}) {
  const textClass = size >= 48 ? "text-sm" : "text-xs";
  return avatarUrl ? (
    <Image
      src={avatarUrl}
      alt={username || "Profile"}
      width={size}
      height={size}
      className="w-full h-full object-cover"
      style={{ borderRadius: "50%" }}
    />
  ) : (
    <span className={`${textClass} font-extrabold text-white`}>{initials}</span>
  );
}

export function NavbarClient({ initialIsLoggedIn, initialProfile }: NavbarClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Read the cached profile during the useState initializer (client-only
  // path) so the FIRST client render after hydration already has the
  // logged-in state for returning users. The useState callback is invoked
  // once per component lifecycle — localStorage is hit at most twice on
  // initial mount, which is cheap. On the server, `typeof window` is
  // undefined and we fall back to the SSR-supplied props.
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    if (typeof window === "undefined") return initialIsLoggedIn;
    return !!readCachedNavProfile() || initialIsLoggedIn;
  });
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<NavbarProfile | null>(() => {
    if (typeof window === "undefined") return initialProfile;
    return readCachedNavProfile() ?? initialProfile;
  });
  const [hasUnloggedActivity, setHasUnloggedActivity] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  // Gates the auth-dependent right side of the navbar (desktop CTA / avatar,
  // mobile bell / avatar). Stays false through SSR + the first client render
  // so the served HTML matches hydration, then flips to true inside the mount
  // effect. This kills the "Create Profile" flash that returning logged-in
  // users hit on a hard refresh — before this gate, the SSR-rendered
  // logged-out CTA was painted to the DOM before the cached profile state
  // could be applied. A placeholder of the CTA's footprint is rendered in
  // its place so the navbar doesn't reflow when the gate flips open.
  const [authMounted, setAuthMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const exploreRef = useRef<HTMLDivElement>(null);
  // Reference to the avatar button so we can restore focus to it when the
  // dropdown closes via Escape — required for keyboard / screen-reader users.
  const avatarTriggerRef = useRef<HTMLButtonElement>(null);
  const exploreTriggerRef = useRef<HTMLButtonElement>(null);
  // Mirror isLoggedIn into a ref so checkTodayLogged (a stable useCallback)
  // can read the latest auth state without going stale across re-renders.
  // Critical for the visibilitychange / streak-updated listeners — without
  // the guard, anonymous visitors would hit the API and the 401 response
  // would still leave hasUnloggedActivity true from a prior session.
  const isLoggedInRef = useRef(initialIsLoggedIn);

  const checkTodayLogged = useCallback(async () => {
    if (!isLoggedInRef.current) {
      setHasUnloggedActivity(false);
      return;
    }
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const res = await fetch(`/api/streak/today-logged?date=${today}`);
      if (!res.ok) {
        // 401 / 429 / 5xx — clear the dot rather than leaving a stale value.
        setHasUnloggedActivity(false);
        return;
      }
      const data = await res.json();
      setHasUnloggedActivity(data.loggedToday === false);
    } catch {
      setHasUnloggedActivity(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    // Guard against late-resolving async work landing on a torn-down instance
    // during fast route changes / auth flips.
    let cancelled = false;

    // The cache-aware useState initializers above already seeded isLoggedIn
    // and userProfile from localStorage on the first client render. Re-read
    // here only to sync the ref (useRef has no lazy initializer) and to
    // know whether to kick off the dashboard-dot check eagerly.
    const cachedProfile = readCachedNavProfile();
    isLoggedInRef.current = !!cachedProfile || initialIsLoggedIn;
    // Open the gate so the resolved auth UI replaces the placeholder. This
    // is the canonical "is the client mounted" pattern; the lint rule's
    // suggestion to use a useState initializer doesn't apply here — we
    // explicitly want false during SSR + hydration and true afterwards.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuthMounted(true);

    async function fetchProfile(userId: string, email?: string) {
      try {
        const { data: profile, error } = await sb
          .from("users")
          .select("username, avatar_url, github_username, display_name")
          .eq("id", userId)
          .single();
        if (cancelled) return;
        if (error) console.error("Navbar profile fetch error:", error);
        if (profile && profile.username) {
          const next: NavbarProfile = {
            username: profile.username,
            avatar_url: profile.avatar_url,
            github_username: profile.github_username || null,
            display_name: profile.display_name || null,
          };
          setUserProfile(next);
          writeCachedNavProfile(next);
        } else if (email) {
          // Fallback: use email prefix as display name. Intentionally NOT
          // cached — these are users mid-onboarding with no `users` row yet,
          // and we want the real username to show as soon as it exists.
          setUserProfile({ username: email.split("@")[0], avatar_url: null, github_username: null, display_name: null });
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Navbar profile fetch failed:", err);
        if (email) {
          setUserProfile({ username: email.split("@")[0], avatar_url: null, github_username: null, display_name: null });
        }
      }
    }

    // If SSR or the localStorage cache already tells us the user is logged
    // in, kick off the dashboard-dot check immediately — the auth round-trip
    // below would otherwise delay it. Defer to a microtask so
    // react-hooks/set-state-in-effect sees an async boundary (the setState
    // happens after the API round-trip, not during this effect's body, so
    // there's no cascading render risk).
    if (initialIsLoggedIn || cachedProfile) {
      void Promise.resolve().then(() => checkTodayLogged());
    }

    // Check auth once on mount, then listen for changes. This still runs even
    // when SSR pre-populated state, in case the cookie changed between render
    // and hydration (e.g. user signed out in another tab).
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return;
      isLoggedInRef.current = !!user;
      setIsLoggedIn(!!user);
      if (user) {
        fetchProfile(user.id, user.email);
        void checkTodayLogged();
      } else {
        // Cookie expired or cleared between cache write and now — drop the
        // cached profile so the next hard refresh doesn't flash it.
        setUserProfile(null);
        writeCachedNavProfile(null);
        setHasUnloggedActivity(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      isLoggedInRef.current = !!session?.user;
      setIsLoggedIn(!!session?.user);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email);
        void checkTodayLogged();
      } else {
        setUserProfile(null);
        setHasUnloggedActivity(false);
        writeCachedNavProfile(null);
      }
    });

    // Refetch the profile whenever something in the app saves it (e.g. the
    // settings page saves a display name). Without this, the onboarding dot
    // would only clear on a full reload.
    const handleProfileUpdated = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (user) fetchProfile(user.id, user.email);
    };
    window.addEventListener("profile-updated", handleProfileUpdated);

    // The dashboard dispatches this after manual Log Activity, successful
    // GitHub sync, and midnight rollover. Refetch so the dot updates without
    // a full page reload.
    window.addEventListener("streak-updated", checkTodayLogged);

    // Catch the "pushed to GitHub in another tab/terminal, came back" case:
    // when the tab regains focus, re-check. GitHub auto-sync is scheduled
    // server-side, so by the time the user comes back, streak_logs may have
    // been updated and the dot should clear.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkTodayLogged();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Cross-tab logout: when another tab clears the cache via
    // writeCachedNavProfile(null), drop our state and re-validate. Supabase's
    // onAuthStateChange does propagate across tabs eventually, but the
    // `storage` event fires synchronously the moment localStorage changes,
    // closing the stale-render window. The `storage` event only fires in
    // OTHER tabs (not the one that wrote the change), so we won't loop.
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== NAV_PROFILE_CACHE_KEY) return;
      if (e.newValue === null) {
        isLoggedInRef.current = false;
        setIsLoggedIn(false);
        setUserProfile(null);
        setHasUnloggedActivity(false);
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener("profile-updated", handleProfileUpdated);
      window.removeEventListener("streak-updated", checkTodayLogged);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("storage", handleStorage);
    };
  }, [checkTodayLogged, initialIsLoggedIn]);

  // Close dropdown when clicking outside or pressing Escape. Escape also
  // returns focus to the trigger so keyboard users land somewhere sensible
  // instead of falling off the menu.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setProfileDropdownOpen(false);
        avatarTriggerRef.current?.focus();
      }
    }
    if (profileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [profileDropdownOpen]);

  // Same outside-click + Escape handling for the Explore dropdown.
  useEffect(() => {
    if (!exploreOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (exploreRef.current && !exploreRef.current.contains(e.target as Node)) {
        setExploreOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setExploreOpen(false);
        exploreTriggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [exploreOpen]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setUserProfile(null);
    writeCachedNavProfile(null);
    setProfileDropdownOpen(false);
    router.push("/");
  };

  const initials = userProfile?.username
    ? userProfile.username.slice(0, 2).toUpperCase()
    : "";

  return (
    <nav
      className="sticky top-0 z-50"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderBottom: "2px solid var(--border-hard)",
      }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          onClick={(e) => {
            // Next's <Link> is a no-op when the href matches the current
            // route, so clicking the logo on "/" wouldn't scroll back up.
            if (pathname === "/") {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
        >
          <Image src="/logo.png" alt="VibeTalent" width={36} height={36} className="object-contain" />
          <span className="text-lg font-extrabold uppercase tracking-tight" style={{ color: "var(--foreground)" }}>
            Vibe Talent
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-1">
          {/* Explore dropdown — state-driven so it works with both pointer and
              keyboard users (the previous group-hover:flex left keyboard users
              with no way to open the menu). Mouse hover still opens it via
              onMouseEnter; click toggles; Escape closes and restores focus. */}
          <div
            className="relative"
            ref={exploreRef}
            onMouseEnter={() => setExploreOpen(true)}
            onMouseLeave={() => setExploreOpen(false)}
          >
            <button
              ref={exploreTriggerRef}
              type="button"
              onClick={() => setExploreOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={exploreOpen}
              className="flex items-center gap-1 px-4 py-2 text-sm font-bold uppercase tracking-wide transition-colors"
              style={{
                color: pathname === "/explore" || pathname === "/projects" ? "var(--accent)" : "var(--foreground)",
                borderBottom: pathname === "/explore" || pathname === "/projects" ? "2px solid var(--accent)" : "2px solid transparent",
              }}
            >
              Explore <ChevronDown size={12} />
            </button>
            <div
              role="menu"
              className={`absolute left-0 top-full mt-0 ${exploreOpen ? "flex" : "hidden"} flex-col min-w-[160px] py-1 z-50`}
              style={{
                border: "2px solid var(--border-hard)",
                boxShadow: "var(--shadow-brutal-sm)",
                backgroundColor: "var(--bg-surface)",
              }}
            >
              {exploreSubLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  role="menuitem"
                  onClick={() => setExploreOpen(false)}
                  className="px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors hover:bg-[var(--accent)]/10"
                  style={{
                    color: pathname === link.href ? "var(--accent)" : "var(--foreground)",
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative px-4 py-2 text-sm font-bold uppercase tracking-wide transition-colors"
              style={{
                color: pathname === link.href ? "var(--accent)" : "var(--foreground)",
                borderBottom: pathname === link.href ? "2px solid var(--accent)" : "2px solid transparent",
              }}
            >
              {link.label}
              {link.href === "/dashboard" && hasUnloggedActivity && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: "var(--accent)" }}
                  role="status"
                  aria-label="No activity logged today"
                  title="No activity logged today"
                />
              )}
            </Link>
          ))}
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-brutal ml-2 text-xs py-1.5 px-3 font-bold uppercase tracking-wide whitespace-nowrap"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--text-on-inverted)",
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal-sm)",
            }}
          >
            Docs
          </a>
          <div className="ml-2">
            <ThemeToggle />
          </div>
          {!authMounted ? (
            // Reserves the CTA's footprint until the cache check resolves
            // the auth state. Width chosen to roughly match the "Create
            // Profile" button so anonymous viewers don't see a layout
            // shift when the gate opens; logged-in users see the avatar
            // slot in (smaller, still no shift since it's right-aligned).
            <div
              className="ml-3"
              aria-hidden="true"
              style={{ width: 144, height: 40 }}
            />
          ) : isLoggedIn ? (
            <>
            <div className="ml-3">
              <NotificationBell />
            </div>
            {/* Profile Avatar Dropdown */}
            <div className="relative ml-3" ref={dropdownRef}>
              <button
                ref={avatarTriggerRef}
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                aria-label="Profile menu"
                aria-expanded={profileDropdownOpen}
                aria-haspopup="true"
                className="flex items-center justify-center overflow-hidden"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  border: "2px solid var(--border-hard)",
                  backgroundColor: "var(--bg-inverted)",
                  cursor: "pointer",
                }}
              >
                <ProfileAvatar
                  avatarUrl={userProfile?.avatar_url}
                  username={userProfile?.username}
                  initials={initials}
                  size={48}
                />
              </button>
              {userProfile?.github_username && (
                <BadgeCheck
                  size={18}
                  strokeWidth={2.5}
                  className="text-white fill-[#1D9BF0] absolute -bottom-0.5 -right-0.5 pointer-events-none"
                  style={{ filter: "drop-shadow(0 0 2px var(--bg-base))" }}
                  aria-label="GitHub verified"
                />
              )}
              {userProfile && !userProfile.display_name && (
                <span
                  className="absolute -top-0.5 -right-0.5 pointer-events-none"
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    backgroundColor: "var(--accent)",
                    border: "2px solid var(--bg-base)",
                  }}
                  aria-label="Profile needs completion"
                  title="Complete your profile"
                />
              )}
              {profileDropdownOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-12 z-50 w-48"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    border: "2px solid var(--border-hard)",
                    boxShadow: "var(--shadow-brutal-sm)",
                  }}
                >
                  <Link
                    href={`/profile/${userProfile?.username || ""}`}
                    role="menuitem"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors"
                    style={{ color: "var(--foreground)" }}
                  >
                    <User size={16} />
                    My Profile
                  </Link>
                  <Link
                    href={`/profile/${userProfile?.username || ""}/achievements`}
                    role="menuitem"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors"
                    style={{ color: "var(--foreground)" }}
                  >
                    <Trophy size={16} />
                    Achievements
                  </Link>
                  <Link
                    href={userProfile && !userProfile.display_name ? "/settings?complete=name" : "/settings"}
                    role="menuitem"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors"
                    style={{ color: "var(--foreground)" }}
                  >
                    <Settings size={16} />
                    <span>Settings</span>
                    {userProfile && !userProfile.display_name && (
                      <span
                        className="ml-auto flex items-center gap-1 text-[10px] font-extrabold uppercase"
                        style={{ color: "var(--accent)" }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            backgroundColor: "var(--accent)",
                            display: "inline-block",
                          }}
                        />
                        1 to do
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/settings#referral"
                    role="menuitem"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors"
                    style={{ color: "var(--foreground)" }}
                  >
                    <Users size={16} />
                    Referral
                  </Link>
                  {TOUR_FLAG_ENABLED && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        // Reset the seen flag and arm the trigger.
                        resetTourForReplay();
                        setProfileDropdownOpen(false);
                        // If we're already on /dashboard, router.push is a
                        // no-op (Next.js doesn't remount on same-route nav)
                        // so the dashboard's mount-only effect never re-runs.
                        // Dispatch a custom event the dashboard listens for
                        // and it consumes the armed key in-place. From any
                        // other route, the normal push triggers a full mount.
                        if (pathname === "/dashboard") {
                          window.dispatchEvent(new Event("vibetalent-tour-replay"));
                        } else {
                          router.push("/dashboard");
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors w-full text-left"
                      style={{ color: "var(--foreground)" }}
                    >
                      <Sparkles size={16} />
                      Replay tour
                    </button>
                  )}
                  <div style={{ borderTop: "2px solid var(--border-hard)" }} />
                  <button
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors w-full text-left"
                    style={{ color: "var(--foreground)" }}
                  >
                    <LogOut size={16} />
                    Log out
                  </button>
                </div>
              )}
            </div>
            </>
          ) : (
            <Link
              href="/auth/signup"
              className="btn-brutal btn-brutal-primary ml-3 text-sm py-2 px-5"
            >
              Create Profile
            </Link>
          )}
        </div>

        {/* Mobile toggle */}
        <div className="flex items-center gap-2 sm:hidden">
          <ThemeToggle />
          {authMounted && isLoggedIn && <NotificationBell />}
          {authMounted && isLoggedIn && userProfile && (
            <Link
              href={`/profile/${userProfile.username}`}
              aria-label="Profile"
              className="flex items-center justify-center overflow-hidden"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "2px solid var(--border-hard)",
                backgroundColor: "var(--bg-inverted)",
              }}
            >
              <ProfileAvatar
                avatarUrl={userProfile.avatar_url}
                username={userProfile.username}
                initials={initials}
                size={36}
              />
            </Link>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ color: "var(--foreground)" }}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div
          className="sm:hidden px-4 pb-4"
          style={{
            borderTop: "2px solid var(--border-hard)",
            backgroundColor: "var(--bg-surface)",
          }}
        >
          {/* Mobile: Show avatar + username at top if logged in */}
          {isLoggedIn && userProfile && (
            <div className="flex items-center gap-3 py-3 mb-1" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div
                className="flex items-center justify-center overflow-hidden"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: "2px solid var(--border-hard)",
                  backgroundColor: "var(--bg-inverted)",
                }}
              >
                <ProfileAvatar
                  avatarUrl={userProfile.avatar_url}
                  username={userProfile.username}
                  initials={initials}
                  size={36}
                />
              </div>
              <span className="text-sm font-extrabold text-[var(--foreground)] flex items-center gap-1">
                {userProfile.username}
                {userProfile.github_username && (
                  <BadgeCheck
                    size={14}
                    strokeWidth={2.5}
                    className="text-white fill-[#1D9BF0] shrink-0"
                    aria-label="GitHub verified"
                  />
                )}
              </span>
            </div>
          )}

          {/* Explore sub-links in mobile */}
          {exploreSubLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="relative inline-block px-4 py-3 text-sm font-bold uppercase tracking-wide"
              style={{
                color: pathname === link.href ? "var(--accent)" : "var(--foreground)",
              }}
            >
              {link.label === "Talent" ? "Explore Talent" : "Explore Projects"}
            </Link>
          ))}
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="relative inline-block px-4 py-3 text-sm font-bold uppercase tracking-wide"
              style={{
                color: pathname === link.href ? "var(--accent)" : "var(--foreground)",
              }}
            >
              {link.label}
              {link.href === "/dashboard" && hasUnloggedActivity && (
                <span
                  className="inline-block w-2 h-2 rounded-full ml-1.5 align-middle"
                  style={{ backgroundColor: "var(--accent)" }}
                  role="status"
                  aria-label="No activity logged today"
                  title="No activity logged today"
                />
              )}
            </Link>
          ))}
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileOpen(false)}
            className="block px-4 py-3 text-sm font-bold uppercase tracking-wide"
            style={{ color: "var(--accent)" }}
          >
            How to Use
          </a>
          {isLoggedIn ? (
            <>
            {userProfile && (
              <>
                <Link
                  href={`/profile/${userProfile.username}`}
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 mt-1 text-sm font-bold uppercase tracking-wide text-[var(--foreground)]"
                >
                  My Profile
                </Link>
                <Link
                  href={`/profile/${userProfile.username}/achievements`}
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-bold uppercase tracking-wide text-[var(--foreground)]"
                >
                  Achievements
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-bold uppercase tracking-wide text-[var(--foreground)]"
                >
                  Settings
                </Link>
                <Link
                  href="/settings#referral"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-bold uppercase tracking-wide text-[var(--foreground)]"
                >
                  Referral
                </Link>
                {TOUR_FLAG_ENABLED && (
                  <button
                    type="button"
                    onClick={() => {
                      // See desktop button above for the same-route rationale.
                      resetTourForReplay();
                      setMobileOpen(false);
                      if (pathname === "/dashboard") {
                        window.dispatchEvent(new Event("vibetalent-tour-replay"));
                      } else {
                        router.push("/dashboard");
                      }
                    }}
                    className="block w-full text-left px-4 py-3 text-sm font-bold uppercase tracking-wide text-[var(--foreground)]"
                  >
                    Replay tour
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => { handleLogout(); setMobileOpen(false); }}
              className="btn-brutal mt-2 w-full justify-center text-sm py-2.5 flex items-center gap-2"
              style={{
                backgroundColor: "var(--bg-inverted)",
                color: "var(--text-on-inverted)",
                border: "2px solid var(--border-hard)",
              }}
            >
              <LogOut size={14} />
              Log out
            </button>
            </>
          ) : (
            <Link
              href="/auth/signup"
              onClick={() => setMobileOpen(false)}
              className="btn-brutal btn-brutal-primary mt-2 w-full justify-center text-sm py-2.5"
            >
              Create Profile
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
