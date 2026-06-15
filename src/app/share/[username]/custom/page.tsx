import Image from "next/image";
import { ShareButton } from "@/components/share/share-button";
import { siteUrl } from "@/lib/seo";
import type { Metadata } from "next";

type Range = "7d" | "30d" | "all";

function normalizeRange(v: string | string[] | undefined): Range {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "7d" || s === "all" ? s : "30d";
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ range?: string }> }): Promise<Metadata> {
  const { username } = await params;
  const { range } = await searchParams;
  const r = normalizeRange(range);
  const og = `${siteUrl}/api/og/receipt/custom/${username}?range=${r}`;
  const cardTitle = `@${username} on VibeTalent`;
  const description = `@${username}'s builder receipt — vibe score, streak, and shipped projects, verified on VibeTalent.`;
  return {
    title: `@${username}`,
    description,
    openGraph: { title: cardTitle, description, images: [{ url: og, width: 1200, height: 630 }] },
    twitter:   { card: "summary_large_image", title: cardTitle, description, images: [og] },
  };
}

export default async function CustomReceiptPage({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ range?: string }> }) {
  const { username } = await params;
  const { range } = await searchParams;
  const r = normalizeRange(range);
  const ogImage = `/api/og/receipt/custom/${username}?range=${r}`;
  const shareText = `Check out @${username} on VibeTalent`;
  const shareUrl = `/share/${username}/custom?range=${r}`;

  return (
    <main className="max-w-[840px] mx-auto p-6">
      <h1 className="text-[28px] font-extrabold mb-1">@{username}</h1>
      <p className="text-[14px] text-[var(--text-muted)] mb-4">Range: {r}</p>
      <div className="border-2 border-[var(--border-hard)]" style={{ boxShadow: "var(--shadow-brutal)" }}>
        <Image src={ogImage} alt="receipt" width={1200} height={630} className="w-full h-auto" />
      </div>
      <div className="mt-6"><ShareButton url={shareUrl} text={shareText} imageUrl={ogImage} /></div>
    </main>
  );
}
