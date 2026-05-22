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
};

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    slug: "vibe-coding",
    title: "What is vibe coding?",
    shortLabel: "Vibe Coding",
    summary:
      "Vibe coding is the practice of building software using AI-powered IDEs and coding assistants — tools like Claude Code, Cursor, Bolt, and Windsurf. Instead of following long planning cycles, vibe coders stay in flow state, ship features daily, and let the working product speak louder than documentation. The goal is consistent output: commits every day, projects deployed, and a verifiable track record of shipping.",
    body: [
      "Vibe coding describes a shift in how software gets built. Traditional development cycles depend on lengthy specs, sprint planning, code reviews, and approvals before any production code ships. Vibe coding inverts that — the developer stays in a tight loop with an AI assistant, generates working code in minutes instead of hours, and pushes commits the same day. The cadence is measured in daily shipping, not biweekly sprints.",
      "The philosophy treats AI coding tools as the new primitive. Claude Code, Cursor, Bolt, and Windsurf handle boilerplate, scaffolding, and repetitive logic, freeing the developer to focus on product decisions, architecture, and rapid iteration. The result is that one motivated vibe coder can ship what previously took a full team — but only if they actually do it every day.",
      "Consistency matters more than raw talent in this model. A vibe coder with a 200-day coding streak is more valuable than one with a polished resume but irregular output, because the streak is verifiable proof of work that cannot be faked. That is why VibeTalent ranks developers on shipping signals — streaks, deployed projects, and repo health — instead of credentials.",
    ],
    related: ["vibe-coder", "coding-streak", "vibe-score"],
    metaDescription:
      "Vibe coding means building software with AI tools like Claude Code, Cursor, and Bolt — staying in flow, shipping every day, and letting working code be the resume.",
  },
  {
    slug: "vibe-coder",
    title: "What is a vibe coder?",
    shortLabel: "Vibe Coder",
    summary:
      "A vibe coder is a developer who builds software using AI-powered tools and ships code every single day. The defining traits are speed, consistency, and a public track record of working projects. Rather than relying on credentials or a polished resume, a vibe coder's reputation is verified by their coding streak, deployed projects, and quality of their GitHub activity.",
    body: [
      "Vibe coders are the next generation of independent builders. They use AI coding assistants — Claude Code, Cursor, Bolt, Windsurf, GitHub Copilot — as a force multiplier, not a crutch. The output is real, deployed software shipped at a cadence that traditional teams cannot match.",
      "The most distinctive trait is daily shipping. A vibe coder commits to GitHub every day, deploys updates frequently, and treats their public repos as a living portfolio. This is fundamentally different from a developer with a strong resume but sporadic output — clients can verify a vibe coder's work in seconds by checking their commit history, demo links, and project quality.",
      "VibeTalent surfaces vibe coders by ranking them on verifiable signals: coding streak length, project shipping rate, repo health (stars, forks, deployment status), and peer endorsements from other vibe coders. The leaderboard rewards builders who show up every day, not those who interview well.",
    ],
    related: ["vibe-coding", "coding-streak", "vibe-score"],
    metaDescription:
      "A vibe coder is a developer who ships code daily using AI tools and proves their skill through coding streaks, deployed projects, and public GitHub activity.",
  },
  {
    slug: "coding-streak",
    title: "What is a coding streak?",
    shortLabel: "Coding Streak",
    summary:
      "A coding streak is the number of consecutive days a developer has pushed at least one commit to a public GitHub repository. VibeTalent syncs streaks daily and resets them to zero if a full calendar day (UTC) passes without a commit. Streaks are the single hardest signal to fake — you cannot buy a 200-day streak — which makes them the most reliable proof of a developer's consistency and discipline.",
    body: [
      "Coding streaks measure raw consistency. A 30-day streak means 30 consecutive days of commits. A 365-day streak means a developer shipped code every single day for a year — including weekends, holidays, and travel. The longer the streak, the more meaningful the signal.",
      "VibeTalent tracks streaks automatically from GitHub. Any commit to any public repository counts. The streak resets to zero if a full UTC day passes without a commit, so there is no way to game it short of actually coding every day. Past streak achievements are preserved as permanent badges even if a current streak resets.",
      "For clients evaluating developers, streak length is often a stronger predictor of delivery reliability than years of experience or interview performance. A long streak demonstrates intrinsic motivation and the kind of sustained discipline that translates directly into project success. That is why VibeTalent weights streak length at 40% of the overall vibe score.",
    ],
    related: ["vibe-score", "vibe-coding", "vibe-coder"],
    metaDescription:
      "A coding streak counts consecutive days of GitHub commits. VibeTalent tracks streaks daily — they're the most unfakeable proof of a developer's consistency.",
  },
  {
    slug: "vibe-score",
    title: "What is a vibe score?",
    shortLabel: "Vibe Score",
    summary:
      "A vibe score is VibeTalent's composite reputation metric — a single number that summarizes how consistently and effectively a developer ships code. It combines four weighted inputs: coding streak (40%), project quality based on GitHub repo health (30%), GitHub activity such as commits, PRs, and reviews (20%), and peer endorsements weighted by the endorser's own vibe score (10%).",
    body: [
      "The vibe score exists because resumes, LinkedIn profiles, and interview performance are all easy to fake. A vibe score is not. Every input is pulled from verifiable, public data — GitHub commits, repository statistics, and endorsements from other ranked developers — and the formula is transparent.",
      "The 40/30/20/10 weighting reflects what actually matters for hiring decisions. Streak length is weighted highest because it is the hardest signal to game and the strongest predictor of future delivery. Project quality (deployment status, stars, forks, commit frequency) ranks next because shipped products beat abandoned side projects. GitHub activity covers the broader contribution surface — PRs, code reviews, issues. Peer endorsements add a social-graph layer but are deliberately weighted lightest to prevent collusion.",
      "Vibe scores update daily as new commits and project changes come in. The score is public on every developer's profile, used to rank the global leaderboard, and consumed by VibeFinder Bot to match clients with builders who fit a project's requirements.",
    ],
    related: ["coding-streak", "vibe-coder", "vibe-coding"],
    metaDescription:
      "A vibe score is VibeTalent's reputation metric: 40% streak + 30% project quality + 20% GitHub activity + 10% peer endorsements. Updated daily from verifiable data.",
  },
];

export function getGlossaryTerm(slug: string): GlossaryTerm | undefined {
  return GLOSSARY_TERMS.find((t) => t.slug === slug);
}
