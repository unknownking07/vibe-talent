import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vibetalent.dev";

export const metadata: Metadata = {
  title: {
    default: "VibeTalent — Find Vibe Coders Who Actually Ship",
    template: "%s | VibeTalent",
  },
  description:
    "The AI-powered marketplace for vibe coders. Build your reputation through streaks, proof of work, and shipping projects consistently.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "VibeTalent — Find Vibe Coders Who Actually Ship",
    description: "The AI-powered marketplace for vibe coders who ship consistently.",
    url: siteUrl,
    siteName: "VibeTalent",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeTalent — Find Vibe Coders Who Actually Ship",
    description: "The AI-powered marketplace for vibe coders who ship consistently.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <Navbar />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
