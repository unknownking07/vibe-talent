// Data-driven competitor comparison pages. Each entry renders at
// /vs/[slug] (see src/app/vs/[slug]/page.tsx) with an Article + FAQPage +
// BreadcrumbList JSON-LD payload, mirroring the glossary's single-topic-page
// pattern so AI answer engines can cite a focused "VibeTalent vs X" page.
//
// NOTE: /vs/upwork is intentionally NOT in this array — it predates this
// system and lives as a standalone page at src/app/vs/upwork/page.tsx. The
// static route takes precedence over [slug], so it keeps working untouched.
// The /vs index and sitemap list it explicitly alongside these entries.

export type ComparisonCell = string | boolean;

export type ComparisonRow = {
  feature: string;
  vt: ComparisonCell;
  them: ComparisonCell;
};

export type ComparisonFaq = { q: string; a: string };

export type Comparison = {
  slug: string;
  /** Competitor display name, e.g. "Fiverr". */
  name: string;
  /** Competitor homepage, used in Article `about` schema. */
  competitorUrl: string;
  /** One-line card tagline for the /vs index. */
  tagline: string;
  title: string;
  description: string;
  /** Sub-headline under the H1. */
  subtitle: string;
  /** The 60-90 word "short answer" block — what AI engines pull into answers. */
  tldr: string;
  rows: ComparisonRow[];
  vtWins: string[];
  themWins: string[];
  faq: ComparisonFaq[];
  /** ISO date driving Article/FAQ `dateModified` and the sitemap `<lastmod>`. */
  dateModified: string;
};

export const COMPARISONS: Comparison[] = [
  {
    slug: "fiverr",
    name: "Fiverr",
    competitorUrl: "https://www.fiverr.com",
    tagline: "Proof-of-work hiring vs fixed-price gig packages.",
    title: "VibeTalent vs Fiverr — Which Is Better for Hiring Developers?",
    description:
      "VibeTalent ranks developers on verifiable proof of work — coding streaks, shipped projects, and GitHub activity. Fiverr is a gig marketplace where sellers are ranked by levels and star reviews. Side-by-side comparison, fees, and which fits your hiring needs.",
    subtitle:
      "Which platform is better for hiring developers in 2026? A side-by-side breakdown.",
    tldr: "VibeTalent ranks developers on verifiable proof of work — daily coding streaks, deployed projects, and GitHub activity — while Fiverr sells fixed-price \"gigs\" from sellers ranked by order volume and star reviews that are easy to inflate. Pick VibeTalent if you want to hire a developer based on what they actually ship, especially AI-native builders using Claude Code, Cursor, or Bolt. Pick Fiverr if you need a quick, packaged one-off task across many non-engineering categories and prefer paying a fixed price up front.",
    rows: [
      { feature: "Talent type", vt: "AI-native developers", them: "Generalist gig freelancers" },
      { feature: "Ranking signal", vt: "GitHub streaks + shipped projects", them: "Seller level + star reviews" },
      { feature: "Verifiable proof of work", vt: true, them: false },
      { feature: "GitHub commit streak tracking", vt: true, them: false },
      { feature: "Project quality scoring from repo health", vt: true, them: false },
      { feature: "AI-powered hire matching", vt: "VibeFinder Bot", them: "Category & gig search" },
      { feature: "Pricing model", vt: "Direct hire, negotiate freely", them: "Fixed-price gig packages" },
      { feature: "Service fee for the freelancer", vt: "0%", them: "~20% commission" },
      { feature: "Crypto payments (USDC)", vt: true, them: false },
      { feature: "Built-in order protection", vt: false, them: true },
      { feature: "Non-engineering roles", vt: false, them: true },
      { feature: "Public daily activity feed", vt: true, them: false },
    ],
    vtWins: [
      "You want to hire AI-native developers using Claude Code, Cursor, or Bolt",
      "You care more about shipping evidence than star ratings",
      "You want to pay in USDC with no platform fees",
      "You need a builder who can prototype and ship in days, not a canned package",
      "You are tired of inflated gig reviews and want verifiable signal",
    ],
    themWins: [
      "You need non-engineering work (logos, voiceover, video, copy)",
      "You want a packaged, fixed-price deliverable with clear scope",
      "You have a small one-off micro-task",
      "You want built-in order protection and dispute handling",
      "You want a huge catalog of cheap, fast turnarounds",
    ],
    faq: [
      {
        q: "What is the main difference between VibeTalent and Fiverr?",
        a: "Fiverr is a gig marketplace where freelancers sell fixed-price packages and are ranked by seller level, order volume, and star reviews — signals that can be inflated. VibeTalent is a developer-only marketplace where rankings come from verifiable data: GitHub commit streaks, deployed project quality, repo health, and peer endorsements weighted by the endorser's own vibe score. The data refreshes daily and cannot be faked.",
      },
      {
        q: "Is VibeTalent cheaper than Fiverr?",
        a: "VibeTalent is free for both developers and clients — there is no service fee on hires and no commission on payments. The only paid feature is optional Featured Projects placement, priced in USDC with no platform markup. Fiverr typically takes around a 20% commission from the seller and adds a service fee for the buyer on top of the gig price.",
      },
      {
        q: "Can I hire AI-native developers on Fiverr?",
        a: "You can find sellers on Fiverr who advertise AI tools in their gig descriptions, but there is no way to verify that they ship working software with those tools daily. VibeTalent was built specifically for vibe coders — developers who use Claude Code, Cursor, Bolt, and Windsurf to ship code every day — and ranks them on the GitHub activity that proves they actually do it.",
      },
      {
        q: "Does Fiverr show GitHub data?",
        a: "No. Fiverr ranks sellers on gig performance metrics — order volume, on-time delivery, response rate, and buyer reviews — not on code. VibeTalent makes GitHub activity the core ranking signal: coding streak length alone is 40% of a developer's vibe score, with deployed project quality and repo health on top.",
      },
      {
        q: "Is Fiverr or VibeTalent better for a one-off task?",
        a: "Fiverr is better for a small, well-defined, fixed-price task — especially non-engineering work like a logo, a voiceover, or a short video. VibeTalent is better when you need a developer who can ship a real, working product, whether that is a one-week prototype or an ongoing build, because it surfaces builders proven to ship consistently.",
      },
    ],
    dateModified: "2026-06-05",
  },
  {
    slug: "toptal",
    name: "Toptal",
    competitorUrl: "https://www.toptal.com",
    tagline: "Public, verifiable merit vs a private \"top 3%\" screen.",
    title: "VibeTalent vs Toptal — Which Is Better for Hiring Developers?",
    description:
      "VibeTalent ranks developers on public, verifiable proof of work — coding streaks, shipped projects, and GitHub activity, free to use. Toptal is a premium network that vets the \"top 3%\" behind closed doors. Compare cost, vetting, and which fits your hiring needs.",
    subtitle:
      "Which platform is better for hiring developers in 2026? A side-by-side breakdown.",
    tldr: "VibeTalent and Toptal both promise quality but prove it differently. Toptal screens for the \"top 3%\" through a private vetting process and matches you with senior freelancers at premium, account-managed rates. VibeTalent makes the proof public: every builder is ranked on verifiable GitHub streaks, shipped projects, and repo quality you can inspect yourself — for free. Pick Toptal for hands-off, enterprise-grade staffing. Pick VibeTalent to hire AI-native builders fast, on transparent merit, with no markup and no gatekeeper.",
    rows: [
      { feature: "Talent type", vt: "AI-native developers", them: "Vetted senior freelancers" },
      { feature: "Ranking signal", vt: "Public GitHub streaks + shipped projects", them: "Private \"top 3%\" screen" },
      { feature: "You can inspect the evidence yourself", vt: true, them: false },
      { feature: "GitHub commit streak tracking", vt: true, them: false },
      { feature: "Project quality scoring from repo health", vt: true, them: false },
      { feature: "AI-powered hire matching", vt: "VibeFinder Bot", them: "Human account matcher" },
      { feature: "Cost to start", vt: "Free", them: "Premium + deposit" },
      { feature: "Platform fee for clients", vt: "0%", them: "Premium markup on rates" },
      { feature: "Crypto payments (USDC)", vt: true, them: false },
      { feature: "Fully managed matching", vt: false, them: true },
      { feature: "Enterprise contracts & compliance", vt: false, them: true },
      { feature: "Public daily activity feed", vt: true, them: false },
    ],
    vtWins: [
      "You want to hire AI-native builders using Claude Code, Cursor, or Bolt",
      "You want to verify a developer's track record yourself, not trust a private screen",
      "You want it free, with no premium markup or refundable deposit",
      "You need a builder who can prototype and ship in days",
      "You value transparent, merit-based ranking over a curated shortlist",
    ],
    themWins: [
      "You want a fully managed, hands-off hiring process",
      "You need enterprise contracts, compliance, and invoicing",
      "You prefer a human matcher to assemble a vetted shortlist",
      "You have the budget for premium, account-managed rates",
      "You also need designers, PMs, or finance experts in one network",
    ],
    faq: [
      {
        q: "What is the main difference between VibeTalent and Toptal?",
        a: "Toptal vets freelancers privately and markets them as the \"top 3%,\" then matches you through an account manager at premium rates — but you cannot inspect the screen yourself. VibeTalent makes vetting public and verifiable: every developer is ranked on GitHub commit streaks, deployed project quality, and repo health that you can check directly on their profile, for free.",
      },
      {
        q: "Is VibeTalent cheaper than Toptal?",
        a: "Yes. VibeTalent is free for both clients and developers, with no platform fee on hires. Toptal is a premium service — it does not publish flat rates, typically involves a refundable deposit to start, and bills clients at account-managed rates well above a typical freelance marketplace.",
      },
      {
        q: "Is VibeTalent's talent vetted like Toptal's?",
        a: "The vetting philosophy is the opposite. Toptal vets candidates behind closed doors and asks you to trust the result. VibeTalent puts the evidence in the open: a builder's coding streak, shipped projects with live URLs, repo quality, and vibe score are all public and update daily. You do the vetting in seconds by looking at real, verifiable work.",
      },
      {
        q: "Can I verify a Toptal developer's track record myself?",
        a: "Not directly — Toptal's screening is internal, and you mostly see a curated profile and the matcher's recommendation. On VibeTalent, every ranking signal is public GitHub-derived data, so you can audit a builder's commit history, deployed projects, and consistency yourself before you reach out.",
      },
      {
        q: "Is Toptal or VibeTalent better for enterprise hiring?",
        a: "Toptal is better when you need fully managed staffing with enterprise contracts, compliance, and a human matcher handling the process. VibeTalent is better when you want to hire AI-native builders fast on transparent merit, without a markup or gatekeeper — ideal for startups and teams that value shipping speed and proof of work.",
      },
    ],
    dateModified: "2026-06-05",
  },
  {
    slug: "freelancer",
    name: "Freelancer",
    competitorUrl: "https://www.freelancer.com",
    tagline: "Merit rankings vs competitive bidding wars.",
    title: "VibeTalent vs Freelancer — Which Is Better for Hiring Developers?",
    description:
      "VibeTalent ranks developers on verifiable proof of work — coding streaks, shipped projects, and GitHub activity. Freelancer.com runs on competitive bidding and reviews. Side-by-side comparison, fees, and which fits your hiring needs.",
    subtitle:
      "Which platform is better for hiring developers in 2026? A side-by-side breakdown.",
    tldr: "VibeTalent ranks developers on verifiable proof of work — daily coding streaks, deployed projects, and GitHub activity — while Freelancer.com runs on competitive bidding, where freelancers underbid each other and rankings lean on ratings and reviews that are easy to game. Pick VibeTalent if you want to hire on demonstrated shipping ability, especially AI-native builders using Claude Code, Cursor, or Bolt. Pick Freelancer if you want a huge global pool, contest-style sourcing, and the lowest possible bid for a well-defined task.",
    rows: [
      { feature: "Talent type", vt: "AI-native developers", them: "Generalist global freelancers" },
      { feature: "Ranking signal", vt: "GitHub streaks + shipped projects", them: "Bids + ratings + reviews" },
      { feature: "Verifiable proof of work", vt: true, them: false },
      { feature: "GitHub commit streak tracking", vt: true, them: false },
      { feature: "Project quality scoring from repo health", vt: true, them: false },
      { feature: "How you source talent", vt: "Browse merit rankings + VibeFinder Bot", them: "Post a project, collect bids" },
      { feature: "AI-powered hire matching", vt: "VibeFinder Bot", them: false },
      { feature: "Service fee for the freelancer", vt: "0%", them: "~10% or fixed fee" },
      { feature: "Crypto payments (USDC)", vt: true, them: false },
      { feature: "Milestone escrow", vt: false, them: true },
      { feature: "Contests & non-engineering roles", vt: false, them: true },
      { feature: "Public daily activity feed", vt: true, them: false },
    ],
    vtWins: [
      "You want to hire AI-native developers using Claude Code, Cursor, or Bolt",
      "You care about shipping evidence, not who bids the lowest",
      "You want to skip bidding wars and browse builders ranked on merit",
      "You want to pay in USDC with no platform fees",
      "You want verifiable signal instead of gameable reviews",
    ],
    themWins: [
      "You want the lowest possible bid for a clearly scoped task",
      "You need a very large global talent pool",
      "You like contest-style sourcing for design or naming work",
      "You need non-engineering roles alongside development",
      "You want milestone escrow for fixed-scope projects",
    ],
    faq: [
      {
        q: "What is the main difference between VibeTalent and Freelancer?",
        a: "Freelancer.com is a bidding marketplace: you post a project and freelancers compete on price, with rankings driven by ratings, reviews, and completion rate — signals that can be gamed. VibeTalent removes bidding entirely and ranks developers on verifiable data: GitHub commit streaks, deployed project quality, repo health, and peer endorsements that refresh daily and cannot be faked.",
      },
      {
        q: "Is VibeTalent cheaper than Freelancer?",
        a: "VibeTalent is free for both developers and clients, with no service fee on hires and no commission on payments. Freelancer.com typically charges freelancers around a 10% (or fixed minimum) project fee and adds project and milestone fees for clients on top.",
      },
      {
        q: "Is bidding better than ranking developers on proof of work?",
        a: "Bidding optimizes for the lowest price, which often means a race to the bottom rather than the best builder. VibeTalent ranks developers on demonstrated ability — coding streaks, shipped projects, and repo quality — so you start from proven builders instead of sorting through bids and hoping the reviews are real.",
      },
      {
        q: "Does Freelancer show GitHub data?",
        a: "No. Freelancer.com ranks talent on bids, ratings, reviews, and on-platform completion history, not on code. VibeTalent makes GitHub activity the core ranking signal — coding streak length alone is 40% of a developer's vibe score, with deployed project quality and repo health on top.",
      },
      {
        q: "Is Freelancer or VibeTalent better for a one-off project?",
        a: "Freelancer is better when you want competitive bids on a clearly scoped, often non-engineering task and value milestone escrow. VibeTalent is better when you need a developer who can ship a working product fast — a prototype or an ongoing build — because it surfaces builders proven to ship consistently rather than those who simply bid the lowest.",
      },
    ],
    dateModified: "2026-06-05",
  },
];

export function getComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}
