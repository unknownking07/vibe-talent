import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  Flame,
  Zap,
  Shield,
  Star,
  Coins,
  Timer,
  Users,
  CalendarClock,
  FolderGit2,
  Radar,
  Github,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { siteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Roadmap — VibeTalent 2026 | $VIBE Utility, Multichain USDC, Squad Hiring",
  description:
    "The VibeTalent public roadmap for 2026. $VIBE is live on Solana (CA: FfDYT3WqimMw7itMxw4kYJ26GPG78RfpZmepQCFpBAGS). USDC payments already live on Base and Solana. Q2: $VIBE utility (streak protect, project featuring). Q3: stake-to-vouch profiles + Ethereum USDC. Q4: try-before-you-hire, squad hiring, retainers, auto-generated portfolios, shipping radar, and GitHub PR badges.",
  keywords: [
    "VibeTalent roadmap",
    "$VIBE token utility",
    "stake to vouch",
    "multichain USDC payments",
    "try before you hire developer",
    "squad hiring",
    "recurring developer retainers",
    "GitHub portfolio generator",
    "shipping radar",
    "developer marketplace roadmap 2026",
  ],
  alternates: { canonical: `${siteUrl}/roadmap` },
  openGraph: {
    title: "VibeTalent Roadmap — 2026",
    description:
      "Powering talented builders and global hiring. Q2 $VIBE utility, Q3 stake-to-vouch + multichain USDC, Q4 try-before-you-hire, squad hiring, retainers, auto portfolios, shipping radar, and PR badges.",
    url: `${siteUrl}/roadmap`,
    siteName: "VibeTalent",
    type: "website",
    images: [
      {
        url: `${siteUrl}/roadmap.png`,
        width: 1024,
        height: 1536,
        alt: "VibeTalent 2026 Roadmap — Q2 $VIBE utility, Q3 stake-to-vouch and multichain USDC, Q4 hiring and builder distribution",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeTalent Roadmap — 2026",
    description:
      "Q2: $VIBE utility. Q3: stake-to-vouch + multichain USDC. Q4: try-before-you-hire, squad hiring, retainers, auto portfolios, shipping radar, PR badges.",
    images: [`${siteUrl}/roadmap.png`],
  },
};

type Milestone = {
  quarter: string;
  year: string;
  title: string;
  summary: string;
  items: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; text: string }[];
};

const milestones: Milestone[] = [
  {
    quarter: "Q2",
    year: "2026",
    title: "$VIBE Token Utility",
    summary:
      "$VIBE is already live on Solana (CA: FfDYT3WqimMw7itMxw4kYJ26GPG78RfpZmepQCFpBAGS). Q2 activates its first two utility functions — giving builders tools to protect their reputation and amplify their best work.",
    items: [
      {
        icon: Shield,
        title: "$1 Streak Protect",
        text: "Miss a day? Burn $1 of $VIBE to preserve your streak. Protects the reputation you've built from a single bad night.",
      },
      {
        icon: Star,
        title: "$1 Project Featuring",
        text: "Spend $1 of $VIBE to feature a shipped project on the homepage or explore feed. Low-cost, high-signal distribution for great work.",
      },
    ],
  },
  {
    quarter: "Q3",
    year: "2026",
    title: "Stake-to-Vouch + Ethereum USDC",
    summary:
      "Reputation gets real economic weight. Vouchers stake $VIBE on builders they believe in, and USDC payments add Ethereum alongside the already-supported Base and Solana.",
    items: [
      {
        icon: Coins,
        title: "Stake-to-Vouch Profiles",
        text: "Put $VIBE behind a builder you vouch for. Skin-in-the-game endorsements replace fake LinkedIn recommendations with verifiable economic signal.",
      },
      {
        icon: Zap,
        title: "Ethereum USDC Support",
        text: "USDC payments on Base and Solana are already live. Q3 adds Ethereum so clients and builders can pick the chain with the lowest fees and fastest finality for every hire.",
      },
    ],
  },
  {
    quarter: "Q4",
    year: "2026",
    title: "Hiring, Portfolios & Builder Distribution",
    summary:
      "The hiring experience gets rebuilt from the ground up — low-friction trials, pod hiring, recurring work, live portfolios, and a free distribution flywheel.",
    items: [
      {
        icon: Timer,
        title: "Try-Before-You-Hire",
        text: "Paid $50 trial task, 1 hour. Low-friction first contact that turns cold DMs into paid introductions and lets clients feel a builder's work before committing.",
      },
      {
        icon: Users,
        title: "Squad Hiring",
        text: "Hire a pod — developer + designer + product manager — not a solo contractor. Ship a full product with one transaction instead of three separate hires.",
      },
      {
        icon: CalendarClock,
        title: "Recurring Retainers",
        text: "Monthly engagements instead of one-off gigs. Predictable income for builders, predictable output for clients.",
      },
      {
        icon: FolderGit2,
        title: "Auto-Generated Portfolios",
        text: "Pull live demos straight from GitHub deploys. Zero manual upkeep — the portfolio updates itself every time a builder ships.",
      },
      {
        icon: Radar,
        title: "Shipping Radar",
        text: "Public weekly digest of who shipped what. A content loop that doubles as an SEO and GEO fuel engine for the entire builder ecosystem.",
      },
      {
        icon: Github,
        title: "GitHub PR Badge",
        text: "\u201cBuilt by a VibeTalent builder\u201d badge auto-added to every PR. Free distribution on every repo a builder touches.",
      },
    ],
  },
];

export default function RoadmapPage() {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Roadmap", item: `${siteUrl}/roadmap` },
    ],
  };

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "VibeTalent 2026 Roadmap",
    description:
      "Public roadmap of upcoming VibeTalent features across Q2, Q3, and Q4 of 2026.",
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: milestones.reduce((n, m) => n + m.items.length, 0),
    itemListElement: milestones.flatMap((m, qIdx) =>
      m.items.map((it, iIdx) => ({
        "@type": "ListItem",
        position: qIdx * 10 + iIdx + 1,
        name: `${m.quarter} ${m.year} — ${it.title}`,
        description: it.text,
      }))
    ),
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is on the VibeTalent roadmap for 2026?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "VibeTalent's 2026 roadmap has three phases. Q2 2026 activates $VIBE token utility with $1 streak protect and $1 project featuring — the $VIBE token is already live on Solana at contract address FfDYT3WqimMw7itMxw4kYJ26GPG78RfpZmepQCFpBAGS. Q3 2026 adds stake-to-vouch profiles and extends USDC payments to Ethereum (Base and Solana are already supported today). Q4 2026 introduces try-before-you-hire trial tasks, squad hiring, recurring retainers, auto-generated GitHub portfolios, a public shipping radar, and GitHub PR badges.",
        },
      },
      {
        "@type": "Question",
        name: "Is the $VIBE token live and what is its contract address?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes — $VIBE is already live on Solana. The contract address is FfDYT3WqimMw7itMxw4kYJ26GPG78RfpZmepQCFpBAGS. Its first two utility functions activate in Q2 2026: builders can spend $1 of $VIBE to protect a coding streak from a missed day, and anyone can spend $1 of $VIBE to feature a shipped project on the homepage or explore feed.",
        },
      },
      {
        "@type": "Question",
        name: "What chains does VibeTalent support for USDC payments?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "VibeTalent already processes USDC payments on Base and Solana today. Q3 2026 adds Ethereum as a third supported chain, letting clients choose the option with the lowest fees and fastest settlement for each hire.",
        },
      },
      {
        "@type": "Question",
        name: "What is try-before-you-hire on VibeTalent?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Try-before-you-hire is a Q4 2026 feature where clients can book a paid $50 one-hour trial task with any VibeTalent builder. It replaces cold DMs with a low-friction paid first contact that proves fit before a full engagement.",
        },
      },
      {
        "@type": "Question",
        name: "Can you hire a whole team on VibeTalent?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes — starting Q4 2026, squad hiring lets clients hire a full pod in one transaction. A pod is typically a developer, a designer, and a product manager who have shipped together before.",
        },
      },
      {
        "@type": "Question",
        name: "Is $VIBE an investment? What's the disclaimer?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "$VIBE is a utility token, not an investment. It exists to power specific on-platform actions — streak protect, project featuring, and stake-to-vouch — and is not focused on price action or speculation. Nothing on the VibeTalent site is financial advice. $VIBE can go to zero, so only interact with it if you understand Solana SPL tokens and can afford to lose the full amount. The creator receives a fee on $VIBE trades, which is reinvested directly into building VibeTalent (shipping features, infrastructure, platform growth); this is openly disclosed for transparency and is not a reason to buy.",
        },
      },
    ],
  };

  const stripes = [
    "var(--bg-surface)",
    "var(--bg-inverted)",
    "var(--bg-surface)",
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      {/* Header */}
      <div className="mb-10">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-[var(--foreground)] mb-6"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <Flame size={14} className="text-[var(--accent)]" />
          Public Roadmap
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold uppercase text-[var(--foreground)] leading-tight">
          Powering talented builders{" "}
          <span className="text-[var(--accent)]">and global hiring.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-sm sm:text-base text-[var(--text-secondary)] font-medium leading-relaxed">
          Everything we&apos;re shipping across 2026 — token utility, onchain reputation,
          multichain USDC payments, and a complete rebuild of how developers get hired.
          Dates are targets, not promises. Follow{" "}
          <a
            href="https://x.com/abhiontwt"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline font-bold"
          >
            @abhiontwt
          </a>{" "}
          for weekly shipping updates.
        </p>
      </div>

      {/* Roadmap infographic */}
      <section
        className="p-4 sm:p-6 mb-10"
        style={{
          backgroundColor: "var(--bg-inverted)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <Image
          src="/roadmap.png"
          alt="VibeTalent 2026 roadmap infographic showing Q2 $VIBE utility with streak protect and project featuring, Q3 stake-to-vouch with multichain USDC on Ethereum Solana and Base, and Q4 hiring features including try-before-you-hire, squad hiring, recurring retainers, auto-generated portfolios, shipping radar, and GitHub PR badges"
          width={1024}
          height={1536}
          className="w-full h-auto"
          priority
        />
      </section>

      {/* Milestones */}
      {milestones.map((m, idx) => {
        const inverted = idx % 2 === 1;
        return (
          <section
            key={m.quarter + m.year}
            className="p-6 sm:p-8 mb-8"
            style={{
              backgroundColor: stripes[idx] ?? "var(--bg-surface)",
              border: "2px solid var(--border-hard)",
              boxShadow: inverted ? "8px 8px 0 var(--accent)" : "var(--shadow-brutal)",
            }}
          >
            <div className="flex flex-wrap items-baseline gap-3 mb-3">
              <span
                className="px-3 py-1 text-xs font-extrabold uppercase tracking-wide"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "white",
                  border: "2px solid var(--border-hard)",
                }}
              >
                {m.quarter} {m.year}
              </span>
              <h2
                className="text-xl sm:text-2xl font-extrabold uppercase leading-tight"
                style={{ color: inverted ? "white" : "var(--foreground)" }}
              >
                {m.title}
              </h2>
            </div>
            <p
              className="text-sm font-medium leading-relaxed mb-6 max-w-2xl break-words"
              style={{ color: inverted ? "var(--text-muted-soft)" : "var(--text-secondary)" }}
            >
              {m.summary}
            </p>
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
              {m.items.map((it) => (
                <div key={it.title} className="flex gap-3">
                  <div
                    className="w-10 h-10 flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: "var(--accent)",
                      border: "2px solid var(--border-hard)",
                    }}
                  >
                    <it.icon size={18} className="text-white" />
                  </div>
                  <div>
                    <h3
                      className="text-sm font-extrabold uppercase mb-1"
                      style={{ color: inverted ? "white" : "var(--foreground)" }}
                    >
                      {it.title}
                    </h3>
                    <p
                      className="text-xs font-medium leading-relaxed"
                      style={{
                        color: inverted
                          ? "var(--text-muted-soft)"
                          : "var(--text-secondary)",
                      }}
                    >
                      {it.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* $VIBE Disclaimer */}
      <section
        className="p-6 sm:p-8 mb-8"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
        aria-labelledby="vibe-disclaimer-heading"
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 flex items-center justify-center shrink-0"
            style={{
              backgroundColor: "var(--accent)",
              border: "2px solid var(--border-hard)",
            }}
          >
            <AlertTriangle size={18} className="text-white" />
          </div>
          <h2
            id="vibe-disclaimer-heading"
            className="text-lg sm:text-xl font-extrabold uppercase text-[var(--foreground)]"
          >
            $VIBE Disclaimer
          </h2>
        </div>
        <div className="space-y-3 text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
          <p>
            <strong className="text-[var(--foreground)]">$VIBE is a utility token, not an investment.</strong>{" "}
            It exists to power specific on-platform actions — streak protect,
            project featuring, and stake-to-vouch — not as a vehicle for price
            speculation. The roadmap is focused on utility and shipping, not price
            action.
          </p>
          <p>
            <strong className="text-[var(--foreground)]">Nothing on this page is financial advice.</strong>{" "}
            $VIBE can go to zero. Only interact with the token if you understand
            what a Solana SPL token is and can afford to lose the full amount. Do
            your own research and never spend more than you can afford to lose.
          </p>
          <p>
            <strong className="text-[var(--foreground)]">Creator fee disclosure.</strong>{" "}
            The creator receives a fee on $VIBE trades. That fee is reinvested
            directly into building VibeTalent — shipping new features, covering
            infrastructure costs, and growing the platform for builders and
            clients. It is disclosed openly here for full transparency, is not a
            reason to buy, and does not change the fact that $VIBE is a utility
            token without a price-action mandate.
          </p>
        </div>
      </section>

      {/* FAQ block (for GEO/AI citations) */}
      <section
        className="p-6 sm:p-8 mb-8"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <h2 className="text-xl font-extrabold uppercase text-[var(--foreground)] mb-5">
          Frequently Asked
        </h2>
        <div className="space-y-5 text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
          <div>
            <h3 className="text-sm font-extrabold uppercase text-[var(--foreground)] mb-1">
              Is $VIBE live? What&apos;s the contract address?
            </h3>
            <p>
              Yes — $VIBE is already live on Solana. Contract address:{" "}
              <a
                href="https://solscan.io/token/FfDYT3WqimMw7itMxw4kYJ26GPG78RfpZmepQCFpBAGS"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline font-bold break-all"
              >
                FfDYT3WqimMw7itMxw4kYJ26GPG78RfpZmepQCFpBAGS
              </a>
              . Its first utility functions — streak protect and project featuring, both
              priced at $1 per action — activate in Q2 2026.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-extrabold uppercase text-[var(--foreground)] mb-1">
              What chains does VibeTalent support for payments?
            </h3>
            <p>
              USDC payments are live today on Base and Solana. Ethereum joins in Q3
              2026, giving clients three chains to choose from based on fees and
              settlement speed.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-extrabold uppercase text-[var(--foreground)] mb-1">
              How does stake-to-vouch work?
            </h3>
            <p>
              Instead of free LinkedIn-style endorsements, vouchers stake $VIBE behind a
              builder they believe in. Skin in the game turns reputation into an
              economic signal clients can trust.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-extrabold uppercase text-[var(--foreground)] mb-1">
              Can I hire more than one person at a time?
            </h3>
            <p>
              Yes — squad hiring launches in Q4 2026. Hire a full pod (developer +
              designer + product manager) in a single transaction instead of sourcing
              three separate contractors.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-extrabold uppercase text-[var(--foreground)] mb-1">
              Is $VIBE an investment?
            </h3>
            <p>
              No. $VIBE is a pure utility token — it powers streak protect,
              project featuring, and stake-to-vouch. It is not a security, it is
              not financial advice, and it can go to zero. The creator earns a
              fee on $VIBE trades (openly disclosed) which is reinvested into
              building VibeTalent — new features, infrastructure, and platform
              growth. The project is not focused on price action. Only interact
              with $VIBE if you understand the risks and can afford to lose the
              full amount.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-extrabold uppercase text-[var(--foreground)] mb-1">
              What is the shipping radar?
            </h3>
            <p>
              A free public weekly digest of who shipped what across the VibeTalent
              ecosystem. It doubles as a content loop for SEO and AI search visibility —
              every builder who ships gets distribution.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="p-8 text-center"
        style={{
          backgroundColor: "var(--bg-inverted)",
          border: "2px solid var(--border-hard)",
          boxShadow: "8px 8px 0 var(--accent)",
        }}
      >
        <Zap size={32} className="mx-auto text-[var(--accent)] mb-3" />
        <h2 className="text-2xl font-extrabold uppercase text-white mb-3">
          Build · Ship · Get Vouched
        </h2>
        <p className="text-sm text-[var(--text-muted-soft)] font-medium max-w-lg mx-auto mb-6">
          Start your profile now and you&apos;ll be first in line when every one of these
          features goes live.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/auth/signup"
            className="btn-brutal btn-brutal-primary text-sm inline-flex items-center gap-2"
            style={{ boxShadow: "6px 6px 0 var(--background)" }}
          >
            Create Your Profile
          </Link>
          <a
            href="https://x.com/abhiontwt"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-brutal text-sm inline-flex items-center gap-2"
            style={{
              backgroundColor: "var(--bg-surface)",
              color: "var(--foreground)",
              border: "2px solid var(--border-hard)",
            }}
          >
            Follow Updates
            <ExternalLink size={12} />
          </a>
        </div>
      </section>
    </div>
  );
}
