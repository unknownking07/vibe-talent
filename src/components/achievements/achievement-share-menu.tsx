"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Share2,
  Link as LinkIcon,
  Download,
  ImageIcon,
  Check,
  X,
} from "lucide-react";

interface AchievementShareMenuProps {
  username: string;
  achievementId: string;
  title: string;
}

type Status =
  | "idle"
  | "copying-image"
  | "image-copied"
  | "image-error"
  | "downloading"
  | "downloaded"
  | "copying-link"
  | "link-copied"
  | "error";

export function AchievementShareMenu({ username, achievementId, title }: AchievementShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Memoized, de-duped fetch of the generated share image. Warmed when the
  // menu opens so Copy/Download resolve instantly instead of kicking off a
  // multi-second OG render on click.
  const imageBlobRef = useRef<Promise<Blob> | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const sharePath = `/share/achievement/${encodeURIComponent(username)}/${encodeURIComponent(achievementId)}`;
  const imagePath = `/api/og/achievement/${encodeURIComponent(username)}/${encodeURIComponent(achievementId)}`;

  // Fetch the share image once and reuse the in-flight/resolved promise for
  // both Copy and Download. On failure we drop the cached rejection so a
  // later click can retry cleanly.
  const fetchImageBlob = useCallback((): Promise<Blob> => {
    if (!imageBlobRef.current) {
      imageBlobRef.current = fetch(imagePath)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.blob();
        })
        .catch((err) => {
          imageBlobRef.current = null;
          throw err;
        });
    }
    return imageBlobRef.current;
  }, [imagePath]);

  // Warm the image as soon as the menu opens so the OG render overlaps the
  // user reading the menu rather than blocking their click on Copy/Download.
  useEffect(() => {
    if (!open) return;
    void fetchImageBlob().catch(() => {});
  }, [open, fetchImageBlob]);

  async function copyImage() {
    setStatus("copying-image");
    try {
      // Reuse the prewarmed fetch. ClipboardItem must be created synchronously
      // in the gesture for Safari — passing the Promise (even one already in
      // flight) satisfies that. Firefox lacks image clipboard support and will
      // throw; we surface that and let the user fall back to Download.
      const blobPromise = fetchImageBlob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blobPromise }),
      ]);
      setStatus("image-copied");
      setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("image-error");
      setTimeout(() => setStatus("idle"), 2200);
    }
  }

  async function downloadImage() {
    setStatus("downloading");
    try {
      const blob = await fetchImageBlob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `vibetalent-${username}-${achievementId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      setStatus("downloaded");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 1500);
    }
  }

  async function copyLink() {
    setStatus("copying-link");
    try {
      const url = new URL(sharePath, window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      setStatus("link-copied");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 1500);
    }
  }

  function shareOnX() {
    const text = `I just earned the "${title}" achievement on VibeTalent`;
    const url = new URL(sharePath, window.location.origin).toString();
    const intent = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Share ${title} achievement`}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide"
        style={{
          backgroundColor: "var(--accent, #FF3A00)",
          color: "#FFFFFF",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal-xs, 2px 2px 0 var(--border-hard))",
          cursor: "pointer",
        }}
      >
        <Share2 size={11} strokeWidth={3} />
        Share
      </button>
      {open ? (
        <div
          className="absolute right-0 top-9 z-20 w-56"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <button
            type="button"
            onClick={copyImage}
disabled={status === "copying-image"}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide"
            style={{ color: "var(--foreground)" }}
          >
            {status === "image-copied" ? (
              <Check size={14} strokeWidth={3} />
            ) : (
              <ImageIcon size={14} strokeWidth={2.5} />
            )}
            {status === "copying-image"
              ? "Copying…"
              : status === "image-copied"
                ? "Image copied"
                : "Copy image"}
          </button>
          <button
            type="button"
            onClick={downloadImage}
disabled={status === "downloading"}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide"
            style={{ color: "var(--foreground)" }}
          >
            {status === "downloaded" ? (
              <Check size={14} strokeWidth={3} />
            ) : (
              <Download size={14} strokeWidth={2.5} />
            )}
            {status === "downloading"
              ? "Preparing…"
              : status === "downloaded"
                ? "Saved"
                : "Download PNG"}
          </button>
          <button
            type="button"
            onClick={copyLink}
disabled={status === "copying-link"}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide"
            style={{ color: "var(--foreground)" }}
          >
            {status === "link-copied" ? (
              <Check size={14} strokeWidth={3} />
            ) : (
              <LinkIcon size={14} strokeWidth={2.5} />
            )}
            {status === "link-copied" ? "Link copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={shareOnX}
className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide"
            style={{ color: "var(--foreground)" }}
          >
            <span aria-hidden="true" className="text-[15px] leading-none">𝕏</span>
            Share on X
          </button>
          {status === "image-error" ? (
            <div
              className="flex items-center gap-2 px-3 py-2 text-[10px] font-extrabold uppercase"
              style={{ color: "var(--accent, #FF3A00)" }}
            >
              <X size={12} strokeWidth={3} />
              Browser blocked image copy — try Download
            </div>
          ) : null}
          {status === "error" ? (
            <div
              className="flex items-center gap-2 px-3 py-2 text-[10px] font-extrabold uppercase"
              style={{ color: "var(--accent, #FF3A00)" }}
            >
              <X size={12} strokeWidth={3} />
              Something went wrong
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
