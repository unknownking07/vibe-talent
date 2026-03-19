"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Flame, Github, Globe, Send as TelegramIcon } from "lucide-react";

export default function ProfileSetupPage() {
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [github, setGithub] = useState("");
  const [twitter, setTwitter] = useState("");
  const [website, setWebsite] = useState("");
  const [telegram, setTelegram] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    // Create user profile
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: userError } = await (supabase.from("users") as any).insert({
      id: user.id,
      username,
      bio: bio || null,
    });

    if (userError) {
      setError(userError.message);
      setLoading(false);
      return;
    }

    // Create social links
    if (github || twitter || website || telegram) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("social_links") as any).insert({
        user_id: user.id,
        github: github || null,
        twitter: twitter || null,
        website: website || null,
        telegram: telegram || null,
      });
    }

    window.location.href = "/dashboard";
  };

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-16">
      <div className="text-center mb-8">
        <div
          className="inline-flex items-center justify-center w-14 h-14 mb-4"
          style={{
            backgroundColor: "var(--accent)",
            border: "2px solid #0F0F0F",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <Flame size={28} className="text-white" />
        </div>
        <h1 className="text-3xl font-extrabold uppercase text-[#0F0F0F]">Set Up Profile</h1>
        <p className="mt-2 text-sm text-[#52525B] font-medium">
          Complete your VibeTalent builder profile
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div
          className="p-6 space-y-5"
          style={{
            backgroundColor: "#FFFFFF",
            border: "2px solid #0F0F0F",
            boxShadow: "var(--shadow-brutal)",
          }}
        >
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">
              Username *
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="your_username"
              className="input-brutal"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-[#71717A] mb-1.5 block">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the world what you build..."
              rows={3}
              className="input-brutal resize-none"
            />
          </div>

          <div
            className="p-4 space-y-4"
            style={{ backgroundColor: "#F5F5F5", border: "2px solid #0F0F0F" }}
          >
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#0F0F0F]">
              Social Links
            </h3>

            <div className="flex items-center gap-3">
              <Github size={16} className="text-[#71717A] shrink-0" />
              <input
                type="text"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="GitHub username"
                className="input-brutal"
              />
            </div>

            <div className="flex items-center gap-3">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="#71717A" className="shrink-0"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              <input
                type="text"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="X / Twitter handle"
                className="input-brutal"
              />
            </div>

            <div className="flex items-center gap-3">
              <Globe size={16} className="text-[#71717A] shrink-0" />
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://your-website.com"
                className="input-brutal"
              />
            </div>

            <div className="flex items-center gap-3">
              <TelegramIcon size={16} className="text-[#71717A] shrink-0" />
              <input
                type="text"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="Telegram username"
                className="input-brutal"
              />
            </div>
          </div>

          {error && (
            <div
              className="p-3 text-sm font-bold text-[#991B1B]"
              style={{ backgroundColor: "#FEF2F2", border: "2px solid #0F0F0F" }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-brutal btn-brutal-primary w-full justify-center text-sm"
          >
            {loading ? "Setting up..." : "Complete Setup"}
          </button>
        </div>
      </form>
    </div>
  );
}
