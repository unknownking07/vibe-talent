---
name: og-image
description: Set up dynamic Open Graph image generation and all required meta tags so links look professional when shared on Twitter/X, LinkedIn, Slack, or anywhere that renders link previews. Triggers on requests like "OG image", "open graph", "social preview", "link preview", "Twitter card", "meta tags for sharing", "my links look broken when I share them", or any mention of how links appear when shared on social media.
category: marketing
tags: [og-image, open-graph, meta-tags, twitter-card, social-preview]
author: tushaarmehtaa
---

Dynamic OG image generation and the full meta tag stack — one route, all pages covered. Your links stop looking broken when someone shares them.

## Phase 1: Detect the Stack

Check the codebase:
- **Framework**: Next.js App Router / Pages Router / Astro / Remix / static HTML?
- **Existing meta tags**: Search for `og:image`, `twitter:card` in layout files
- **Dynamic pages**: Blog posts, product pages, skill pages — anything that needs per-page OG?

If meta tags already exist, audit them before changing anything.

## Phase 2: Framework-Specific Setup

### Next.js App Router (recommended path)

Create `app/api/og/route.tsx`:

```typescript
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || '[Project Name]';
  const description = searchParams.get('description') || '[One-line description]';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#09090b',
          color: '#fafafa',
          fontFamily: 'system-ui, sans-serif',
          padding: '60px',
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 'bold',
            marginBottom: 24,
            textAlign: 'center',
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 28,
            opacity: 0.55,
            textAlign: 'center',
            maxWidth: '80%',
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```

Add to `app/layout.tsx` — read the actual project name and description from package.json, README, or landing page copy:

```typescript
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'),
  openGraph: {
    title: '[Project Name]',
    description: '[One-line description]',
    images: [{
      url: '/api/og?title=[Project Name]&description=[Description]',
      width: 1200,
      height: 630,
    }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '[Project Name]',
    description: '[One-line description]',
    images: ['/api/og?title=[Project Name]&description=[Description]'],
  },
};
```

For dynamic pages (blog posts, skill pages, product pages), override per page:

```typescript
// app/[slug]/page.tsx
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = getItem(slug);
  if (!item) return {};

  const ogUrl = `/api/og?title=${encodeURIComponent(item.title)}&description=${encodeURIComponent(item.description)}`;

  return {
    title: `${item.title} — [Site Name]`,
    description: item.description,
    openGraph: {
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      images: [ogUrl],
    },
  };
}
```

### Next.js Pages Router

Create `pages/api/og.tsx` with the same `ImageResponse` logic.
Add meta tags via `next/head` in `_app.tsx` or per-page with `<Head>`.

### Astro

Install: `npm install satori @resvg/resvg-js`

Create `src/pages/og/[...slug].png.ts` as an endpoint that uses satori to generate a PNG buffer and returns it with `Content-Type: image/png`.

Add meta tags in `src/layouts/Layout.astro` in the `<head>` section.

### Static HTML

Generate a static `og-image.png` (1200×630) once, and reference it:

```html
<meta property="og:image" content="https://yourdomain.com/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
```

For static sites with many pages, consider generating per-page OG images at build time.

## Phase 3: Required Meta Tags

Every page needs these. Inject them in the base layout:

```html
<!-- Open Graph -->
<meta property="og:type" content="website" />
<meta property="og:url" content="[Canonical page URL]" />
<meta property="og:title" content="[Page title]" />
<meta property="og:description" content="[Page description — 1-2 sentences]" />
<meta property="og:image" content="[OG image URL — absolute, not relative]" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />

<!-- Twitter / X -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="[Page title]" />
<meta name="twitter:description" content="[Page description]" />
<meta name="twitter:image" content="[OG image URL — must match og:image]" />
```

**Common mistakes that break previews:**
- Using relative URLs for `og:image` — must be absolute (`https://...`)
- Setting `og:image` but not `twitter:image` — Twitter ignores `og:image`
- Missing `og:image:width` and `:height` — causes slow rendering and sometimes no preview
- Not setting `metadataBase` in Next.js — all relative URLs become broken

## Phase 4: Design Rules

The image renders at 1200×630 on desktop and gets thumbnail-cropped on mobile. Design for both:

- **Text must be readable at 300px wide** — that's how it looks in a Slack/Twitter feed
- **Keep all content within center 80%** — platforms crop the edges unpredictably
- **Dark background preferred** — stands out in light-mode feeds
- **Title: 48-64px bold** — readable at thumbnail size
- **Description/subtitle: 24-32px, lower opacity** — supporting context
- **Minimum 4.5:1 contrast ratio** — both light and dark mode platforms

## Phase 5: Verify

Paste your URL into these tools after deploying. Don't skip this — meta tags look correct in code but break in practice more often than you'd expect:

- Twitter Card Validator: cards-dev.twitter.com/validator
- LinkedIn Post Inspector: linkedin.com/post-inspector/
- Facebook Debugger: developers.facebook.com/tools/debug/ (also works for WhatsApp)
- Quick check: paste URL in any Slack channel

```
[ ] OG image route returns valid image at /api/og (or equivalent)
[ ] og:title, og:description, og:image all set in base layout
[ ] og:image:width and og:image:height set
[ ] twitter:card set to summary_large_image
[ ] twitter:image set (separate from og:image — both required)
[ ] og:image URL is absolute, not relative
[ ] Dynamic pages have per-page og:image with correct title param
[ ] Image readable at 300px thumbnail width
[ ] Verified in Twitter Card Validator or LinkedIn Inspector
```
