"use client";

import { useState } from "react";

interface ShareButtonProps {
  url: string;
  text: string;
  /** Optional. When provided, renders a "Copy image" button that copies this image to clipboard. */
  imageUrl?: string;
}

type Status = "idle" | "copying" | "copied-link" | "copied-image" | "image-error";

export function ShareButton({ url, text, imageUrl }: ShareButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  const absUrl = typeof window !== "undefined" ? new URL(url, window.location.origin).toString() : url;
  const absImageUrl = imageUrl && typeof window !== "undefined" ? new URL(imageUrl, window.location.origin).toString() : imageUrl;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(absUrl);
      setStatus("copied-link");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      // Best-effort fallback: select text via prompt — rare on modern browsers
      setStatus("idle");
    }
  }

  async function copyImage() {
    if (!absImageUrl) return;
    setStatus("copying");
    try {
      const res = await fetch(absImageUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      // Clipboard API in some browsers requires a PNG specifically.
      // ImageResponse from next/og emits image/png.
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setStatus("copied-image");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (e) {
      console.error("copy image failed:", e);
      setStatus("image-error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <a
        href={`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(absUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-[var(--bg-inverted)] text-white px-4 py-2 text-[13px] font-extrabold rounded-sm hover:opacity-90"
      >
        Share on X →
      </a>

      {absImageUrl && (
        <button
          onClick={copyImage}
          disabled={status === "copying"}
          className="bg-[var(--accent)] text-white px-4 py-2 text-[13px] font-extrabold rounded-sm hover:opacity-90 disabled:opacity-60"
          aria-label="Copy receipt image to clipboard"
        >
          {status === "copying" ? "Copying…"
            : status === "copied-image" ? "Image copied ✓"
            : status === "image-error" ? "Couldn’t copy"
            : "Copy image"}
        </button>
      )}

      <button
        onClick={copyLink}
        className="bg-[var(--bg-surface)] text-[var(--foreground)] border-2 border-[var(--border-hard)] px-4 py-2 text-[13px] font-extrabold rounded-sm hover:bg-[var(--bg-surface-light)]"
        aria-label="Copy share link"
      >
        {status === "copied-link" ? "Link copied ✓" : "Copy link"}
      </button>
    </div>
  );
}
