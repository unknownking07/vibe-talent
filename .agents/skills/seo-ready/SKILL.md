---
name: seo-ready
description: Full SEO and AEO (Answer Engine Optimization) audit that reads your codebase, scores every signal, and fixes what's missing — meta tags, structured data, sitemap, robots.txt, llms.txt, and AI crawler rules. One command to make any web project discoverable by Google and AI search.
category: seo
tags: [seo, aeo, meta-tags, structured-data, sitemap, robots-txt, llms-txt, open-graph, schema, ai-search]
author: tushaarmehtaa
---

Full SEO and AEO audit that reads the codebase, scores every signal, and applies the fixes. Not just a report — it changes the files.

## Phase 1: Detect the Stack

Identify the framework and routing pattern before doing anything else.

**Check for these in order:**
1. `next.config.*` → Next.js (check version in package.json — v13+ uses App Router with `generateMetadata`, older uses `_document` and `next/head`)
2. `astro.config.*` → Astro (uses frontmatter + `<head>` in layouts)
3. `nuxt.config.*` → Nuxt (uses `useHead` or `useSeoMeta`)
4. `svelte.config.*` → SvelteKit (uses `<svelte:head>`)
5. `index.html` at root → Static HTML / Vite SPA
6. `gatsby-config.*` → Gatsby (uses `gatsby-plugin-react-helmet`)

**Find all pages/routes:**
- Next.js App Router: `app/**/page.tsx` or `page.jsx`
- Next.js Pages Router: `pages/**/*.tsx`
- Astro: `src/pages/**/*.astro`
- Static: all `.html` files

Tell the user: "Found [framework] project with [N] pages. Running full SEO/AEO audit."

## Phase 2: Audit Every Signal

Check each of these across all pages. Score each as PASS / WARN / FAIL.

### 2.1 Title Tags
- Every page must have a unique `<title>` or equivalent metadata
- Length: 30-60 characters (PASS), 20-70 (WARN), outside range (FAIL)
- Must include the primary keyword/topic for that page
- In Next.js: check `metadata.title` or `generateMetadata()` return value
- Check for title template (e.g., `%s | Brand Name`) in root layout

### 2.2 Meta Descriptions
- Every page must have a meta description
- Length: 70-160 characters (PASS), 50-180 (WARN), outside or missing (FAIL)
- Should contain the direct answer or core promise of the page
- In Next.js: check `metadata.description`

### 2.3 Heading Hierarchy
- Exactly one `<h1>` per page (PASS), zero or multiple (FAIL)
- H2s should be used for major sections
- Check for skipped levels (h1 → h3 with no h2)
- For AEO: check if any H2s are phrased as questions (how/what/why/when/who/which/can/does/should)
  - 2+ question headings = PASS, 1 = WARN, 0 = FAIL
  - Question headings match voice/LLM prompts directly

### 2.4 Open Graph Tags
- `og:title`, `og:description`, `og:type`, `og:url`, `og:image` — all must be present
- `og:image` is critical — without it, social shares show a blank card
- In Next.js: check `metadata.openGraph` object
- Check Twitter card tags too: `twitter:card`, `twitter:title`, `twitter:description`
- `twitter:card` should be `summary_large_image` for best visibility

### 2.5 Canonical URLs
- Every page should have a canonical URL
- In Next.js: check `metadata.alternates.canonical`
- In HTML: check `<link rel="canonical">`
- Must be absolute URLs, not relative

### 2.6 Structured Data (JSON-LD)
- Check for `<script type="application/ld+json">` blocks
- Check for these high-value schema types:
  - `FAQPage` — captures long-tail questions in AI answers (HIGH IMPACT)
  - `HowTo` — wins "how to" featured snippets
  - `Article` / `BlogPosting` — for content pages
  - `WebApplication` — for SaaS products
  - `Product` + `Review` — for e-commerce
  - `Organization` — for brand identity
  - `BreadcrumbList` — for navigation context
- In Next.js: schema may be in page components as `<script>` tags or in metadata
- PASS if relevant schema types present, FAIL if none

### 2.7 Sitemap
- Check for `sitemap.xml` or `sitemap.ts` (Next.js) or `sitemap-index.xml`
- Must include all public pages with proper `lastmod`, `changefreq`, `priority`
- Dynamic pages must be included (e.g., all `/blog/[slug]` pages)
- PASS if exists and covers all pages, WARN if exists but incomplete, FAIL if missing

### 2.8 Robots.txt
- Check for `robots.txt` or `robots.ts` (Next.js)
- Must allow crawling of public pages
- Must block private routes (`/api/`, `/admin/`, `/auth/`, `/dashboard/`)
- Must reference sitemap URL
- FAIL if missing entirely

### 2.9 AI Crawler Rules (AEO-specific)
- In `robots.txt`, check for explicit rules for AI crawlers:
  - `GPTBot` (OpenAI / ChatGPT)
  - `ChatGPT-User` (ChatGPT browsing)
  - `Claude-Web` (Anthropic)
  - `PerplexityBot` (Perplexity)
  - `Applebot-Extended` (Apple Intelligence)
  - `Google-Extended` (Gemini)
- These should be explicitly ALLOWED for public content pages
- WARN if not mentioned (defaults vary), FAIL if explicitly blocked

### 2.10 llms.txt
- Check for `llms.txt` in the public directory
- This file helps AI tools understand your product/site structure
- Should contain: product name, description, key features, pricing, important URLs
- PASS if exists and has content, FAIL if missing

### 2.11 Opening Summary / Answer Block (AEO-specific)
- For content pages, check if the first paragraph is a concise summary (35-90 words)
- This is what answer engines pull into answer boxes
- Check for "answer-first" writing pattern — the key information should be near the top, not buried
- PASS if found, WARN if too long/short, FAIL if no clear summary

### 2.12 Internal Linking
- Count internal links per page
- 6+ internal links = PASS, 2-5 = WARN, 0-1 = FAIL
- Internal links help search engines and LLM retrievers map topic depth

### 2.13 FAQ Sections
- Check for FAQ headings or FAQ-like Q&A content
- These capture long-tail prompts in AI search
- Should have structured data (FAQPage schema) if FAQ content exists
- PASS if FAQ section + schema, WARN if FAQ but no schema, FAIL if neither

### 2.14 Image Alt Text
- Check all `<img>` tags and Next.js `<Image>` components for alt text
- Every image should have descriptive alt text
- PASS if all have alt text, WARN if some missing, FAIL if most missing

### 2.15 Performance Signals
- Check for `next/image` usage (not raw `<img>`) in Next.js projects
- Check for font optimization (next/font, font-display: swap)
- Check for excessive client-side JavaScript (`"use client"` on pages that could be server-rendered)

## Phase 3: Score and Report

Calculate the overall score:
- Each check has equal weight
- PASS = 1 point, WARN = 0.5 points, FAIL = 0 points
- Score = (total points / total checks) * 100

Display the report:

```
SEO/AEO Readiness: [SCORE]/100 ([VERDICT])
Framework: [detected framework]
Pages scanned: [N]

On-site checks:
[PASS] Title tags             All pages have titles (30-60 chars)
[WARN] Meta descriptions      2/5 pages missing descriptions
[FAIL] Structured data        No JSON-LD schema detected
[PASS] Sitemap                sitemap.ts found, covers all pages
...

AEO checks:
[FAIL] AI crawler rules       No AI bot rules in robots.txt
[FAIL] llms.txt               Not found
[WARN] Question headings      1 question heading found (need 2+)
[FAIL] FAQ schema              No FAQPage schema
...

Top issues to fix (by impact):
1. (HIGH) Add FAQPage JSON-LD schema — captures AI answer citations
2. (HIGH) Create llms.txt — makes your site readable by AI tools
3. (HIGH) Add AI crawler allow rules — GPTBot, Claude-Web, PerplexityBot
4. (MEDIUM) Add meta descriptions to 2 pages
5. (LOW) Add alt text to 3 images
```

Then ask: **"Want me to fix all [N] issues, or pick specific ones?"**

## Phase 4: Fix Everything

Apply fixes based on the detected framework. Ask before making changes.

### Fix: Missing/Bad Meta Tags
**Next.js App Router:**
- Add or update `metadata` export in page files or `generateMetadata()` for dynamic pages
- Set up title template in root `layout.tsx`: `title: { template: '%s | Brand', default: 'Brand — tagline' }`
- Add description, keywords, authors, creator

**Static HTML:**
- Add `<meta>` tags in `<head>` section

### Fix: Missing Open Graph / Twitter Cards
**Next.js:**
```typescript
openGraph: {
  title: 'Page Title',
  description: 'Page description',
  type: 'website', // or 'article' for content pages
  url: 'https://yoursite.com/page',
  siteName: 'Brand Name',
  locale: 'en_US',
},
twitter: {
  card: 'summary_large_image',
  title: 'Page Title',
  description: 'Page description',
}
```

### Fix: Missing OG Image
**Next.js App Router:**
Create `opengraph-image.tsx` (or `.jsx`) in the app directory for auto-generated OG images:
```tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Page Title'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{
        fontSize: 64,
        background: '#000',
        color: '#fff',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        Page Title
      </div>
    ),
    { ...size }
  )
}
```

For static sites, remind the user to create a 1200x630 image and reference it.

### Fix: Missing Sitemap
**Next.js App Router** — create `app/sitemap.ts`:
```typescript
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://yoursite.com'
  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    // Add all public pages here
  ]
}
```

Read the project's pages/routes and auto-generate all entries with appropriate priorities:
- Homepage: priority 1, daily
- Core feature pages: priority 0.8, weekly
- Content/blog pages: priority 0.7, weekly
- Legal/about pages: priority 0.3, monthly

For dynamic routes, use `generateStaticParams` data if available to include all slugs.

### Fix: Missing/Incomplete Robots.txt
**Next.js App Router** — create `app/robots.ts`:
```typescript
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://yoursite.com'
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/auth/', '/dashboard/'],
      },
      {
        userAgent: 'GPTBot',
        allow: ['/', '/docs/', '/blog/'],
      },
      {
        userAgent: 'ChatGPT-User',
        allow: ['/', '/docs/', '/blog/'],
      },
      {
        userAgent: 'Claude-Web',
        allow: ['/', '/docs/', '/blog/'],
      },
      {
        userAgent: 'PerplexityBot',
        allow: ['/', '/docs/', '/blog/'],
      },
      {
        userAgent: 'Applebot-Extended',
        allow: ['/', '/docs/', '/blog/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
```

Adjust the allow paths based on the project's actual public routes.

### Fix: Missing llms.txt
Create `public/llms.txt` with:
```
# [Product Name]

## What is [Product Name]?
[One paragraph description — what it does, who it's for]

## Key Features
- [Feature 1]
- [Feature 2]
- [Feature 3]

## Pricing
[Pricing model — free, freemium, paid, per-credit, etc.]

## Links
- Website: [URL]
- Documentation: [URL]
- GitHub: [URL if open source]
```

Read the project's README, landing page copy, and package.json to auto-fill this.

### Fix: Missing Structured Data
**Add FAQPage schema** where FAQ content exists:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Question text here?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Answer text here."
      }
    }
  ]
}
</script>
```

**Add WebApplication schema** for SaaS products:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Product Name",
  "description": "Description",
  "url": "https://yoursite.com",
  "applicationCategory": "Category",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  }
}
</script>
```

**Add Article schema** for content/blog pages:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Article Title",
  "description": "Description",
  "author": { "@type": "Organization", "name": "Brand" },
  "publisher": { "@type": "Organization", "name": "Brand" },
  "mainEntityOfPage": { "@type": "WebPage", "@id": "https://yoursite.com/page" }
}
</script>
```

### Fix: Missing Canonical URLs
**Next.js:**
```typescript
alternates: {
  canonical: 'https://yoursite.com/this-page',
}
```

### Fix: Heading Hierarchy Issues
- If multiple H1s: keep the most relevant one, demote others to H2
- If no H1: promote the most prominent heading
- Suggest rephrasing H2s as questions where appropriate for AEO

### Fix: Missing Alt Text
- Find all images without alt text
- Generate descriptive alt text based on the image file name and surrounding context
- In Next.js, ensure all `<Image>` components have the `alt` prop

## Phase 5: Verify

After applying fixes, re-run the audit on the modified files only. Show the before/after score:

```
SEO/AEO Readiness: 34/100 -> 89/100

Fixed:
+ Added meta descriptions to 3 pages
+ Created sitemap.ts with 8 pages
+ Created robots.ts with AI crawler rules
+ Created llms.txt
+ Added FAQPage schema to /guides page
+ Added OG image generator
+ Fixed heading hierarchy on 2 pages

Remaining (manual):
- Add real OG image assets (currently using generated fallback)
- Write FAQ content for /pricing page
- Add alt text to 2 product screenshots (need human description)
```

## Mode Modifiers

The user can specify a mode to add domain-specific checks:

**`/seo-ready --mode b2b`** — adds checks for:
- Documentation/help center in subdirectory (not subdomain)
- Technical content depth (code examples, API references)
- Comparison/alternatives pages
- Integration pages

**`/seo-ready --mode commerce`** — adds checks for:
- Product schema with price, availability, reviews
- Review/rating structured data
- Category page optimization
- Image optimization for product photos

**`/seo-ready --mode local`** — adds checks for:
- LocalBusiness schema
- NAP (Name, Address, Phone) consistency
- Google Business Profile link
- Location-specific content

**`/seo-ready --mode saas`** — adds checks for:
- WebApplication schema
- Pricing page structured data
- Feature comparison tables
- Changelog/updates page for freshness signals
