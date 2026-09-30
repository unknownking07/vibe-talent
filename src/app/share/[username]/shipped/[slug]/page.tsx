import Image from "next/image";
import { ShareButton } from "@/components/share/share-button";
import { siteUrl } from "@/lib/seo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchUserByUsernameCached } from "@/lib/supabase/server-queries";

export async function generateMetadata({ params }: { params: Promise<{ username: string; slug: string }> }): Promise<Metadata> {
  const { username, slug } = await params;
  const user = await fetchUserByUsernameCached(username);
  const project = user?.projects.find((item) => item.id === slug && item.verified);
  if (!project) notFound();
  const og = `${siteUrl}/api/og/receipt/shipped/${username}?slug=${slug}&v=3`;
  const cardTitle = `@${username} shipped ${project?.title ?? "a project"}`;
  const description = `${project?.title ?? "A project"} by @${username}, GitHub verified on VibeTalent.`;
  return {
    title: cardTitle,
    description,
    openGraph: { title: cardTitle, description, images: [{ url: og, width: 1200, height: 630 }] },
    twitter:   { card: "summary_large_image", title: cardTitle, description, images: [og] },
  };
}

export default async function ShippedReceiptPage({ params }: { params: Promise<{ username: string; slug: string }> }) {
  const { username, slug } = await params;
  const user = await fetchUserByUsernameCached(username);
  const project = user?.projects.find((item) => item.id === slug && item.verified);
  if (!project) notFound();
  const ogImage = `/api/og/receipt/shipped/${username}?slug=${slug}&v=3`;
  const shareText = `Just shipped ${project?.title ?? "a project"} on VibeTalent`;
  const shareUrl = `/share/${username}/shipped/${slug}`;

  return (
    <main className="max-w-[840px] mx-auto p-6">
      <h1 className="text-[28px] font-extrabold mb-1">@{username} shipped <span className="text-[var(--accent)]">{project?.title ?? "a project"}</span></h1>
      <p className="text-[14px] text-[var(--text-muted)] mb-4">Project shipped &amp; verified</p>
      <div className="rounded-2xl overflow-hidden border border-[var(--border-subtle)]" style={{ boxShadow: "var(--shadow-brutal)" }}>
        <Image src={ogImage} alt={`Shipped project card for @${username}`} width={1200} height={630} unoptimized className="w-full h-auto" />
      </div>
      <div className="mt-6"><ShareButton url={shareUrl} text={shareText} imageUrl={ogImage} /></div>
    </main>
  );
}
