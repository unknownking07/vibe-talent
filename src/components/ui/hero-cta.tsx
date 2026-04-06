"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface HeroCTAProps {
  className?: string;
  style?: React.CSSProperties;
}

export function HeroCTA({ className = "", style }: HeroCTAProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
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
