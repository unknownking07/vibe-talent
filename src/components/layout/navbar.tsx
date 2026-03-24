"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Flame, Menu, X, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/ui/notification-bell";

const navLinks = [
  { href: "/explore", label: "Explore" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/agent", label: "AI Agents" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // Check auth once on mount, then listen for changes
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    router.push("/");
  };

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
          {isLoggedIn ? (
            <>
            <div className="ml-3">
              <NotificationBell />
            </div>
            <button
              onClick={handleLogout}
              className="btn-brutal ml-3 text-sm py-2 px-5 flex items-center gap-2"
              style={{
                backgroundColor: "#0F0F0F",
                color: "#FFFFFF",
                border: "2px solid #0F0F0F",
                boxShadow: "var(--shadow-brutal-sm)",
              }}
            >
              <LogOut size={14} />
              Logout
            </button>
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
          {isLoggedIn ? (
            <>
            <div className="mt-2 flex items-center gap-3">
              <NotificationBell />
              <span className="text-sm font-bold uppercase tracking-wide text-[#0F0F0F]">Notifications</span>
            </div>
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
              Logout
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
