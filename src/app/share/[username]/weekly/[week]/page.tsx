import Image from "next/image";
import { ShareButton } from "@/components/share/share-button";
import { siteUrl } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ username: string; week: string }> }): Promise<Metadata> {
  const { username, week } = await params;
  const og = `${siteUrl}/api/og/receipt/weekly/${username}?w=${week}`;
  const cardTitle = `@${username}'s weekly receipt`;
  const description = `@${username}'s shipping receipt for the week of ${week} — streak, commits, and projects on VibeTalent.`;
  return {
    title: cardTitle,
    description,
    openGraph: { title: cardTitle, description, images: [{ url: og, width: 1200, height: 630 }] },
    twitter:   { card: "summary_large_image", title: cardTitle, description, images: [og] },
  };
}

export default async function WeeklyReceiptPage({ params }: { params: Promise<{ username: string; week: string }> }) {
  const { username, week } = await params;
  const ogImage = `/api/og/receipt/weekly/${username}?w=${week}`;
  const shareText = `My VibeTalent receipt for the week of ${week}`;
  const shareUrl = `/share/${username}/weekly/${week}`;

  return (
    <main className="max-w-[840px] mx-auto p-6">
      <h1 className="text-[28px] font-extrabold mb-1">@{username}&apos;s receipt</h1>
      <p className="text-[14px] text-[var(--text-muted)] mb-4">Week of {week}</p>
      <div className="border-2 border-[var(--border-hard)]" style={{ boxShadow: "var(--shadow-brutal)" }}>
        <Image src={ogImage} alt="receipt" width={1200} height={630} className="w-full h-auto" />
      </div>
      <div className="mt-6">
        <ShareButton url={shareUrl} text={shareText} imageUrl={ogImage} />
      </div>
    </main>
  );
}
