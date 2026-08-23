"use client";

import { useRef, useState } from "react";

import { getSiteUrl } from "@/lib/seo";

interface ShareButtonProps {
  url: string;
  text: string;
  /** Optional. When provided, renders a "Copy image" button that copies this image to clipboard. */
  imageUrl?: string;
}

type Status =
  "idle" | "copying" | "copied-link" | "copied-image" | "image-error";

export function ShareButton({ url, text, imageUrl }: ShareButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  // Resolved against the build-inlined site URL rather than window.location,
  // which is identical on server and client. Branching on `typeof window` gave
  // the server a relative href and the client an absolute one — a hydration
  // mismatch, and worse, a share link that was broken for anyone who clicked
  // before hydration.
  const origin = getSiteUrl();
  const absUrl = new URL(url, origin).toString();
  const absImageUrl = imageUrl
    ? new URL(imageUrl, origin).toString()
    : imageUrl;

  // Hold the (in-flight) image blob so a hover/focus can start generating it
  // before the click — the copy then resolves an already-warm promise instead
  // of waiting on a cold Satori render. Null until warmed.
  const blobRef = useRef<Promise<Blob> | null>(null);
  function fetchBlob(u: string): Promise<Blob> {
    return fetch(u).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.blob();
    });
  }
  function prewarm() {
    if (!absImageUrl || blobRef.current) return;
    const p = fetchBlob(absImageUrl);
    blobRef.current = p;
    // Drop a failed warm so the click can retry from scratch.
    void p.catch(() => {
      if (blobRef.current === p) blobRef.current = null;
    });
  }

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
    // Reuse the prewarmed blob if present; otherwise start now. The
    // ClipboardItem is built synchronously with the promise so Safari keeps it
    // tied to the click gesture. next/og emits image/png.
    const blobPromise =
      blobRef.current ?? (blobRef.current = fetchBlob(absImageUrl));
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blobPromise }),
      ]);
      setStatus("copied-image");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (e) {
      console.error("copy image failed:", e);
      blobRef.current = null; // allow a fresh retry
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
        className="bg-[var(--bg-inverted)] text-white px-4 py-2 text-[13px] font-semibold rounded-xl hover:opacity-90"
      >
        Share on X →
      </a>

      {absImageUrl && (
        <button
          onClick={copyImage}
          onMouseEnter={prewarm}
          onFocus={prewarm}
          onPointerDown={prewarm}
          disabled={status === "copying"}
          className="bg-[var(--accent)] text-white px-4 py-2 text-[13px] font-semibold rounded-xl hover:opacity-90 disabled:opacity-60"
          aria-label="Copy receipt image to clipboard"
        >
          {status === "copying"
            ? "Copying…"
            : status === "copied-image"
              ? "Image copied ✓"
              : status === "image-error"
                ? "Couldn’t copy"
                : "Copy image"}
        </button>
      )}

      <button
        onClick={copyLink}
        className="bg-[var(--bg-surface)] text-[var(--foreground)] border border-[var(--border-hard)] px-4 py-2 text-[13px] font-semibold rounded-xl hover:bg-[var(--bg-surface-light)]"
        aria-label="Copy share link"
      >
        {status === "copied-link" ? "Link copied ✓" : "Copy link"}
      </button>
    </div>
  );
}
