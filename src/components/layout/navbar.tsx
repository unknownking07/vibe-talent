"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Flame, Menu, X, LogOut, Settings, User, Users } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/ui/notification-bell";

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
    // Check auth once on mount, then listen for changes
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setIsLoggedIn(!!user);
      if (user) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: profile, error } = await (supabase as any)
            .from("users")
            .select("username, avatar_url")
            .eq("id", user.id)
            .single();
          if (error) console.error("Navbar profile fetch error:", error);
          if (profile) {
            setUserProfile({ username: profile.username, avatar_url: profile.avatar_url });
          }
        } catch (err) {
          console.error("Navbar profile fetch failed:", err);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setIsLoggedIn(!!session?.user);
      if (session?.user) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: profile } = await (supabase as any)
            .from("users")
            .select("username, avatar_url")
            .eq("id", session.user.id)
            .single();
          if (profile) {
            setUserProfile({ username: profile.username, avatar_url: profile.avatar_url });
          }
        } catch (err) {
          console.error("Navbar auth change profile fetch failed:", err);
        }
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
        backgroundColor: "#FFFFFF",
        borderBottom: "2px solid #0F0F0F",
      }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center"
            style={{
              backgroundColor: "var(--accent)",
              border: "2px solid #0F0F0F",
              boxShadow: "3px 3px 0 #0F0F0F",
            }}
          >
            <Flame size={18} className="text-white" />
          </div>
          <span className="text-lg font-extrabold uppercase tracking-tight text-[#0F0F0F]">
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
                color: pathname === link.href ? "var(--accent)" : "#0F0F0F",
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
              color: "#FFFFFF",
              border: "2px solid #0F0F0F",
              boxShadow: "var(--shadow-brutal-sm)",
            }}
          >
            Docs
          </a>
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
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "2px solid #0F0F0F",
                  backgroundColor: "#0F0F0F",
                  cursor: "pointer",
                }}
              >
                {userProfile?.avatar_url ? (
                  <Image
                    src={userProfile.avatar_url}
                    alt={userProfile.username}
                    width={44}
                    height={44}
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
                    backgroundColor: "#FFFFFF",
                    border: "2px solid #0F0F0F",
                    boxShadow: "var(--shadow-brutal-sm)",
                  }}
                >
                  <Link
                    href={`/profile/${userProfile?.username || ""}`}
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wide text-[#0F0F0F] hover:bg-[#F4F4F5] transition-colors"
                  >
                    <User size={16} />
                    My Profile
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wide text-[#0F0F0F] hover:bg-[#F4F4F5] transition-colors"
                  >
                    <Settings size={16} />
                    Settings
                  </Link>
                  <Link
                    href="/settings#referral"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wide text-[#0F0F0F] hover:bg-[#F4F4F5] transition-colors"
                  >
                    <Users size={16} />
                    Referral
                  </Link>
                  <div style={{ borderTop: "2px solid #0F0F0F" }} />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wide text-[#0F0F0F] hover:bg-[#F4F4F5] transition-colors w-full text-left"
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
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="sm:hidden text-[#0F0F0F]"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div
          className="sm:hidden px-4 pb-4"
          style={{
            borderTop: "2px solid #0F0F0F",
            backgroundColor: "#FFFFFF",
          }}
        >
          {/* Mobile: Show avatar + username at top if logged in */}
          {isLoggedIn && userProfile && (
            <div className="flex items-center gap-3 py-3 mb-1" style={{ borderBottom: "1px solid #E4E4E7" }}>
              <div
                className="flex items-center justify-center overflow-hidden"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: "2px solid #0F0F0F",
                  backgroundColor: "#0F0F0F",
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
              <span className="text-sm font-extrabold text-[#0F0F0F]">{userProfile.username}</span>
            </div>
          )}

          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block px-4 py-3 text-sm font-bold uppercase tracking-wide"
              style={{
                color: pathname === link.href ? "var(--accent)" : "#0F0F0F",
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
              <span className="text-sm font-bold uppercase tracking-wide text-[#0F0F0F]">Notifications</span>
            </div>
            {userProfile && (
              <>
                <Link
                  href={`/profile/${userProfile.username}`}
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 mt-1 text-sm font-bold uppercase tracking-wide text-[#0F0F0F]"
                >
                  My Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-bold uppercase tracking-wide text-[#0F0F0F]"
                >
                  Settings
                </Link>
                <Link
                  href="/settings#referral"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-bold uppercase tracking-wide text-[#0F0F0F]"
                >
                  Referral
                </Link>
              </>
            )}
            <button
              onClick={() => { handleLogout(); setMobileOpen(false); }}
              className="btn-brutal mt-2 w-full justify-center text-sm py-2.5 flex items-center gap-2"
              style={{
                backgroundColor: "#0F0F0F",
                color: "#FFFFFF",
                border: "2px solid #0F0F0F",
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
