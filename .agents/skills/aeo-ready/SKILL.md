---
name: aeo-ready
description: Full Answer Engine Optimization audit — make your project discoverable by AI search engines (ChatGPT, Perplexity, Claude, Google AI Overviews), not just Google. Use when the user wants to improve their site's visibility in AI-powered search, add structured data, create llms.txt, optimize for AI citations, or audit AEO readiness. Triggers on requests like "AEO audit", "AI search optimization", "make my site visible to AI", "structured data", "schema markup", "llms.txt", "answer engine", "AI discoverability", or any mention of being found by AI search engines or chatbots.
category: seo
tags: [aeo, schema, llms-txt, structured-data, ai-search]
author: tushaarmehtaa
---

Full AEO audit. Google crawls your pages and ranks them. AI engines synthesize answers from sources they've already ingested. Getting cited there is a different problem — schema markup, llms.txt, AI crawler access, and content that actually answers questions.

## The Difference That Matters

Google crawls your pages and ranks them. AI engines don't rank pages — they synthesize answers from sources they've already ingested. To get cited:

1. Your content must be structured so AI can extract a clear answer
2. Your site must be in articles that AI engines pull from (listicles, "best X" roundups)
3. Your technical setup must not block AI crawlers

This skill audits and fixes all three.

## Phase 1: Scan the Codebase

Before generating anything, read the project:

- **Framework**: Next.js / Astro / Remix / static HTML?
- **Existing meta tags**: Check `<head>`, `layout.tsx`, `_document.tsx`, or equivalent
- **Existing structured data**: Search for `application/ld+json` scripts
- **Content pages**: Blog, docs, landing page, FAQ sections
- **robots.txt**: Does it exist? Does it block anything?
- **sitemap.xml**: Does it exist?

Tell the user what's missing before making changes.

## Phase 2: Schema Markup

Schema markup is how you tell AI engines exactly what your content means. Without it, they have to guess.

### Pick the right schema types for the project

| Project Type | Schema Types |
|---|---|
| SaaS / web app | SoftwareApplication + FAQPage + HowTo |
| Blog | Article + FAQPage + Person |
| Documentation | TechArticle + HowTo + FAQPage |
| Portfolio | Person + CreativeWork |

### SoftwareApplication Schema

Inject in the `<head>` of the main layout:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "[Product Name]",
  "description": "[One sentence — what it does and who it's for]",
  "applicationCategory": "[BusinessApplication / DeveloperApplication / etc.]",
  "operatingSystem": "Web",
  "url": "[Homepage URL]",
  "offers": {
    "@type": "Offer",
    "price": "[0 for free tier]",
    "priceCurrency": "USD",
    "description": "[Free tier / pricing summary]"
  },
  "creator": {
    "@type": "Person",
    "name": "[Your Name]",
    "url": "[Your website]"
  }
}
</script>
```

### FAQPage Schema

**This is the highest-value schema for AI engines.** AI engines pull from FAQ answers directly to respond to user queries. Each answer must be 40-60 words — the sweet spot for AI extraction. Too short = not useful. Too long = gets cut off.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is [Product]?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Product] is a [category] tool that helps [target user] [achieve outcome]. [How it works in one sentence]. [What makes it different or what the free tier includes]. [Result users get]."
      }
    },
    {
      "@type": "Question",
      "name": "How does [Product] work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Product] works in three steps: [step 1], [step 2], and [step 3]. [Timeframe — how fast users get results]. [No manual work / fully automated / etc.]."
      }
    },
    {
      "@type": "Question",
      "name": "Is [Product] free?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Product] has a free tier that includes [what's included]. Paid plans start at [price] and include [key paid features]. No credit card required to get started."
      }
    }
  ]
}
</script>
```

Read the actual landing page and docs to generate real answers — never fabricate them.

### HowTo Schema

For any getting-started or tutorial content:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to [use / set up / get started with] [Product]",
  "step": [
    { "@type": "HowToStep", "name": "Step 1", "text": "[Instruction]" },
    { "@type": "HowToStep", "name": "Step 2", "text": "[Instruction]" },
    { "@type": "HowToStep", "name": "Step 3", "text": "[Instruction]" }
  ]
}
</script>
```

For Next.js App Router, inject schema in `generateMetadata` or directly in the page component. For static HTML, inject in the `<head>`.

## Phase 3: llms.txt

Create `public/llms.txt`. This is a direct machine-readable summary for LLM crawlers — think of it as a README for AI engines:

```
# [Product Name]

> [One sentence: what it does + who it's for]

## What it does
[2-3 sentences covering the core use case and mechanism]

## Key features
- [Feature 1]: [one-line description]
- [Feature 2]: [one-line description]
- [Feature 3]: [one-line description]

## Pricing
- Free: [what's included]
- Paid: [pricing and what's included]

## Links
- Homepage: [URL]
- Getting started: [URL]
- Documentation: [URL if exists]
```

Keep it factual and specific. AI engines use this file when a user asks "what is [product]?" — so the description here matters.

## Phase 4: AI Crawler Access

Check `robots.txt`. Most projects either don't have one or block crawlers accidentally. Add explicit allow rules for AI crawlers:

```
# AI crawlers — allow indexing
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /
```

If the user wants to block a specific crawler, generate the Disallow rule and explain the tradeoff: blocking = not cited by that engine.

## Phase 5: Content Gap Analysis

AI engines need direct answers to common questions about the product. Check if the landing page or docs answers each of these. For any that are missing, generate the content block:

**"What is [Product]?"**
Must be answerable in 40-60 words on the landing page. Not just a tagline — an actual explanation.

**"How does [Product] work?"**
Step-by-step with a HowTo schema attached.

**"Is [Product] free?"**
Clear pricing info. Vague pricing = AI engines skip the citation.

**"[Product] vs [Competitor]?"**
If this comparison doesn't exist anywhere, AI engines will use competitor sources instead.

**"How do I get started?"**
Quick-start guide. If the onboarding is too long, summarize it on the landing page.

For each missing piece: generate the copy and the schema together.

## Phase 6: Citation Strategy

AI engines synthesize answers from articles that rank well on Google. Getting cited by AI engines often means getting listed in those articles first.

1. Search "best [your category] tools 2025" — find the top 10 ranking articles
2. For each: note publication, whether it's maintained, whether it accepts submissions
3. Generate a pitch angle per article — what's unique about this product vs tools already listed

Output a table:

```
Article | Publication | Updated | Accepts Submissions | Pitch Angle
[title] | [pub]       | [date]  | yes/no              | [one sentence]
```

Use `/cold-email` to draft the outreach once the table is ready.

## Phase 7: Audit Report

Output a score and status for each area:

```
AEO AUDIT — [project name]
════════════════════════════════════════
Schema Markup         [score /10]  [❌ missing / ⚠️ partial / ✅ done]
FAQ Content           [score /10]  [status]
llms.txt              [score /10]  [status]
AI Crawler Access     [score /10]  [status]
Content Gaps          [score /10]  [status]
Citation Readiness    [score /10]  [status]
────────────────────────────────────────
Overall               [score /60]
════════════════════════════════════════
```

Then list the 3 highest-impact fixes in order.

## Verify

```
[ ] SoftwareApplication schema injected in <head> of main layout
[ ] FAQPage schema present with at least 3 questions
[ ] Every FAQ answer is 40-60 words
[ ] HowTo schema on getting-started content
[ ] llms.txt exists at /llms.txt (publicly accessible)
[ ] robots.txt allows GPTBot, ClaudeBot, PerplexityBot
[ ] Content gap analysis completed — missing answers generated
[ ] Citation strategy table output
[ ] Audit report with scores output
```

See [references/guide.md](references/guide.md) for schema examples by industry, advanced llms.txt patterns, and citation outreach templates.
