"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Flame, Menu, X, LogOut, Settings, User, Users } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/ui/notification-bell";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const navLinks = [
  { href: "/explore", label: "Explore" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/agent", label: "AI Agents" },
  { href: "/dashboard", label: "Dashboard" },
];

const DOCS_URL = "https://vibe-talent.gitbook.io/untitled";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<{ username: string; avatar_url: string | null } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    async function fetchProfile(userId: string, email?: string) {
      try {
        const { data: profile, error } = await sb
          .from("users")
          .select("username, avatar_url")
          .eq("id", userId)
          .single();
        if (error) console.error("Navbar profile fetch error:", error);
        if (profile && profile.username) {
          setUserProfile({ username: profile.username, avatar_url: profile.avatar_url });
        } else if (email) {
          // Fallback: use email prefix as display name
          setUserProfile({ username: email.split("@")[0], avatar_url: null });
        }
      } catch (err) {
        console.error("Navbar profile fetch failed:", err);
        if (email) {
          setUserProfile({ username: email.split("@")[0], avatar_url: null });
        }
      }
    }

    // Check auth once on mount, then listen for changes
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
      if (user) {
        fetchProfile(user.id, user.email);
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

    return () => subscription.unsubscribe();
  }, []);

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
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center"
            style={{
              backgroundColor: "var(--accent)",
              border: "2px solid var(--border-hard)",
              boxShadow: "3px 3px 0 var(--shadow-brutal-sm)",
            }}
          >
            <Flame size={18} className="text-white" />
          </div>
          <span className="text-lg font-extrabold uppercase tracking-tight" style={{ color: "var(--foreground)" }}>
            VibeTalent
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-1">
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
                {userProfile?.avatar_url ? (
                  <Image
                    src={userProfile.avatar_url}
                    alt={userProfile.username}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                    style={{ borderRadius: "50%" }}
                  />
                ) : (
                  <span className="text-sm font-extrabold text-white">{initials}</span>
                )}
              </button>
              {profileDropdownOpen && (
                <div
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
                    href="/settings"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors"
                    style={{ color: "var(--foreground)" }}
                  >
                    <Settings size={16} />
                    Settings
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
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ color: "var(--foreground)" }}
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
                {userProfile.avatar_url ? (
                  <Image
                    src={userProfile.avatar_url}
                    alt={userProfile.username}
                    width={36}
                    height={36}
                    className="w-full h-full object-cover"
                    style={{ borderRadius: "50%" }}
                  />
                ) : (
                  <span className="text-xs font-extrabold text-white">{initials}</span>
                )}
              </div>
              <span className="text-sm font-extrabold text-[var(--foreground)]">{userProfile.username}</span>
            </div>
          )}

          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block px-4 py-3 text-sm font-bold uppercase tracking-wide"
              style={{
                color: pathname === link.href ? "var(--accent)" : "var(--foreground)",
              }}
            >
              {link.label}
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
            <div className="mt-2 flex items-center gap-3">
              <NotificationBell />
              <span className="text-sm font-bold uppercase tracking-wide text-[var(--foreground)]">Notifications</span>
            </div>
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
