"use client";

import { useEffect, useRef, useState } from "react";
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

  async function copyImage() {
    setStatus("copying-image");
    try {
      // Safari requires the ClipboardItem to be created synchronously
      // in the user-gesture handler — pass the Promise directly.
      const blobPromise = fetch(imagePath).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      });
      // ClipboardItem with a Promise is supported by Chrome/Edge/Safari.
      // Firefox lacks image clipboard support and will throw — we surface
      // that as an error and let the user fall back to Download.
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
      const res = await fetch(imagePath);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
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
