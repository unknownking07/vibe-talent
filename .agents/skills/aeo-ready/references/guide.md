# AEO Ready — Reference Guide

## Schema Examples by Project Type

### SaaS App — Full Schema Set

```html
<!-- In <head> -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "YourApp",
  "description": "One sentence: what it does and who it's for.",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "url": "https://yourapp.com",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "description": "Free tier available"
  },
  "creator": {
    "@type": "Person",
    "name": "Your Name",
    "url": "https://yourwebsite.com"
  }
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is YourApp?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "YourApp is a [category] tool that helps [target user] [achieve outcome]. It works by [brief mechanism]. You can get started for free with [free tier details], and paid plans start at [price]."
      }
    },
    {
      "@type": "Question",
      "name": "Is YourApp free?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, YourApp has a free tier that includes [what's included]. Paid plans start at [price] per month and include [key paid features]. No credit card is required to start."
      }
    },
    {
      "@type": "Question",
      "name": "How does YourApp work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "YourApp works in three steps: first [step 1], then [step 2], and finally [step 3]. Most users [achieve outcome] within [timeframe]. The process is fully automated — no manual work required."
      }
    }
  ]
}
</script>
```

---

## FAQ Answer Formula

Every FAQ answer should follow this structure:

**[Direct answer to the question]. [One sentence expanding why/how]. [One sentence on what this means for the user].**

Target: 40-60 words. Count them before publishing.

Examples of good vs bad:

| Bad (too short) | Good (40-60 words) |
|---|---|
| "Yes, it's free." | "Yes, YourApp is free to start. The free tier includes [X, Y, Z]. Paid plans at $[price]/month unlock [key features]. No credit card required — just sign up and start [doing the thing]." |
| "It works automatically." | "YourApp automatically [does X] by [mechanism]. Once you [setup step], it runs in the background and [delivers outcome]. Most users see [result] within [timeframe] of getting started." |

---

## llms.txt Advanced Patterns

### For a Developer Tool

```
# ToolName

> CLI tool / library that [does X] for [audience].

## Install
npm install toolname
# or
pip install toolname

## What it does
[2-3 sentences covering the core use case]

## Key capabilities
- [Capability 1]: [one-line description]
- [Capability 2]: [one-line description]
- [Capability 3]: [one-line description]

## Pricing
Open source / Free / [pricing details]

## Documentation
- Full docs: https://docs.toolname.com
- GitHub: https://github.com/user/toolname
- Examples: https://docs.toolname.com/examples
```

### For a SaaS Product

```
# ProductName

> [One sentence: what it does + who it's for]

## Problem it solves
[1-2 sentences on the pain point]

## How it works
[2-3 sentences on the mechanism]

## Who uses it
[Target user description — be specific]

## Pricing
- Free: [what's included]
- Pro ($X/mo): [what's included]
- Enterprise: [contact/custom]

## Links
- Homepage: https://yourapp.com
- Sign up: https://yourapp.com/signup
- Docs: https://docs.yourapp.com
- Status: https://status.yourapp.com
```

---

## AI Crawler Behavior

| Crawler | Engine | What it indexes |
|---------|--------|----------------|
| GPTBot | ChatGPT | Public web content for training + browsing |
| ClaudeBot | Claude.ai | Web content for Claude's browsing feature |
| PerplexityBot | Perplexity | Real-time search content |
| Google-Extended | Google AI Overviews | Content for AI-generated search summaries |
| Amazonbot | Alexa | Alexa voice responses |

**Allowing all = maximum AI discoverability.** Only block if you have specific legal/competitive reasons.

---

## Citation Outreach Email Template

Use with `/cold-email` skill format:

```
Subject: [Product] for your "[Article Title]" roundup

Hey [Name],

Saw your "[Best X Tools]" article — [Product] does [specific differentiator that's missing from their list].

[One social proof sentence: users, result, or notable fact].

Worth adding? Happy to send details.

[Your Name]
```

**What to personalize:**
- Reference the exact article title
- Name one thing your product does that none of their listed tools do
- Include one specific proof point (users, results, press mention)

---

## Content Gap Templates

### "What is [Product]?" Page Section

```html
<section id="what-is">
  <h2>What is [Product]?</h2>
  <p>[Product] is a [category] tool that helps [target user] [achieve outcome].
  Unlike [alternative approach], [Product] [key differentiator].</p>
  <p>It works by [brief mechanism]. [One sentence on results users get].</p>
</section>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "What is [Product]?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "[40-60 word answer matching the section above]"
    }
  }]
}
</script>
```

### Comparison Page Template

```markdown
# [Product] vs [Competitor]

## TL;DR
[Product] is better for [use case A]. [Competitor] is better for [use case B].

## Feature Comparison

| Feature | [Product] | [Competitor] |
|---------|-----------|-------------|
| [Key feature] | ✅ | ❌ |
| [Key feature] | ✅ | ✅ |
| Pricing | $X/mo | $Y/mo |

## Who should choose [Product]?
[Target user description with specific scenario]

## Who should choose [Competitor]?
[Fair description — don't trash competitors]
```
