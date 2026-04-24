"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut, Settings, User, Users, BadgeCheck, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/ui/notification-bell";
import { ThemeToggle } from "@/components/ui/theme-toggle";

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

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<{ username: string; avatar_url: string | null; github_username: string | null; display_name: string | null } | null>(null);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const checkUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setHasUnreadNotifications((data.unread_count || 0) > 0);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    async function fetchProfile(userId: string, email?: string) {
      try {
        const { data: profile, error } = await sb
          .from("users")
          .select("username, avatar_url, github_username, display_name")
          .eq("id", userId)
          .single();
        if (error) console.error("Navbar profile fetch error:", error);
        if (profile && profile.username) {
          setUserProfile({
            username: profile.username,
            avatar_url: profile.avatar_url,
            github_username: profile.github_username || null,
            display_name: profile.display_name || null,
          });
        } else if (email) {
          // Fallback: use email prefix as display name
          setUserProfile({ username: email.split("@")[0], avatar_url: null, github_username: null, display_name: null });
        }
      } catch (err) {
        console.error("Navbar profile fetch failed:", err);
        if (email) {
          setUserProfile({ username: email.split("@")[0], avatar_url: null, github_username: null, display_name: null });
        }
      }
    }

    // Check auth once on mount, then listen for changes
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
      if (user) {
        fetchProfile(user.id, user.email);
        checkUnread();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email);
      } else {
        setUserProfile(null);
      }
    });

    // Refetch the profile whenever something in the app saves it (e.g. the
    // settings page saves a display name). Without this, the onboarding dot
    // would only clear on a full reload.
    const handleProfileUpdated = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) fetchProfile(user.id, user.email);
    };
    window.addEventListener("profile-updated", handleProfileUpdated);

    // Refresh the Dashboard-link dot when notifications change (e.g. after
    // the user logs activity, which marks streak_warning notifications read).
    // Without this, the dot only clears on a hard refresh.
    window.addEventListener("notifications-updated", checkUnread);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("profile-updated", handleProfileUpdated);
      window.removeEventListener("notifications-updated", checkUnread);
    };
  }, [checkUnread]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    if (profileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileDropdownOpen]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setUserProfile(null);
    setProfileDropdownOpen(false);
    router.push("/");
  };

  const initials = userProfile?.username
    ? userProfile.username.slice(0, 2).toUpperCase()
    : "??";

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
          {/* Explore dropdown */}
          <div className="relative group">
            <button
              className="flex items-center gap-1 px-4 py-2 text-sm font-bold uppercase tracking-wide transition-colors"
              style={{
                color: pathname === "/explore" || pathname === "/projects" ? "var(--accent)" : "var(--foreground)",
                borderBottom: pathname === "/explore" || pathname === "/projects" ? "2px solid var(--accent)" : "2px solid transparent",
              }}
            >
              Explore <ChevronDown size={12} />
            </button>
            <div
              className="absolute left-0 top-full mt-0 hidden group-hover:flex flex-col min-w-[160px] py-1 z-50"
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
              {link.href === "/dashboard" && hasUnreadNotifications && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: "var(--accent)" }}
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
          {isLoggedIn ? (
            <>
            <div className="ml-3">
              <NotificationBell />
            </div>
            {/* Profile Avatar Dropdown */}
            <div className="relative ml-3" ref={dropdownRef}>
              <button
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
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors"
                    style={{ color: "var(--foreground)" }}
                  >
                    <User size={16} />
                    My Profile
                  </Link>
                  <Link
                    href={userProfile && !userProfile.display_name ? "/settings?complete=name" : "/settings"}
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
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors"
                    style={{ color: "var(--foreground)" }}
                  >
                    <Users size={16} />
                    Referral
                  </Link>
                  <div style={{ borderTop: "2px solid var(--border-hard)" }} />
                  <button
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
          {isLoggedIn && <NotificationBell />}
          {isLoggedIn && userProfile && (
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
              {link.href === "/dashboard" && hasUnreadNotifications && (
                <span
                  className="inline-block w-2 h-2 rounded-full ml-1.5 align-middle"
                  style={{ backgroundColor: "var(--accent)" }}
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
