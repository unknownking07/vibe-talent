import Image from "next/image";
import { ShareButton } from "@/components/share/share-button";
import { siteUrl } from "@/lib/seo";
import type { Metadata } from "next";
import { weeklyWindow } from "@/lib/share-card-data";

export async function generateMetadata({ params }: { params: Promise<{ username: string; week: string }> }): Promise<Metadata> {
  const { username, week } = await params;
  const window = weeklyWindow(week);
  const og = `${siteUrl}/api/og/receipt/weekly/${username}?w=${week}&v=2`;
  const cardTitle = `@${username}'s week in public work`;
  const description = `Recorded activity and projects from ${window?.label ?? week} on VibeTalent.`;
  return {
    title: cardTitle,
    description,
    openGraph: { title: cardTitle, description, images: [{ url: og, width: 1200, height: 630 }] },
    twitter:   { card: "summary_large_image", title: cardTitle, description, images: [og] },
  };
}

export default async function WeeklyReceiptPage({ params }: { params: Promise<{ username: string; week: string }> }) {
  const { username, week } = await params;
  const window = weeklyWindow(week);
  const ogImage = `/api/og/receipt/weekly/${username}?w=${week}&v=2`;
  const shareText = `My week in public work on VibeTalent: ${window?.label ?? week}`;
  const shareUrl = `/share/${username}/weekly/${week}`;

  return (
    <main className="max-w-[840px] mx-auto p-6">
      <h1 className="text-[28px] font-extrabold mb-1">@{username}&apos;s week in public work</h1>
      <p className="text-[14px] text-[var(--text-muted)] mb-4">{window?.label ?? week}</p>
      <div className="rounded-2xl overflow-hidden border border-[var(--border-subtle)]" style={{ boxShadow: "var(--shadow-brutal)" }}>
        <Image src={ogImage} alt={`Weekly activity card for @${username}`} width={1200} height={630} unoptimized className="w-full h-auto" />
      </div>
      <div className="mt-6">
        <ShareButton url={shareUrl} text={shareText} imageUrl={ogImage} />
      </div>
    </main>
  );
}
