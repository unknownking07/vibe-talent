import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone, Wallet, Shield, ArrowRight, HelpCircle } from "lucide-react";
import { siteUrl, buildBreadcrumbList } from "@/lib/seo";
import { getPriceSnapshot, formatUsd, type PriceSnapshot } from "@/lib/pricing";
import { PricingTiers } from "./pricing-tiers";

const PAGE_TITLE = "Featured Project Pricing & Guidelines";
const PAGE_URL = `${siteUrl}/pricing`;

function buildDescription(p: PriceSnapshot): string {
  return `Sponsored homepage slots on VibeTalent from ${formatUsd(p.day)} USDC. Day (${formatUsd(p.day)}), Week (${formatUsd(p.week)}), Month (${formatUsd(p.month)}), and Lifetime (${formatUsd(p.annual)}) tiers paid with USDC on Base or Solana — live on-chain pricing, no platform fees.`;
}

function buildFaq(p: PriceSnapshot): { q: string; a: string }[] {
  return [
    {
      q: "How much does it cost to feature a project on VibeTalent?",
      a: `Featured slots start at ${formatUsd(p.day)} USDC for 24 hours. We offer four tiers: Day (${formatUsd(p.day)}), Week (${formatUsd(p.week)}), Month (${formatUsd(p.month)}), and Lifetime (${formatUsd(p.annual)}). Prices are read live from the on-chain contract on Base — no hidden platform fees on top.`,
    },
    {
      q: "What payment methods are accepted?",
      a: "USDC on Base or Solana. Connect any Privy-supported wallet — MetaMask, Rabby, Coinbase, or Rainbow on EVM, and Phantom, Backpack, or Solflare on Solana. Gas is paid separately in ETH (Base) or SOL (Solana).",
    },
    {
      q: "How long does my featured slot last?",
      a: "Day = 24 hours. Week = 7 days. Month = 30 days. Lifetime persists indefinitely until the contract is upgraded or removed. The slot starts the moment your transaction confirms on-chain.",
    },
    {
      q: "Where does my project appear?",
      a: "At the top of the VibeTalent homepage in the Featured Projects section — the first thing founders see when they visit the marketplace to scout talent.",
    },
    {
      q: "What happens when my slot expires?",
      a: "It returns to the available pool automatically — no action needed on your end. Lifetime promotions never expire.",
    },
    {
      q: "Can I get a refund?",
      a: "Sales are final once your slot goes live. The one exception: if we remove a slot for violating the content guidelines, the unused paid time is refunded to your original wallet.",
    },
  ];
}

export async function generateMetadata(): Promise<Metadata> {
  const prices = await getPriceSnapshot();
  const description = buildDescription(prices);
  return {
    title: PAGE_TITLE,
    description,
    alternates: { canonical: PAGE_URL },
    openGraph: {
      title: `${PAGE_TITLE} | VibeTalent`,
      description,
      url: PAGE_URL,
      type: "website",
      images: [{ url: `${siteUrl}/og-image-v2.jpg`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${PAGE_TITLE} | VibeTalent`,
      description,
      images: [`${siteUrl}/og-image-v2.jpg`],
    },
  };
}

export default async function PricingPage() {
  const prices = await getPriceSnapshot();
  const faq = buildFaq(prices);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    ...buildBreadcrumbList([
      { name: "Home", path: "/" },
      { name: "Pricing & Guidelines", path: "/pricing" },
    ]),
  };

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "VibeTalent Featured Project Promotion",
    description:
      "Sponsored homepage slot for shipped projects on the VibeTalent developer marketplace. Paid in USDC on Base or Solana with live on-chain pricing.",
    url: PAGE_URL,
    brand: { "@type": "Brand", name: "VibeTalent" },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: prices.day.toFixed(2),
      highPrice: prices.annual.toFixed(2),
      offerCount: 4,
      offers: [
        {
          "@type": "Offer",
          name: "Day",
          price: prices.day.toFixed(2),
          priceCurrency: "USD",
          description: "24-hour featured slot on the VibeTalent homepage.",
          eligibleDuration: { "@type": "QuantitativeValue", value: 1, unitCode: "DAY" },
          availability: "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          name: "Week",
          price: prices.week.toFixed(2),
          priceCurrency: "USD",
          description: "7-day featured slot.",
          eligibleDuration: { "@type": "QuantitativeValue", value: 7, unitCode: "DAY" },
          availability: "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          name: "Month",
          price: prices.month.toFixed(2),
          priceCurrency: "USD",
          description: "30-day featured slot — best value tier.",
          eligibleDuration: { "@type": "QuantitativeValue", value: 30, unitCode: "DAY" },
          availability: "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          name: "Lifetime",
          price: prices.annual.toFixed(2),
          priceCurrency: "USD",
          description: "Permanent featured slot — persists indefinitely until the contract is upgraded or removed.",
          availability: "https://schema.org/InStock",
        },
      ],
    },
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Megaphone size={24} style={{ color: "var(--accent)" }} />
        <span
          className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5"
          style={{ backgroundColor: "var(--accent)", color: "white" }}
        >
          Sponsored Slots
        </span>
      </div>
      <h1 className="text-3xl sm:text-4xl font-extrabold uppercase text-[var(--foreground)] mb-3 leading-tight">
        Pricing &amp; Guidelines
      </h1>
      <p className="text-sm text-[var(--text-secondary)] max-w-2xl mb-10 leading-relaxed">
        Founders scout VibeTalent every day looking for builders to hire. A sponsored slot lands your project
        at the top of the marketplace — exactly where they&apos;re looking. Pay with USDC on Base or Solana,
        prices read live from the on-chain contract. Expired slots return to the pool automatically; refunds
        are issued only when a slot is removed for a guideline violation.
      </p>

      {/* Live tiers (client component reads contract; initialPrices keeps SSR
          and hydration in sync with the snapshot used for metadata + JSON-LD) */}
      <PricingTiers initialPrices={prices} />

      {/* How it works */}
      <section
        className="p-6 mt-10"
        style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <Wallet size={20} style={{ color: "var(--accent)" }} />
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)]">How It Works</h2>
        </div>
        <ol className="list-decimal pl-6 space-y-2 text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
          <li>
            Click <strong className="text-[var(--foreground)]">Connect Wallet</strong> on the homepage Featured
            Projects card. We support Privy-managed EVM (MetaMask, Rabby, Coinbase, Rainbow) and Solana (Phantom,
            Backpack, Solflare) wallets.
          </li>
          <li>Pick the project you want to promote and a tier from the live pricing above.</li>
          <li>
            Approve USDC spend (one-time per chain) and submit the promote transaction. Your project goes live
            within seconds of confirmation.
          </li>
          <li>
            When your slot expires, it returns to the pool automatically. Lifetime promotions never expire.
          </li>
        </ol>
      </section>

      {/* Guidelines */}
      <section
        className="p-6 mt-6"
        style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <Shield size={20} style={{ color: "var(--accent)" }} />
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)]">Content Guidelines</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)] font-medium mb-4 leading-relaxed">
          Sponsored slots are visible to every visitor. To keep VibeTalent useful, we enforce a short list of rules.
        </p>

        <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--foreground)] mt-4 mb-2">
          Allowed
        </h3>
        <ul className="list-disc pl-6 space-y-1.5 text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
          <li>Real, working products you (or your team) shipped.</li>
          <li>Open-source projects with a public repository.</li>
          <li>Hackathon or experimental builds — clearly labeled as such in the description.</li>
          <li>Hiring announcements tied to a real project or company.</li>
        </ul>

        <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--foreground)] mt-5 mb-2">
          Not Allowed
        </h3>
        <ul className="list-disc pl-6 space-y-1.5 text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
          <li>Pump-and-dump tokens, rug pulls, or projects with unverifiable claims.</li>
          <li>Adult, illegal, or hateful content.</li>
          <li>Affiliate-link aggregators or pure ad funnels with no real product.</li>
          <li>Trademark or IP infringement, impersonation, or scams.</li>
        </ul>

        <p className="text-xs text-[var(--text-muted)] mt-5 leading-relaxed">
          We reserve the right to remove a sponsored slot that violates these rules. In that case the remaining
          paid time is refunded to the original wallet. Decisions are made by the moderation team and can be
          appealed via{" "}
          <Link href="/feedback" className="underline" style={{ color: "var(--accent)" }}>
            feedback
          </Link>
          .
        </p>
      </section>

      {/* FAQ — content matches FAQPage JSON-LD above so AI Overviews / search
          can cite the same answers verbatim. */}
      <section
        id="faq"
        className="p-6 mt-6"
        style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <HelpCircle size={20} style={{ color: "var(--accent)" }} />
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)]">FAQ</h2>
        </div>
        <dl className="space-y-5">
          {faq.map(({ q, a }) => (
            <div key={q}>
              <dt className="text-sm font-extrabold text-[var(--foreground)] leading-snug">{q}</dt>
              <dd className="mt-1.5 text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
                {a}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* CTA */}
      <div className="mt-10 flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/#featured-projects"
          className="btn-brutal btn-brutal-primary btn-notched text-sm flex items-center gap-2"
        >
          Feature My Project <ArrowRight size={14} />
        </Link>
        <Link
          href="/dashboard"
          className="text-xs font-bold uppercase tracking-wider underline underline-offset-4 text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
        >
          Manage My Projects →
        </Link>
      </div>
    </div>
  );
}
