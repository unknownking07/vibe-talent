import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "VibeTalent privacy policy — how we collect, use, and protect your data.",
  alternates: { canonical: "https://www.vibetalent.work/privacy" },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
      <h1 className="text-3xl font-extrabold uppercase text-[var(--foreground)] mb-8">Privacy Policy</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Last updated: April 1, 2026</p>

      <div className="space-y-6 text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">1. Introduction</h2>
          <p>
            VibeTalent (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the website at vibetalent.work. This Privacy Policy
            explains how we collect, use, disclose, and safeguard your information when you visit our
            website or use our services. By using VibeTalent, you agree to the collection and use of
            information in accordance with this policy.
          </p>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">2. Information We Collect</h2>
          <p className="mb-3">We collect the following types of information:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Account Information:</strong> When you sign up, we collect your email address and profile information through GitHub or Google OAuth. We do not store your passwords.</li>
            <li><strong>GitHub Data:</strong> With your consent, we access your public GitHub profile, contribution history, repository metadata, and commit activity to calculate your coding streak and vibe score.</li>
            <li><strong>Profile Information:</strong> Any information you voluntarily add to your profile, including bio, social links, and project descriptions.</li>
            <li><strong>Usage Data:</strong> We automatically collect information about how you interact with the platform, including pages visited, features used, and referring URLs.</li>
            <li><strong>Analytics:</strong> We use Google Analytics to collect anonymized usage statistics to improve the platform.</li>
          </ul>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>To create and maintain your developer profile on the platform</li>
            <li>To calculate and display your vibe score, coding streak, and badge level</li>
            <li>To enable clients to discover and contact you for hiring opportunities</li>
            <li>To send you notifications about hire requests, endorsements, and streak milestones</li>
            <li>To improve and optimize the platform experience</li>
            <li>To detect and prevent fraud or abuse</li>
          </ul>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">4. Data Sharing</h2>
          <p className="mb-3">We do not sell your personal information. We may share data in the following cases:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Public Profile:</strong> Your profile, projects, streak, and vibe score are publicly visible by design — this is the core value proposition of the platform.</li>
            <li><strong>Service Providers:</strong> We use third-party services (Supabase for database and authentication, Vercel for hosting, Google Analytics for usage insights) that process data on our behalf.</li>
            <li><strong>Legal Requirements:</strong> We may disclose information if required by law or to protect our rights.</li>
          </ul>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">5. Data Storage and Security</h2>
          <p>
            Your data is stored on Supabase (hosted on AWS) with row-level security policies.
            We use HTTPS encryption for all data in transit and follow industry-standard security
            practices. However, no method of transmission over the Internet is 100% secure, and we
            cannot guarantee absolute security.
          </p>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">6. Your Rights</h2>
          <p className="mb-3">You have the right to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Access the personal data we hold about you</li>
            <li>Update or correct your profile information at any time</li>
            <li>Delete your account and associated data by contacting us</li>
            <li>Opt out of marketing communications via your email preferences</li>
            <li>Request a copy of your data in a portable format</li>
          </ul>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">7. Cookies</h2>
          <p>
            We use essential cookies for authentication and session management. We also use
            Google Analytics cookies to understand how visitors use the platform. You can disable
            cookies in your browser settings, but some features may not work properly.
          </p>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">8. Third-Party Links</h2>
          <p>
            Our platform contains links to external websites (GitHub, personal websites, project URLs).
            We are not responsible for the privacy practices of these external sites. We encourage you
            to review their privacy policies.
          </p>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify users of significant
            changes by posting a notice on the platform. Your continued use of VibeTalent after changes
            are posted constitutes acceptance of the updated policy.
          </p>
        </section>

        <section className="p-6" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--border-hard)" }}>
          <h2 className="text-lg font-extrabold uppercase text-[var(--foreground)] mb-4">10. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or want to exercise your data rights,
            contact us at{" "}
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
