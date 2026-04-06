# Understanding Your Vibe Score

Your **Vibe Score** is the single number that represents your reputation on VibeTalent. It's what clients see first, it determines your leaderboard ranking, and it's how the AI agent evaluates you.

You can't buy it. You can only earn it — through quality output and consistent work.

## How It's Calculated

Your Vibe Score is made up of four components:

```
Vibe Score = Project Quality Score + Streak Points + Badge Bonus + Review Bonus
```

### 1. Project Quality Score (Primary Driver)

**Project quality is the most important factor in your Vibe Score.** How your project scores depends on whether it has a GitHub quality analysis:

#### Verified projects with GitHub quality score

When you verify a project that has a GitHub URL, VibeTalent analyzes the repo and computes a **Quality Score (0-100)** based on three dimensions:

| Dimension | Weight | What it measures |
|---|---|---|
| **Community** | 35% | Stars, forks, contributors, issues |
| **Substance** | 35% | Code size, languages, tests, CI/CD, README quality |
| **Maintenance** | 30% | Commit frequency, recency, sustained activity |

The quality score is displayed on your project card with an info button showing the full breakdown. Your Vibe Score contribution is `quality_score / 10` (max 10 points per project).

A hello-world repo scores near 0. A real project with tests, CI, and community engagement scores 70+.

#### Verified projects without GitHub quality score

If a verified project doesn't have a GitHub URL (or hasn't been analyzed yet), it uses the completeness scoring:

| Quality Signal | Points | How to Earn |
|---|---|---|
| **Base (verified project)** | 5 pts | Verify your GitHub ownership |
| **Live URL** | +3 pts | Deploy your project and add the link |
| **GitHub URL** | +2 pts | Link your source code |
| **Detailed description** | +2 pts | Write 50+ characters describing what it does |
| **Screenshot** | +1 pt | Upload a preview image |
| **Tech stack (3+)** | +2 pts | List at least 3 technologies |

**Max per verified project: 15 points**

#### Unverified projects

Unverified projects earn just **1 point** each. Verify to unlock full scoring.

**The takeaway: verified projects with real GitHub repos, live URLs, and quality code earn significantly more than raw streak points.** If you want a high Vibe Score, focus on shipping quality projects first.

### 2. Streak Points

```
Current Streak × 2
```

Every day you log coding activity adds 2 points. A 30-day streak = 60 streak points. If your streak resets, these points go to zero — but you can rebuild.

Streaks are valuable for showing you're active, but they're volatile. Projects are the stable foundation of a strong score.

### 3. Badge Bonus

Permanent bonus points based on your highest badge:

| Badge | Bonus |
|---|---|
| None | +0 |
| Bronze (30-day streak) | +10 |
| Silver (90-day streak) | +20 |
| Gold (180-day streak) | +30 |
| Diamond (365-day streak) | +40 |

### 4. Review Bonus

Client reviews directly impact your score:

```
Review Bonus = avg_rating × number_of_reviews × 2 (capped at 50)
```

Three 5-star reviews = `5 × 3 × 2 = 30` bonus points. This rewards vibecoders who actually deliver quality work.

Reviews are also scored for **trust** (0-100) to detect fake/bot reviews. Reviews from disposable emails, burst submissions, or accounts with no hire history get lower trust scores. Reviews with trust_score < 30 are excluded from your average rating.

## Quality vs Consistency

**Quality makes you hireable. Consistency keeps you visible.**

VibeTalent rewards both — but project quality is the primary driver of a strong, resilient score. Here's a real comparison:

| VibeCoder | Streak | Projects | Details | Reviews | Vibe Score |
|---|---|---|---|---|---|
| **Streak-only** | 100 days | 2 unverified, no live URLs | Minimal | None | (2×1) + (100×2) + 0 + 0 = **202** |
| **Quality-focused** | 30 days | 5 verified, full details | Live demos, screenshots | 3 five-star reviews | (5×15) + (30×2) + 10 + 30 = **175** |

The streak-only vibecoder is ahead — but as soon as their streak breaks, they drop to just **2 points** from projects. The quality-focused vibecoder's score is **resilient**: even if their streak resets, they still have **105 points** from projects, badges, and reviews. That's the power of building on quality.

## How to Increase Your Vibe Score

### High-impact (project quality)
1. **Verify your projects** — unlocks full quality scoring
2. **Write tests and set up CI** — directly boosts your substance score
3. **Add live URLs** — shows your project is deployed and working
4. **Maintain your repos** — recent commits and sustained activity boost maintenance score
5. **Build community** — stars, forks, and contributors boost community score
6. **Ship more projects** — each verified project contributes up to 10 points

### Steady growth (consistency + reputation)
7. **Maintain your streak** — log activity daily for steady point growth
8. **Earn badges** — permanent bonus that never goes away
9. **Get client reviews** — deliver great work and ask clients to review you
10. **Connect GitHub** — auto-log activity so you never miss a day
11. **Endorse others** — build community trust (must have an active account)

## Peer Endorsements

Other vibecoders can **endorse** your projects to signal quality. Endorsement counts are visible on project cards and factor into the AI agent's evaluation.

Anti-gaming rules for endorsements:
- You can't endorse your own projects
- One endorsement per user per project
- Must be signed in
- Account must be at least 7 days old
- Must have at least one project or streak activity
- Maximum 10 endorsements per day

## Where Your Score Appears

Your Vibe Score shows up everywhere:

- Your **public profile** — front and center
- **Explore page** — clients sort by Vibe Score by default
- **Leaderboard** — the main ranking
- **AI matching** — the agent weighs your score when recommending you
- **Share card** — your auto-generated social media card includes it
