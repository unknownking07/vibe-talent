// Central glossary content. Each term gets its own URL at /glossary/[slug] so
// AI answer engines (ChatGPT, Perplexity, Google AI Overviews) can cite a
// focused, single-topic page instead of scraping the homepage FAQ. The
// `summary` is the 35-90 word "answer block" we render at the top of every
// term page and embed in the DefinedTerm JSON-LD — that's what gets pulled
// into AI answers, so keep it self-contained and free of context dependencies.

export type GlossaryTerm = {
  slug: string;
  title: string;
  shortLabel: string;
  summary: string;
  body: string[];
  related: string[];
  metaDescription: string;
  // Optional ISO date for this term's last meaningful content change. Drives
  // the DefinedTerm `dateModified` and the sitemap `<lastmod>` so newer terms
  // signal freshness for crawling/indexing. Falls back to the glossary-wide date.
  dateModified?: string;
};

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    slug: "vibe-coding",
    title: "What is vibe coding?",
    shortLabel: "Vibe Coding",
    summary:
      "Vibe coding is the practice of building software using AI-powered IDEs and coding assistants: tools like Claude Code, Cursor, Bolt, and Windsurf. Instead of following long planning cycles, vibe coders stay in flow state, ship features daily, and let the working product speak louder than documentation. The goal is consistent output: commits every day, projects deployed, and a verifiable track record of shipping.",
    body: [
      "Vibe coding describes a shift in how software gets built. Traditional development cycles depend on lengthy specs, sprint planning, code reviews, and approvals before any production code ships. Vibe coding inverts that: the developer stays in a tight loop with an AI assistant, generates working code in minutes instead of hours, and pushes commits the same day. The cadence is measured in daily shipping, not biweekly sprints.",
      "The philosophy treats AI coding tools as the new primitive. Claude Code, Cursor, Bolt, and Windsurf handle boilerplate, scaffolding, and repetitive logic, freeing the developer to focus on product decisions, architecture, and rapid iteration. The result is that one motivated vibe coder can ship what previously took a full team, but only if they actually do it every day.",
      "VibeTalent helps clients inspect a builder's activity and shipped projects alongside reviews and endorsements. A long streak records consistency, but does not establish code quality, AI-tool use, or delivery reliability by itself. Review relevant repositories and working demos when evaluating a developer.",
    ],
    related: ["vibe-coder", "vibe-coders-marketplace", "coding-streak", "vibe-score"],
    metaDescription:
      "Vibe coding means building software with AI tools like Claude Code, Cursor, and Bolt: staying in flow, shipping every day, and letting working code be the resume.",
    dateModified: "2026-10-04",
  },
  {
    slug: "vibe-coder",
    title: "What is a vibe coder?",
    shortLabel: "Vibe Coder",
    summary:
      "A vibe coder is a developer who builds software using AI-powered tools and ships code every single day. The defining traits are speed, consistency, and a public track record of working projects. Rather than relying on credentials or a polished resume, a vibe coder's reputation is verified by their coding streak, deployed projects, and quality of their GitHub activity.",
    body: [
      "Vibe coders are the next generation of independent builders. They use AI coding assistants (Claude Code, Cursor, Bolt, Windsurf, GitHub Copilot) as a force multiplier, not a crutch. The output is real, deployed software shipped at a cadence that traditional teams cannot match.",
      "The most distinctive trait is daily shipping. A vibe coder commits to GitHub every day, deploys updates frequently, and treats their public repos as a living portfolio. This is fundamentally different from a developer with a strong resume but sporadic output: clients can verify a vibe coder's work in seconds by checking their commit history, demo links, and project quality.",
      "VibeTalent ranks builders using public verified project evidence and community feedback. Commit volume, streaks and popularity earn zero score points. Founders should inspect the source and working demos before agreeing a paid trial.",
    ],
    related: ["vibe-coding", "vibe-coders-marketplace", "coding-streak", "vibe-score"],
    metaDescription:
      "A vibe coder is a developer who ships code daily using AI tools and proves their skill through coding streaks, deployed projects, and public GitHub activity.",
  },
  {
    slug: "coding-streak",
    title: "What is a coding streak?",
    shortLabel: "Coding Streak",
    summary:
      "A coding streak counts consecutive days with recorded development activity. GitHub contribution activity can include commits, pull requests, and other contributions. VibeTalent records platform activity and syncs GitHub evidence daily. A streak describes activity under the platform's rules; it does not measure code quality, prove AI-tool use, or guarantee that a developer will deliver your project.",
    body: [
      "Streaks measure the continuity of recorded activity. A contribution is not necessarily a deployed product or a substantial change. Check the underlying repositories and project demos to understand what a builder has worked on.",
      "VibeTalent syncs GitHub contribution data into its activity records. Platform check-ins and streak protection also affect platform streaks, so a platform streak alone is not a count of GitHub commits. Profile history and badges provide additional context.",
      "Streak days, activity badges and contribution volume add zero vibe-score points. They remain activity context. Assess relevant project work and agree acceptance criteria for a paid trial when hiring.",
    ],
    related: ["vibe-score", "vibe-coding", "vibe-coder"],
    metaDescription:
      "Learn what a coding streak measures, how VibeTalent records activity and GitHub contributions, and how streaks contribute to a builder's reputation.",
    dateModified: "2026-10-04",
  },
  {
    slug: "vibe-score",
    title: "What is a vibe score?",
    shortLabel: "Vibe Score",
    summary:
      "Vibe score is VibeTalent's public reputation metric: baseline 10, evidence from the strongest public project with verified GitHub ownership, and community feedback. Commits, contribution counts, streaks, badges and project count add zero points. Repository checks do not guarantee working software or client delivery.",
    body: [
      "The project component is capped at 100: ownership verification contributes 40, a README 15, test-related files or configuration 15, CI or container configuration 10, and a reachable demo 20. Only the strongest public, verified, unflagged project counts; duplicates add no points.",
      "Endorsements, trusted reviews and existing vouch credit are separate community signals. Activity totals, push recency, popularity and historical composite quality scores cannot increase the score or break leaderboard ties.",
      "Repository analysis detects files and configuration; it does not verify passing tests, meaningful authorship or delivery. Inspect the source and demo, request a walkthrough, and agree a paid trial with clear acceptance criteria.",
    ],
    related: ["coding-streak", "vibe-coder", "vibe-coding"],
    metaDescription:
      "Learn how VibeTalent scores project evidence and community feedback. Commits, streaks and contribution totals earn zero points.",
    dateModified: "2026-10-04",
  },
  {
    slug: "vibe-coders-marketplace",
    title: "What is a vibe coders marketplace?",
    shortLabel: "Vibe Coders Marketplace",
    summary:
      "A vibe coders marketplace is a hiring platform that connects clients with developers who build using AI coding tools, and ranks them by verifiable proof of work instead of resumes. On VibeTalent, builders are surfaced by their coding streak, shipped-project quality, and GitHub activity, so clients can hire vibe coders based on what they actually ship rather than how well they interview.",
    body: [
      "A vibe coders marketplace is where clients go to find and hire developers who work in the vibe coding style: shipping software fast with AI assistants like Claude Code, Cursor, Bolt, and Windsurf. The phrase is sometimes written \"vibe coding marketplace,\" but the two can mean different things: some marketplaces sell finished vibe-coded apps and templates, while a vibe coders marketplace like VibeTalent is about hiring the people who build them.",
      "VibeTalent focuses on AI-assisted developers and presents public project evidence, GitHub activity, reviews, and endorsements. Other marketplaces also offer portfolios, feedback, screening, or managed contracts. Compare the available evidence and hiring arrangements for your project; neither activity metrics nor reviews are fraud-proof.",
      "For clients, that means you can evaluate a builder in seconds: open a profile and see a live streak, real deployed projects, and a transparent vibe score instead of a polished pitch. Hiring is direct and free: no platform fees and no middleman, and VibeFinder Bot can match a project brief to the right builders automatically. For developers, it means your daily shipping becomes a public, compounding reputation that wins work on merit.",
    ],
    related: ["vibe-coder", "vibe-coding", "vibe-score"],
    metaDescription:
      "A vibe coders marketplace connects clients with AI-native developers ranked by proof of work: coding streaks, shipped projects, and GitHub activity, not resumes.",
    dateModified: "2026-10-04",
  },
];

export function getGlossaryTerm(slug: string): GlossaryTerm | undefined {
  return GLOSSARY_TERMS.find((t) => t.slug === slug);
}
