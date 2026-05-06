"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface HeroCTAClientProps {
  className?: string;
  style?: React.CSSProperties;
  initialIsLoggedIn: boolean;
}

export function HeroCTAClient({ className = "", style, initialIsLoggedIn }: HeroCTAClientProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(initialIsLoggedIn);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    // Re-confirm on mount in case the cookie changed between SSR and hydration.
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled) setIsLoggedIn(!!user);
    });

    // Stay in sync with later auth changes (sign-in/out in another tab) so the
    // CTA label doesn't drift from the navbar.
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
      href="/dashboard"
      className={`btn-brutal btn-brutal-primary text-base flex items-center gap-2 ${className}`}
      style={style}
    >
      {isLoggedIn ? "Go to Dashboard" : "Create Your Profile"}
      <ArrowRight size={18} />
    </Link>
  );
}
