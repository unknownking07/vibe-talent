import type { Metadata } from "next";
import Script from "next/script";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SignupBar } from "@/components/layout/signup-bar";
import { PromoBillboard } from "@/components/ui/promo-billboard";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Providers from "@/components/providers";
import { siteUrl } from "@/lib/seo";
import "./globals.css";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "VibeTalent — Find Vibe Coders Who Actually Ship",
    template: "%s | VibeTalent",
  },
  description:
    "The marketplace for vibe coders. Build your reputation through streaks, proof of work, and shipping projects consistently.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "VibeTalent — Find Vibe Coders Who Actually Ship",
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
        alt: "VibeTalent — Find Vibe Coders Who Actually Ship",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeTalent — Find Vibe Coders Who Actually Ship",
    description: "The marketplace for vibe coders who ship consistently.",
    images: [`${siteUrl}/og-image-v2.jpg`],
  },
  alternates: {
    canonical: siteUrl,
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://unavatar.io" />
        <link rel="dns-prefetch" href="https://unavatar.io" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark")document.documentElement.setAttribute("data-theme","dark")}catch(e){}})()`,
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
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <Providers>
          <PromoBillboard />
          <Navbar />
          <ErrorBoundary>
            <main className="min-h-screen">{children}</main>
          </ErrorBoundary>
          <Footer />
          <SignupBar />
        </Providers>
      </body>
    </html>
  );
}
