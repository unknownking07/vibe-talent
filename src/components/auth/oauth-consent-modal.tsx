"use client";

import { Github, Shield, User, Mail, BookOpen, X } from "lucide-react";

type Provider = "github" | "google";

interface OAuthConsentModalProps {
  provider: Provider;
  onConfirm: () => void;
  onCancel: () => void;
}

const providerConfig = {
  github: {
    name: "GitHub",
    icon: <Github size={24} />,
    color: "#24292e",
    permissions: [
      { icon: <User size={18} />, label: "Profile information", detail: "Your name, username, and avatar" },
      { icon: <Mail size={18} />, label: "Email address", detail: "Your primary email on GitHub" },
      { icon: <BookOpen size={18} />, label: "Public repositories", detail: "Read-only access to your public repos" },
    ],
    privacyNote: "VibeTalent will never push code, create repos, or modify your GitHub account.",
  },
  google: {
    name: "Google",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
    color: "#4285F4",
    permissions: [
      { icon: <User size={18} />, label: "Name and profile picture", detail: "Your display name and avatar" },
      { icon: <Mail size={18} />, label: "Email address", detail: "Your Google email address" },
    ],
    privacyNote: "VibeTalent will never access your contacts, drive, or any other Google services.",
  },
};

export default function OAuthConsentModal({ provider, onConfirm, onCancel }: OAuthConsentModalProps) {
  const config = providerConfig[provider];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Modal */}
      <div
        className="relative w-full max-w-sm"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 p-1 text-[var(--text-muted)] hover:text-[var(--foreground)] cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="p-6 pb-4 text-center">
          <div
            className="inline-flex items-center justify-center w-12 h-12 mb-3"
            style={{
              backgroundColor: config.color,
              border: "2px solid var(--border-hard)",
              boxShadow: "var(--shadow-brutal-sm)",
              color: "var(--text-on-inverted)",
            }}
          >
            {config.icon}
          </div>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)]">
            Sign in with {config.name}
          </h2>
          <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
            VibeTalent will access the following from your {config.name} account
          </p>
        </div>

        {/* Permissions list */}
        <div className="px-6 space-y-0">
          {config.permissions.map((perm, i) => (
            <div
              key={i}
              className="flex items-start gap-3 py-3"
              style={{ borderTop: i === 0 ? "2px solid var(--border-subtle)" : "1px solid var(--border-subtle)" }}
            >
              <div className="mt-0.5 text-[var(--text-secondary)]">{perm.icon}</div>
              <div>
                <p className="text-sm font-bold text-[var(--foreground)]">{perm.label}</p>
                <p className="text-xs text-[var(--text-muted)]">{perm.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Privacy note */}
        <div
          className="mx-6 mt-4 p-3 flex items-start gap-2"
          style={{
            backgroundColor: "var(--status-success-bg)",
            border: "2px solid var(--border-hard)",
          }}
        >
          <Shield size={16} className="mt-0.5 text-[#16A34A] shrink-0" />
          <p className="text-xs font-medium text-[var(--status-success-text)]">{config.privacyNote}</p>
        </div>

        {/* Actions */}
        <div className="p-6 space-y-2">
          <button
            onClick={onConfirm}
            className="w-full flex items-center justify-center px-5 py-3 text-sm font-extrabold uppercase tracking-wide cursor-pointer transition-colors hover:opacity-90"
            style={{
              backgroundColor: config.color,
              color: "#FFFFFF",
              border: "2px solid var(--border-hard)",
            }}
          >
            Continue with {config.name}
          </button>
          <button
            onClick={onCancel}
            className="w-full flex items-center justify-center px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] cursor-pointer hover:text-[var(--foreground)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
