import type { Metadata } from "next";
import Script from "next/script";
import { Geist, JetBrains_Mono } from "next/font/google";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SignupBar } from "@/components/layout/signup-bar";
import { FloatingChat } from "@/components/layout/floating-chat";
import { PromoBillboard } from "@/components/ui/promo-billboard";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { siteUrl } from "@/lib/seo";
import "./globals.css";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

// Geist is the UI/display face. It replaced Space Grotesk once headings went
// uppercase: Space Grotesk's caps carry a lot of personality that reads noisy
// at display sizes, where Geist's stay even. `display: "swap"` keeps text
// visible during the font load rather than blocking first paint (LCP).
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Vibe Coders Marketplace: Hire Builders Who Ship | VibeTalent",
    template: "%s | VibeTalent",
  },
  description:
    "The marketplace for vibe coders. Build your reputation through streaks, proof of work, and shipping projects consistently.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "VibeTalent: Find Vibe Coders Who Actually Ship",
    description: "The marketplace for vibe coders who ship consistently.",
    url: siteUrl,
    siteName: "VibeTalent",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: `${siteUrl}/og-image-v2.jpg`,
        width: 1200,
        height: 630,
        alt: "VibeTalent: Find Vibe Coders Who Actually Ship",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeTalent: Find Vibe Coders Who Actually Ship",
    description: "The marketplace for vibe coders who ship consistently.",
    images: [`${siteUrl}/og-image-v2.jpg`],
    site: "@vibetalentwork",
    creator: "@abhiontwt",
  },
  alternates: {
    canonical: siteUrl,
  },
  // Orynth directory listing ownership check. Duplicated at
  // /.well-known/ory-verify.txt — the file is the method Orynth recommends,
  // this tag is the belt-and-braces copy that can't be dropped by the static
  // asset pipeline. Safe to remove once the listing is approved.
  verification: {
    other: { "ory-verify": "orynth-91ed1e7813df4209a5816a96a2ae9172" },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The font variables must live on <html>, not <body>: globals.css maps
    // `--font-sans` to them inside `@theme inline`, which resolves at :root.
    // With the classes on <body> that lookup found nothing, so the whole site
    // silently fell back to the system sans stack.
    <html
      lang="en"
      className={`${geist.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://unavatar.io" />
        <link rel="dns-prefetch" href="https://unavatar.io" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t!=="light")document.documentElement.setAttribute("data-theme","dark")}catch(e){document.documentElement.setAttribute("data-theme","dark")}})()`,
          }}
        />
      </head>
      {GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}
          </Script>
        </>
      )}
      <body className="antialiased">
        <PromoBillboard />
        <Navbar />
        <ErrorBoundary>
          <main className="min-h-screen">{children}</main>
        </ErrorBoundary>
        <Footer />
        <SignupBar />
        <FloatingChat />
      </body>
    </html>
  );
}
