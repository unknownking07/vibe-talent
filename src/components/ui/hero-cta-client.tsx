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
    // Re-confirm on mount in case the cookie changed between SSR and hydration
    // (e.g. logged out in another tab). State setter is a no-op when unchanged.
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
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
