import type { Metadata } from "next";
import { siteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "VibeTalent terms of service — rules and guidelines for using the platform.",
  alternates: { canonical: `${siteUrl}/terms` },
};

export default function TermsOfServicePage() {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Terms of Service", item: `${siteUrl}/terms` },
    ],
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <h1 className="text-3xl font-extrabold uppercase text-[var(--foreground)] mb-8">Terms of Service</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Last updated: April 1, 2026</p>

      <div className="space-y-6 text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">1. Acceptance of Terms</h2>
          <p>
            By accessing or using VibeTalent at vibetalent.work (&quot;the Platform&quot;), you agree to be
            bound by these Terms of Service. If you do not agree to these terms, do not use the Platform.
            We reserve the right to update these terms at any time, and your continued use constitutes
            acceptance of any changes.
          </p>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">2. Description of Service</h2>
          <p>
            VibeTalent is a developer talent marketplace that ranks software engineers by coding
            consistency, shipped projects, and community endorsements. The Platform provides tools
            for developers to build public profiles, track coding streaks, and connect with clients
            seeking to hire developers. We also provide an AI-powered agent to help clients find
            suitable developers. Additionally, developers can optionally pay with USDC (on Base network)
            to feature their projects on the homepage carousel for increased visibility.
          </p>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">3. Accounts</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>You must provide accurate information when creating an account.</li>
            <li>You are responsible for maintaining the security of your account credentials.</li>
            <li>You must be at least 13 years old to use the Platform.</li>
            <li>One person may only maintain one account. Multiple accounts may be suspended.</li>
            <li>You are responsible for all activity that occurs under your account.</li>
          </ul>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">4. User Content</h2>
          <p className="mb-3">By submitting content to VibeTalent (including profile information, project descriptions, and reviews), you:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Retain ownership of your content.</li>
            <li>Grant VibeTalent a non-exclusive, worldwide, royalty-free license to display, distribute, and promote your content on the Platform and in marketing materials.</li>
            <li>Represent that your content does not violate any third-party rights.</li>
            <li>Agree not to post content that is misleading, defamatory, illegal, or harmful.</li>
          </ul>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">5. Coding Streaks and Scores</h2>
          <p className="mb-3">
            Vibe scores, coding streaks, and badge levels are calculated automatically from your
            public GitHub activity. You agree that:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>You will not artificially inflate your streak through automated commits, empty commits, or other manipulation tactics.</li>
            <li>VibeTalent reserves the right to adjust scores or reset streaks if manipulation is detected.</li>
            <li>Score calculations may change over time as we improve our algorithms.</li>
            <li>Streaks are based on UTC time and we are not responsible for timezone-related resets.</li>
          </ul>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">6. Hiring and Communication</h2>
          <p className="mb-3">
            VibeTalent facilitates introductions between clients and developers. We are not a party
            to any employment or freelance agreement. You agree that:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>VibeTalent is not responsible for the quality, safety, or legality of any work performed.</li>
            <li>Payment terms, contracts, and deliverables are between the client and developer.</li>
            <li>You will not use the Platform to send spam, unsolicited messages, or harassing communications.</li>
          </ul>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">7. Featured Projects and Payments</h2>
          <p className="mb-3">
            VibeTalent offers an optional Featured Projects feature that allows developers to promote
            a project on the homepage carousel by paying with USDC on the Base network. By using this feature, you agree that:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>All payments are processed on-chain via smart contract and are non-refundable once the transaction is confirmed on the blockchain.</li>
            <li>Featured placement is for visibility only — it does not affect your vibe score, badge level, streak, or search ranking.</li>
            <li>VibeTalent reserves the right to remove featured projects that violate these terms or contain misleading content.</li>
            <li>Pricing and duration of featured placements are determined by the smart contract and may change over time.</li>
            <li>You are solely responsible for ensuring your wallet has sufficient USDC balance and that you approve the correct transaction amount.</li>
            <li>VibeTalent is not responsible for failed, delayed, or incorrect transactions due to blockchain network issues, wallet errors, or insufficient gas fees.</li>
          </ul>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">8. Prohibited Conduct</h2>
          <p className="mb-3">You agree not to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Use the Platform for any unlawful purpose</li>
            <li>Impersonate another person or misrepresent your identity</li>
            <li>Attempt to access other users&apos; accounts or private data</li>
            <li>Scrape, crawl, or collect data from the Platform without permission (public API use is permitted)</li>
            <li>Interfere with or disrupt the Platform&apos;s infrastructure</li>
            <li>Post false reviews, endorsements, or hire requests</li>
            <li>Use bots or scripts to manipulate streaks, scores, or rankings</li>
          </ul>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">9. Intellectual Property</h2>
          <p>
            The VibeTalent name, logo, design, and platform code are the property of VibeTalent.
            You may not copy, modify, or distribute our branding or proprietary materials without
            written permission. The public API may be used freely for building integrations and tools.
          </p>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">10. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your account at any time for violation of
            these terms or for any conduct we deem harmful to the Platform or its users. You may
            delete your account at any time by contacting us. Upon termination, your profile will
            be removed from public listings, but we may retain certain data as required by law.
          </p>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">11. Disclaimers</h2>
          <p>
            VibeTalent is provided &quot;as is&quot; without warranties of any kind, express or implied.
            We do not guarantee the accuracy of vibe scores, streak data, or project quality assessments.
            We are not liable for any damages arising from your use of the Platform, including but not
            limited to lost profits, data loss, or damages from hiring decisions made based on
            Platform information.
          </p>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">12. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, VibeTalent and its operators shall not be liable
            for any indirect, incidental, special, consequential, or punitive damages, regardless of
            the cause of action or theory of liability. Our total liability shall not exceed the amount
            you have paid to VibeTalent in the 12 months preceding the claim, or $100, whichever is greater.
          </p>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">13. Contact</h2>
          <p>
            For questions about these Terms of Service, contact us at{" "}
            <a
              href="mailto:vibetalentwork@gmail.com"
              className="text-[var(--accent)] hover:underline font-bold"
            >
              vibetalentwork@gmail.com
            </a>{" "}
            or on X at{" "}
            <a
              href="https://x.com/abhiontwt"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline font-bold"
            >
              @abhiontwt
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
