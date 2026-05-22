"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Client-only auth check so the homepage can still render from the ISR cache
// (see hero-cta.tsx for the same reasoning). Logged-in users land on
// /dashboard; everyone else goes through /auth/signup.
export function EndGameLadderCTA() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled) setIsLoggedIn(!!user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!cancelled) setIsLoggedIn(!!session?.user);
      },
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <Link
      href={isLoggedIn ? "/dashboard" : "/auth/signup"}
      className="btn-brutal btn-brutal-primary text-sm sm:text-base inline-flex"
    >
      Start your streak today
      <ArrowRight size={16} />
    </Link>
  );
}
