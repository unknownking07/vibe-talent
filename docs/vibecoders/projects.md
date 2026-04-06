# Showcasing Your Projects

Projects are your **proof of work**. While streaks show you're active, projects show what you've actually built. Clients look at your projects to decide if you're the right fit for their job.

High-quality project listings also earn you significantly more Vibe Score points.

## Adding a Project

1. Go to your **Dashboard**
2. Scroll to the **Projects** section
3. Click **Add Project**
4. Fill in the details and save

## What Makes a Great Project Listing

Not all project listings are created equal. Here's what earns maximum points and catches a client's eye:

| Field | Required? | Vibe Score Impact | Tips |
|---|---|---|---|
| **Title** | Yes | — | Keep it clear and memorable |
| **Description** | Yes | +2 pts if >50 chars | Explain what the project does, who it's for, and what problem it solves |
| **Tech Stack** | Yes | +2 pts if 3+ items | List every technology used (React, TypeScript, Supabase, etc.) |
| **Live URL** | No | +3 pts | Deploy it! Even a simple Vercel deploy counts |
| **GitHub URL** | No | +2 pts | Show the code. Transparency builds trust |
| **Screenshot** | No | +1 pt | A picture is worth a thousand words |
| **Build Time** | No | — | Shows clients your speed ("Built in 3 days") |
| **Tags** | No | — | Helps categorization ("AI", "SaaS", "DevTool") |

**A fully filled-out, verified project earns up to 15 Vibe Score points.** An empty, unverified one earns just 1.

## Quality Score

Every project card displays a **Quality Score** (0-100) with a clickable info button showing the full breakdown.

### How it's computed

For verified projects with a GitHub URL, VibeTalent analyzes the repo at verification time:

- **Community (35%)** — Stars, forks, contributors, open issues
- **Substance (35%)** — Code size, language diversity, tests, CI/CD, README quality
- **Maintenance (30%)** — Commit frequency, recency, sustained development pace

The score appears as a colored badge on your project card:
- **Green (70+)** — Excellent quality
- **Amber (40-69)** — Good quality
- **Gray (<40)** — Needs improvement

Click the **info icon** next to the score to see the detailed breakdown with progress bars for each dimension, or a checklist of what you can improve.

### How to improve your quality score

1. **Write tests** — test suites significantly boost the substance score
2. **Set up CI/CD** — automated pipelines show professional practices
3. **Write a good README** — helps both substance and community scores
4. **Keep committing** — recent activity and sustained work rate boost maintenance
5. **Build community** — stars, forks, and contributors improve community score
6. **Deploy it** — a live URL shows the project is real and working

## Verifying Your Projects

Verified projects get a checkmark and unlock full quality scoring. There are two ways to verify:

### Method 1: Owner Match (Automatic)

If you signed up with GitHub and the project's GitHub URL points to a repo you own, it can be verified automatically.

### Method 2: Verification File

1. Create a file called `.vibetalent` in your repo's root
2. Add your VibeTalent username or user ID inside it
3. Click **Verify** on the project in your Dashboard
4. VibeTalent checks the file and verifies ownership

When you verify, VibeTalent also:
- Runs GitHub quality analysis on the repo
- Checks if the live URL is accessible
- Creates a notification confirming verification

## Peer Endorsements

Other vibecoders can **endorse** your projects by clicking the thumbs-up button on your project card. Endorsements signal peer validation and are visible to clients and the AI agent.

**Rules:**
- You can't endorse your own projects
- One endorsement per person per project
- Account must be 7+ days old with some activity
- Max 10 endorsements per day per user

Endorsement counts appear on every project card. They also factor into the AI agent's evaluation of your work.

## Live URL Health Checks

VibeTalent runs **weekly health checks** on all verified project URLs. If your live URL returns an error or is unreachable, it gets marked as down. Dead links are visible on your profile and factor into quality scoring.

Keep your deployments alive — or remove the URL if the project is no longer hosted.

## Tips for Standout Projects

### For Clients
- **Add a live URL** — Clients want to see your work in action, not just read about it
- **Write a real description** — "A todo app" is weak. "A full-stack task manager with real-time sync, team collaboration, and Stripe billing" tells a story
- **Show screenshots** — Especially for UI-heavy projects

### For Your Score
- **Verify every project** — Unlocks full quality scoring (1 pt unverified vs up to 10 pts verified)
- **Write tests and set up CI** — Directly boosts substance score
- **Keep repos active** — Recent commits boost maintenance score

### Quality Over Quantity
Five verified projects with high quality scores, live demos, and endorsements will always outrank twenty bare-bones entries. Focus on showcasing your best work.

## Spam Protection

VibeTalent has a community-driven report system:
- Anyone can report a project they think is fake or spam
- After **3 reports**, a project is automatically flagged and hidden
- Flagged projects don't count toward your Vibe Score
- You can undo your own report if it was a mistake

Keep your projects honest and real — that's what makes the platform trustworthy for everyone.
