"use client";

import { useState } from "react";

export function ShareButton({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const absUrl = typeof window !== "undefined" ? new URL(url, window.location.origin).toString() : url;

  return (
    <div className="flex gap-2 flex-wrap">
      <a
        href={`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(absUrl)}`}
        target="_blank" rel="noopener noreferrer"
        className="bg-[var(--bg-inverted)] text-white px-4 py-2 text-[13px] font-extrabold rounded-sm hover:opacity-90"
      >Share on X →</a>
      <a
        href={`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(absUrl)}`}
        target="_blank" rel="noopener noreferrer"
        className="bg-[var(--bg-inverted)] text-white px-4 py-2 text-[13px] font-extrabold rounded-sm hover:opacity-90"
      >Cast on Farcaster →</a>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(absUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="bg-[var(--accent)] text-white px-4 py-2 text-[13px] font-extrabold rounded-sm hover:opacity-90"
      >{copied ? "Copied ✓" : "Copy link"}</button>
    </div>
  );
}
