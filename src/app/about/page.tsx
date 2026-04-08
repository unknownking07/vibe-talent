import type { Metadata } from "next";
import Link from "next/link";
import { Flame, Zap, Github, ExternalLink, Code2, Trophy, Users } from "lucide-react";
import { siteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About VibeTalent — Built by @abhiontwt",
  description:
    "VibeTalent is a developer talent marketplace built on proof of work — coding streaks, shipped projects, and vibe scores. Built by Abhinav, a crypto-native builder and AI maximalist.",
  alternates: { canonical: `${siteUrl}/about` },
  openGraph: {
    title: "About VibeTalent",
    description:
      "The story behind VibeTalent — a marketplace that ranks developers by what they actually ship, not what they claim on a resume.",
    url: `${siteUrl}/about`,
    siteName: "VibeTalent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "About VibeTalent",
    description:
      "The story behind VibeTalent — a marketplace that ranks developers by what they actually ship.",
  },
};

export default function AboutPage() {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "About", item: `${siteUrl}/about` },
    ],
  };

  const personLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${siteUrl}/about#founder`,
    name: "Abhinav",
    url: "https://x.com/abhiontwt",
    jobTitle: "Founder",
    worksFor: {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "VibeTalent",
    },
    sameAs: [
      "https://x.com/abhiontwt",
      "https://github.com/unknownking07",
      "https://abhinav-on.vercel.app",
    ],
    knowsAbout: [
      "Cryptocurrency",
      "AI applications",
      "Web3",
      "Community Management",
      "Vibe Coding",
      "Full-stack Development",
      "SEO",
      "Product Marketing",
    ],
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }}
      />

      {/* Header */}
      <div className="mb-12">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-[var(--foreground)] mb-6"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <Flame size={14} className="text-[var(--accent)]" />
          The Story
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold uppercase text-[var(--foreground)] leading-tight">
          Resumes are broken.{" "}
          <span className="text-[var(--accent)]">We built something better.</span>
        </h1>
      </div>

      {/* Why VibeTalent exists */}
      <section
        className="p-6 sm:p-8 mb-8"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <h2 className="text-xl font-extrabold uppercase text-[var(--foreground)] mb-4">Why VibeTalent Exists</h2>
        <div className="space-y-4 text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
          <p>
            Vibe coders are shipping incredible products every day — but nobody knows who they are. Talented
            builders are creating real, working software with AI-powered tools, pushing code daily, and
            deploying to production. Yet there is no place that surfaces these people based on what they
            actually ship. Resumes do not capture it. LinkedIn does not show it. Twitter threads disappear.
          </p>
          <p>
            VibeTalent was built to solve this. It is a marketplace that identifies talented shippers by
            analyzing the quality of their work — real GitHub activity, repo health, shipped projects with
            live URLs, and daily coding streaks. Instead of self-reported skills and polished portfolios, VibeTalent
            surfaces builders based on verifiable proof of work. The most consistent, highest-quality
            shippers naturally rise to the top where clients can find and hire them.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section
        className="p-6 sm:p-8 mb-8"
        style={{
          backgroundColor: "var(--bg-inverted)",
          border: "2px solid var(--border-hard)",
          boxShadow: "8px 8px 0 var(--accent)",
        }}
      >
        <h2 className="text-xl font-extrabold uppercase text-white mb-6">How the Platform Works</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {[
            {
              icon: Code2,
              title: "Connect GitHub",
              text: "Sign up and connect your GitHub account. VibeTalent syncs your public commit history automatically.",
            },
            {
              icon: Flame,
              title: "Build Your Streak",
              text: "Log activity every day to build a coding streak. Consecutive days of shipping code are tracked and displayed on your profile.",
            },
            {
              icon: Trophy,
              title: "Earn Badges",
              text: "Hit milestones to unlock badges: Bronze at 30 days, Silver at 90, Gold at 180, and Diamond at 365 days of consecutive coding.",
            },
            {
              icon: Users,
              title: "Get Discovered",
              text: "Clients browse the marketplace by skill, streak, and vibe score — or use VibeFinder Bot to get AI-matched with the right builder.",
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-3">
              <div
                className="w-10 h-10 flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: "var(--accent)",
                  border: "2px solid var(--border-hard)",
                }}
              >
                <item.icon size={18} className="text-white" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold uppercase text-white mb-1">{item.title}</h3>
                <p className="text-xs text-[var(--text-muted-soft)] font-medium leading-relaxed">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* About the builder */}
      <section
        className="p-6 sm:p-8 mb-8"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <h2 className="text-xl font-extrabold uppercase text-[var(--foreground)] mb-4">Built by Abhinav</h2>
        <div className="space-y-4 text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
          <p>
            VibeTalent is built and maintained by Abhinav, a crypto-native builder from India with 6+ years
            in the space. He started as a community manager in crypto — working with projects like MELD,
            Asymmetry Finance, Ampleforth, Superboard, and Armor Wallet — before transitioning into
            full-time building during the AI wave.
          </p>
          <p>
            With no formal technical background, Abhinav taught himself to build by doing. He shipped mini apps
            on Farcaster, built CryptoJobsHub (a web3 job aggregator), created MirrorMind (a voice clone
            wellness app), and developed browser extensions like Reply Counter and Timeline Peace — all while
            learning development, dev tools, marketing, and SEO from scratch. He builds in public on X,
            sharing the entire process as it happens.
          </p>
          <p>
            The idea for VibeTalent came from watching the vibe coding movement explode. Thousands of builders
            were shipping real products with AI tools — but there was no way to discover who was actually
            talented versus who just talked about it. As someone obsessed with tech and every new innovation
            in the space, Abhinav built VibeTalent to turn shipping history into reputation — giving real
            builders the visibility they deserve.
          </p>
        </div>
        <div className="flex gap-3 mt-6 flex-wrap">
          <a
            href="https://x.com/abhiontwt"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-brutal btn-brutal-primary text-sm flex items-center gap-2"
          >
            Follow on X
            <ExternalLink size={12} />
          </a>
          <a
            href="https://github.com/unknownking07"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-brutal btn-brutal-dark text-sm flex items-center gap-2"
          >
            <Github size={14} />
            GitHub
            <ExternalLink size={12} />
          </a>
          <a
            href="https://abhinav-on.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-brutal text-sm flex items-center gap-2"
            style={{ backgroundColor: "var(--bg-surface)", color: "var(--foreground)", border: "2px solid var(--border-hard)" }}
          >
            Portfolio
            <ExternalLink size={12} />
          </a>
        </div>
      </section>

      {/* Contact */}
      <section
        className="p-6 sm:p-8 mb-8"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <h2 className="text-xl font-extrabold uppercase text-[var(--foreground)] mb-4">Contact</h2>
        <div className="space-y-3 text-sm text-[var(--text-secondary)] font-medium">
          <p>
            Got questions, feedback, or want to collaborate? Reach out anytime.
          </p>
          <div className="flex flex-col gap-2">
            <p>
              Email:{" "}
              <a href="mailto:vibetalentwork@gmail.com" className="text-[var(--accent)] hover:underline font-bold">
                vibetalentwork@gmail.com
              </a>
            </p>
            <p>
              X:{" "}
              <a
                href="https://x.com/abhiontwt"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline font-bold"
              >
                @abhiontwt
              </a>
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
        <h2 className="text-2xl font-extrabold uppercase text-white mb-3">Start Building Your Reputation</h2>
        <p className="text-sm text-[var(--text-muted-soft)] font-medium max-w-lg mx-auto mb-6">
          Create your profile, connect your GitHub, and start your coding streak. Let your work speak for itself.
        </p>
        <Link
          href="/auth/signup"
          className="btn-brutal btn-brutal-primary text-sm inline-flex items-center gap-2"
          style={{ boxShadow: "6px 6px 0 var(--background)" }}
        >
          Create Your Profile
        </Link>
      </section>
    </div>
  );
}
