import Image from "next/image";
import { ShareButton } from "@/components/share/share-button";
import { siteUrl } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ username: string; slug: string }> }): Promise<Metadata> {
  const { username, slug } = await params;
  const og = `${siteUrl}/api/og/receipt/shipped/${username}?slug=${slug}`;
  const cardTitle = `@${username} shipped ${slug}`;
  const description = `@${username} shipped ${slug} — built and verified on VibeTalent.`;
  return {
    title: cardTitle,
    description,
    openGraph: { title: cardTitle, description, images: [{ url: og, width: 1200, height: 630 }] },
    twitter:   { card: "summary_large_image", title: cardTitle, description, images: [og] },
  };
}

export default async function ShippedReceiptPage({ params }: { params: Promise<{ username: string; slug: string }> }) {
  const { username, slug } = await params;
  const ogImage = `/api/og/receipt/shipped/${username}?slug=${slug}`;
  const shareText = `Just shipped ${slug} on VibeTalent`;
  const shareUrl = `/share/${username}/shipped/${slug}`;

  return (
    <main className="max-w-[840px] mx-auto p-6">
      <h1 className="text-[28px] font-extrabold mb-1">@{username} shipped <span className="text-[var(--accent)]">{slug}</span></h1>
      <p className="text-[14px] text-[var(--text-muted)] mb-4">Project shipped &amp; verified</p>
      <div className="border-2 border-[var(--border-hard)]" style={{ boxShadow: "var(--shadow-brutal)" }}>
        <Image src={ogImage} alt="receipt" width={1200} height={630} className="w-full h-auto" />
      </div>
      <div className="mt-6"><ShareButton url={shareUrl} text={shareText} imageUrl={ogImage} /></div>
    </main>
  );
}
