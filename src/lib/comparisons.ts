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
    title: "VibeTalent vs Fiverr: Which Is Better for Hiring Developers?",
    description:
      "VibeTalent ranks developers on verifiable proof of work: coding streaks, shipped projects, and GitHub activity. Fiverr is a gig marketplace where sellers are ranked by levels and star reviews. Side-by-side comparison, fees, and which fits your hiring needs.",
    subtitle:
      "Which platform is better for hiring developers in 2026? A side-by-side breakdown.",
    tldr: "VibeTalent focuses on AI-assisted developers and shows GitHub activity, shipped projects, client reviews, and peer endorsements. Fiverr offers fixed-price gigs across many categories. Pick VibeTalent when you want to inspect a builder's public work and agree terms directly. Pick Fiverr when you prefer a packaged task with a defined price and marketplace-managed order. On either platform, check relevant work samples and agree on scope; activity and ratings alone do not guarantee delivery.",
    rows: [
      { feature: "Talent type", vt: "AI-native developers", them: "Generalist gig freelancers" },
      { feature: "Ranking signal", vt: "GitHub streaks + shipped projects", them: "Seller level + star reviews" },
      { feature: "Work samples to review", vt: "Projects + linked repositories", them: "Gig portfolios" },
      { feature: "GitHub commit streak tracking", vt: true, them: false },
      { feature: "Project quality scoring from repo health", vt: true, them: false },
      { feature: "AI-powered hire matching", vt: "VibeFinder Bot", them: "Category & gig search" },
      { feature: "Pricing model", vt: "Direct hire, negotiate freely", them: "Fixed-price gig packages" },
      { feature: "Service fee for the freelancer", vt: "0%", them: "~20% commission" },
      { feature: "Hiring payments", vt: "Agreed directly with the builder", them: "Managed through Fiverr" },
      { feature: "Built-in order protection", vt: false, them: true },
      { feature: "Non-engineering roles", vt: false, them: true },
      { feature: "Public daily activity feed", vt: true, them: false },
    ],
    vtWins: [
      "You want to hire AI-native developers using Claude Code, Cursor, or Bolt",
      "You care more about shipping evidence than star ratings",
      "You want to agree payment terms directly with a builder",
      "You need a builder who can prototype and ship in days, not a canned package",
      "You want to inspect project evidence alongside client reviews",
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
        a: "Fiverr offers packaged freelance gigs across many categories. VibeTalent focuses on AI-assisted developers and presents GitHub activity, shipped projects, repository quality signals, client reviews, and endorsements. These signals help you inspect work, but none is fraud-proof or a delivery guarantee.",
      },
      {
        q: "Is VibeTalent cheaper than Fiverr?",
        a: "VibeTalent is free for both developers and clients. There is no service fee on hires and no commission on payments. The only paid feature is optional Featured Projects placement, priced in USDC with no platform markup. Fiverr typically takes around a 20% commission from the seller and adds a service fee for the buyer on top of the gig price.",
      },
      {
        q: "Can I hire AI-native developers on Fiverr?",
        a: "You can find developers advertising AI-tool experience on both platforms. VibeTalent focuses on AI-assisted builders and shows their projects and GitHub-linked activity. That activity does not prove which AI tools were used; ask for relevant demos and discuss how the developer tests and reviews generated code.",
      },
      {
        q: "How does GitHub activity contribute to VibeTalent's rankings?",
        a: "The vibe score combines activity streaks, contribution volume, projects, badges, client review bonuses, and endorsements. Streaks do not have a fixed percentage weight. Profiles expose linked repositories and project evidence so you can inspect relevant work alongside the score.",
      },
      {
        q: "Is Fiverr or VibeTalent better for a one-off task?",
        a: "Fiverr is better for a small, well-defined, fixed-price task: especially non-engineering work like a logo, a voiceover, or a short video. VibeTalent is better when you need a developer who can ship a real, working product, whether that is a one-week prototype or an ongoing build, because it surfaces builders proven to ship consistently.",
      },
    ],
    dateModified: "2026-10-04",
  },
  {
    slug: "toptal",
    name: "Toptal",
    competitorUrl: "https://www.toptal.com",
    tagline: "Public, verifiable merit vs a private \"top 3%\" screen.",
    title: "VibeTalent vs Toptal: Which Is Better for Hiring Developers?",
    description:
      "VibeTalent ranks developers on public, verifiable proof of work: coding streaks, shipped projects, and GitHub activity, free to use. Toptal is a premium network that vets the \"top 3%\" behind closed doors. Compare cost, vetting, and which fits your hiring needs.",
    subtitle:
      "Which platform is better for hiring developers in 2026? A side-by-side breakdown.",
    tldr: "VibeTalent and Toptal both promise quality but prove it differently. Toptal screens for the \"top 3%\" through a private vetting process and matches you with senior freelancers at premium, account-managed rates. VibeTalent makes the proof public: every builder is ranked on verifiable GitHub streaks, shipped projects, and repo quality you can inspect yourself: for free. Pick Toptal for hands-off, enterprise-grade staffing. Pick VibeTalent to hire AI-native builders fast, on transparent merit, with no markup and no gatekeeper.",
    rows: [
      { feature: "Talent type", vt: "AI-native developers", them: "Vetted senior freelancers" },
      { feature: "Ranking signal", vt: "Public GitHub streaks + shipped projects", them: "Private \"top 3%\" screen" },
      { feature: "You can inspect the evidence yourself", vt: true, them: false },
      { feature: "GitHub commit streak tracking", vt: true, them: false },
      { feature: "Project quality scoring from repo health", vt: true, them: false },
      { feature: "AI-powered hire matching", vt: "VibeFinder Bot", them: "Human account matcher" },
      { feature: "Cost to start", vt: "Free", them: "Premium + deposit" },
      { feature: "Platform fee for clients", vt: "0%", them: "Premium markup on rates" },
      { feature: "Hiring payments", vt: "Agreed directly with the builder", them: "Managed through Toptal" },
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
        a: "Toptal vets freelancers privately and markets them as the \"top 3%,\" then matches you through an account manager at premium rates, but you cannot inspect the screen yourself. VibeTalent makes vetting public and verifiable: every developer is ranked on GitHub commit streaks, deployed project quality, and repo health that you can check directly on their profile, for free.",
      },
      {
        q: "Is VibeTalent cheaper than Toptal?",
        a: "Yes. VibeTalent is free for both clients and developers, with no platform fee on hires. Toptal is a premium service. It does not publish flat rates, typically involves a refundable deposit to start, and bills clients at account-managed rates well above a typical freelance marketplace.",
      },
      {
        q: "Is VibeTalent's talent vetted like Toptal's?",
        a: "The vetting philosophy is the opposite. Toptal vets candidates behind closed doors and asks you to trust the result. VibeTalent puts the evidence in the open: a builder's coding streak, shipped projects with live URLs, repo quality, and vibe score are all public and update daily. You do the vetting in seconds by looking at real, verifiable work.",
      },
      {
        q: "Can I verify a Toptal developer's track record myself?",
        a: "Ask for relevant work samples and references on either platform. On VibeTalent, public profiles can include GitHub-linked activity, deployed projects, repository signals, client reviews, and endorsements. Those signals make a starting point for your own assessment; not every score component comes from GitHub.",
      },
      {
        q: "Is Toptal or VibeTalent better for enterprise hiring?",
        a: "Toptal is better when you need fully managed staffing with enterprise contracts, compliance, and a human matcher handling the process. VibeTalent is better when you want to hire AI-native builders fast on transparent merit, without a markup or gatekeeper: ideal for startups and teams that value shipping speed and proof of work.",
      },
    ],
    dateModified: "2026-10-04",
  },
  {
    slug: "freelancer",
    name: "Freelancer",
    competitorUrl: "https://www.freelancer.com",
    tagline: "Merit rankings vs competitive bidding wars.",
    title: "VibeTalent vs Freelancer: Which Is Better for Hiring Developers?",
    description:
      "VibeTalent ranks developers on verifiable proof of work: coding streaks, shipped projects, and GitHub activity. Freelancer.com runs on competitive bidding and reviews. Side-by-side comparison, fees, and which fits your hiring needs.",
    subtitle:
      "Which platform is better for hiring developers in 2026? A side-by-side breakdown.",
    tldr: "VibeTalent focuses on AI-assisted developers and shows public GitHub activity, shipped projects, client reviews, and endorsements. Freelancer.com lets clients post projects and compare bids across a wider range of roles. Pick VibeTalent to inspect public work and contact builders directly. Pick Freelancer.com when you want competitive bids, contests, or milestone payment management. For either route, assess relevant samples and define deliverables before agreeing to work together.",
    rows: [
      { feature: "Talent type", vt: "AI-native developers", them: "Generalist global freelancers" },
      { feature: "Ranking signal", vt: "GitHub streaks + shipped projects", them: "Bids + ratings + reviews" },
      { feature: "Work samples to review", vt: "Projects + linked repositories", them: "Portfolio samples" },
      { feature: "GitHub commit streak tracking", vt: true, them: false },
      { feature: "Project quality scoring from repo health", vt: true, them: false },
      { feature: "How you source talent", vt: "Browse merit rankings + VibeFinder Bot", them: "Post a project, collect bids" },
      { feature: "AI-powered hire matching", vt: "VibeFinder Bot", them: false },
      { feature: "Service fee for the freelancer", vt: "0%", them: "~10% or fixed fee" },
      { feature: "Hiring payments", vt: "Agreed directly with the builder", them: "Managed through Freelancer.com" },
      { feature: "Milestone escrow", vt: false, them: true },
      { feature: "Contests & non-engineering roles", vt: false, them: true },
      { feature: "Public daily activity feed", vt: true, them: false },
    ],
    vtWins: [
      "You want to hire AI-native developers using Claude Code, Cursor, or Bolt",
      "You care about shipping evidence, not who bids the lowest",
      "You want to skip bidding wars and browse builders ranked on merit",
      "You want to agree payment terms directly with a builder",
      "You want project evidence alongside client reviews",
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
        a: "Freelancer.com lets clients post projects and compare freelance bids. VibeTalent focuses on AI-assisted developers with public project evidence, GitHub activity, client reviews, and endorsements. You can contact builders directly after reviewing their work; those signals are not fraud-proof or a delivery guarantee.",
      },
      {
        q: "Is VibeTalent cheaper than Freelancer?",
        a: "VibeTalent is free for both developers and clients, with no service fee on hires and no commission on payments. Freelancer.com typically charges freelancers around a 10% (or fixed minimum) project fee and adds project and milestone fees for clients on top.",
      },
      {
        q: "Is bidding better than ranking developers on proof of work?",
        a: "Bidding optimizes for the lowest price, which often means a race to the bottom rather than the best builder. VibeTalent ranks developers on demonstrated ability (coding streaks, shipped projects, and repo quality) so you start from proven builders instead of sorting through bids and hoping the reviews are real.",
      },
      {
        q: "How does GitHub activity contribute to VibeTalent's rankings?",
        a: "The vibe score combines activity streaks, contribution volume, projects, badges, client review bonuses, and endorsements. Streaks do not have a fixed percentage weight. Inspect linked repositories and relevant project samples alongside the score when assessing a developer.",
      },
      {
        q: "Is Freelancer or VibeTalent better for a one-off project?",
        a: "Freelancer is better when you want competitive bids on a clearly scoped, often non-engineering task and value milestone escrow. VibeTalent is better when you need a developer who can ship a working product fast (a prototype or an ongoing build) because it surfaces builders proven to ship consistently rather than those who simply bid the lowest.",
      },
    ],
    dateModified: "2026-10-04",
  },
];

export function getComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}
