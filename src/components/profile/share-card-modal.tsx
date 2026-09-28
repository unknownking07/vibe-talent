"use client";

import { useState, useEffect, useRef } from "react";
import { X, Download, Copy, Loader2 } from "lucide-react";
import { Check } from "@phosphor-icons/react";
import { getShareImage } from "@/lib/share-image-client";

interface ShareCardModalProps {
  username: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareCardModal({
  username,
  isOpen,
  onClose,
}: ShareCardModalProps) {
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const cardUrl = `/api/share-card/${encodeURIComponent(username)}`;
  // Reset state when modal opens — setState here is intentional for prop-driven resets
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setLoadError(false);
    setCopied(false);
    void getShareImage(cardUrl).then((blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
      setLoading(false);
    }).catch((error) => {
      if (cancelled) return;
      console.error("Share card preview failed:", error);
      setLoadError(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPreviewUrl(null);
    };
  }, [isOpen, cardUrl]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Close on escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // Close on click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const blob = await getShareImage(cardUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${username}-vibetalent-card.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
    setDownloading(false);
  };

  const handleCopy = async () => {
    try {
      // Preview, copy and download share one promise. ClipboardItem is created
      // in the click gesture so Safari can accept the already-fetched PNG.
      const blobPromise = getShareImage(cardUrl);
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blobPromise }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
      // Fallback: copy the URL instead
      try {
        await navigator.clipboard.writeText(
          `${window.location.origin}${cardUrl}`,
        );
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // silently fail
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="w-full max-w-[720px] animate-in rounded-2xl"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <h3 className="text-lg font-bold text-[var(--foreground)]">
            Share Card
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Card Preview */}
        <div className="p-6">
          <div
            className="relative w-full overflow-hidden rounded-xl"
            style={{
              aspectRatio: "1200 / 630",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-inverted)",
            }}
          >
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-inverted)]">
                <Loader2
                  size={32}
                  className="text-[var(--accent)] animate-spin"
                />
              </div>
            )}
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={`${username}'s VibeTalent card`} className="w-full h-full object-contain" />
            ) : null}
            {loadError ? <span className="absolute inset-0 flex items-center justify-center text-sm text-[var(--text-muted)]">Card unavailable. Try again later.</span> : null}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={handleDownload}
            disabled={downloading || loading || loadError}
            className="btn-brutal flex-1 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--text-on-inverted)",
            }}
          >
            <Download size={16} />
            {downloading ? "Downloading..." : "Download PNG"}
          </button>
          <button
            onClick={handleCopy}
            disabled={loading || loadError}
            className="btn-brutal flex-1 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            style={{
              backgroundColor: copied
                ? "var(--status-success-bg)"
                : "var(--bg-surface)",
              color: "var(--foreground)",
            }}
          >
            {copied ? (
              <Check weight="bold" size={16} className="text-emerald-600" />
            ) : (
              <Copy size={16} />
            )}
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
        </div>
      </div>
    </div>
  );
}
