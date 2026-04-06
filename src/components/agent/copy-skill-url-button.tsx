"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopySkillUrlButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const url = `${window.location.origin}/skill.md`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="btn-brutal text-sm flex items-center gap-2 transition-all"
      style={{ backgroundColor: copied ? "#16A34A" : "var(--bg-inverted)", color: "var(--text-on-inverted)" }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied!" : "Copy Skill URL"}
    </button>
  );
}
