# Understanding Your Vibe Score

Your **Vibe Score** is the single number that represents your reputation on VibeTalent. It's what clients see first, it determines your leaderboard ranking, and it's how the AI agent evaluates you.

You can't buy it. You can only earn it — through consistent work and quality output.

## How It's Calculated

Your Vibe Score is made up of eight components:

```text
Vibe Score = 10 (baseline)
           + Streak Points
           + Project Score
           + Endorsements
           + Badge Bonus
           + Review Bonus
           + Lifetime GitHub Bonus       ← rewards veteran builders
           + Recent Activity Bonus       ← rewards builders shipping right now
```

### 1. Streak Points

```text
Current Streak × 2
```

Every day you log coding activity adds 2 points. A 30-day streak = 60 streak points. If your streak resets, these points go to zero — but you can rebuild.

### 2. Project Score

Each project you add earns points:

| Signal | Points | How to Earn |
|---|---|---|
| **Upload a project** | 2 pts | Add any project to your profile |
| **Live URL** | +2 pts | Deploy your project and add the link |
| **GitHub repo** | +2 pts | Link your source code |
| **GitHub Quality Bonus** | up to +100 pts | Stars, forks, contributors, README, tests, CI/CD |

**Max per project: 106 points.** Every project counts — just uploading one earns 2 points. Projects with a GitHub repo are automatically analyzed for quality (stars, forks, contributors, README, tests, CI/CD, commit activity) and scored 0-100. That full score is added directly to your Vibe Score.

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

Each client review awards points based on the star rating:

| Rating | Points |
|---|---|
| 5-star | +20 pts |
| 4-star | +15 pts |
| 3-star | +10 pts |
| 2-star | +5 pts |
| 1-star | +0 pts |

Three 5-star reviews = `3 × 20 = 60` bonus points. There's no cap — every trusted review counts. Only reviews with a trust score of 30+ contribute to your Vibe Score (spam and bot reviews are filtered out).

### 5. Lifetime GitHub Bonus

Your full-year GitHub contribution count earns points on a square-root curve, capped at 250:

```text
min(floor(sqrt(lifetime_contributions)), 250)
```

| Lifetime commits | Bonus |
|---|---|
| 100 | +10 |
| 1,000 | +31 |
| 10,000 | +100 |
| 16,000 | +126 |
| 50,000 | +223 |
| 62,500+ | +250 (cap) |

This rewards builders who've been shipping for years — your reputation isn't reset because you took a break. The square-root curve gives veterans visible separation from casuals while still capping bot-scale outliers (so a 1M-commit account doesn't dwarf actual platform activity).

Connect your GitHub in your profile settings to enable this — the daily cron pulls from your public contribution heatmap.

### 6. Recent Activity Bonus

Commits in the last 30 days earn extra points, capped at +50:

```text
min(floor(contributions_30d × 0.5), 50)
```

| Last 30d commits | Bonus |
|---|---|
| 10 | +5 |
| 50 | +25 |
| 100+ | +50 (cap) |

This rewards builders who are *actively shipping right now*. Combined with the lifetime bonus, the score reflects both "are you a veteran" and "are you currently active" — neither alone, both together.

## Quality vs Consistency vs Volume

**Consistency gets you noticed. Quality makes you hireable. Volume proves you're a real builder.**

VibeTalent rewards all three. Here's how three real-shaped builders compare under the new scoring:

| Builder | Streak | Projects | Lifetime commits | Last 30d | Vibe Score |
|---|---|---|---|---|---|
| **Streak-focused** | 100 days | 2 projects, no URLs | 0 (no GitHub linked) | 0 | 10 + (100×2) + (2×2) + 0 + 0 + 0 + 0 + 0 = **214** |
| **Quality-focused** | 30 days | 5 projects, full URLs + quality 60 avg | 1,000 | 50 | 10 + (30×2) + (5×66) + 0 + 10 + 60 + 31 + 25 = **526** |
| **Veteran** | 0 days (just joined) | 1 verified project | 16,000 | 0 | 10 + 0 + 6 + 0 + 0 + 0 + 126 + 0 = **142** |

The quality builder leads — and their score is **resilient**: even if their streak resets, they still have ~400 points from projects, lifetime, reviews, and badges. The veteran, despite no streak and just one project, lands above the streak-only builder because their lifetime work is visible.

That's the design: no single dimension dominates. Volume credits lifetime contribution. Streak credits daily consistency. Project score and reviews credit shipped quality. Multiple paths to a strong score.

And when a client is choosing who to hire? They're looking at live demos, verified projects, reviews, and a real GitHub history — not just a streak number.

## How to Increase Your Vibe Score

### Quick wins

1. **Add projects** — every project earns 2 points just for uploading
2. **Add live URLs** — +2 points per project, and clients love seeing live demos
3. **Link GitHub repos** — +2 points per project

### Long-term growth

1. **Maintain your streak** — log activity daily for steady point growth
2. **Ship more projects** — each project with full URLs earns 6 points
3. **Earn badges** — permanent bonus that never goes away
4. **Get client reviews** — a 5-star review is worth 20 points
5. **Get endorsements** — each endorsement on your projects adds 5 points
6. **Connect GitHub** — unlocks the lifetime + recent-30d bonuses (up to +300 combined). If you have years of public commits, this alone can be worth more than every other component.

## Where Your Score Appears

Your Vibe Score shows up everywhere:

- Your **public profile** — front and center
- **Explore page** — clients sort by Vibe Score by default
- **Leaderboard** — the main ranking
- **AI matching** — the agent weighs your score when recommending you
- **Share card** — your auto-generated social media card includes it
