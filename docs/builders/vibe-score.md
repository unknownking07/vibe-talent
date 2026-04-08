# Understanding Your Vibe Score

Your **Vibe Score** is the single number that represents your reputation on VibeTalent. It's what clients see first, it determines your leaderboard ranking, and it's how the AI agent evaluates you.

You can't buy it. You can only earn it — through consistent work and quality output.

## How It's Calculated

Your Vibe Score is made up of four components:

```text
Vibe Score = Streak Points + Project Quality Score + Badge Bonus + Review Bonus
```

### 1. Streak Points

```text
Current Streak × 2
```

Every day you log coding activity adds 2 points. A 30-day streak = 60 streak points. If your streak resets, these points go to zero — but you can rebuild.

### 2. Project Quality Score

Each project you add earns points based on how complete and polished it is:

| Quality Signal | Points | How to Earn |
|---|---|---|
| **Base (verified project)** | 5 pts | Verify your GitHub ownership |
| **Base (unverified project)** | 1 pt | Add any project |
| **Live URL** | +3 pts | Deploy your project and add the link |
| **GitHub URL** | +2 pts | Link your source code |
| **Detailed description** | +2 pts | Write 50+ characters describing what it does |
| **Screenshot** | +1 pt | Upload a preview image |
| **Tech stack (3+)** | +2 pts | List at least 3 technologies |

**Max per verified project: 15 detail points.** When GitHub quality analysis runs, the Vibe Score contribution is capped at **10 points** per project (based on quality_score). Verified projects without quality data contribute **5 points**. Unverified projects earn **1 point**.

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

```text
Review Bonus = avg_rating × number_of_reviews × 2 (capped at 50)
```

Three 5-star reviews = `5 × 3 × 2 = 30` bonus points. This rewards builders who actually deliver quality work.

## Quality vs Consistency

**Consistency gets you noticed. Quality makes you hireable.**

VibeTalent rewards both — but quality signals carry serious weight. Here's a real comparison:

| Builder | Streak | Projects | Details | Reviews | Vibe Score |
|---|---|---|---|---|---|
| **Streak-focused** | 100 days | 2 unverified, no live URLs | Minimal | None | (100×2) + (2×1) + 0 + 0 = **202** |
| **Quality-focused** | 30 days | 5 verified, full details | Live demos, screenshots | 3 five-star reviews | (30×2) + (5×15) + 10 + 30 = **175** |

The streak builder is ahead — but as soon as their streak breaks, they drop. The quality builder's score is **resilient**: projects and reviews don't go away.

And when a client is choosing who to hire? They're looking at live demos, verified projects, and reviews — not just a streak number.

## How to Increase Your Vibe Score

### Quick wins

1. **Verify your projects** — 5x the points vs unverified
2. **Add live URLs** — +3 points per project, and clients love seeing live demos
3. **Write detailed descriptions** — 50+ characters earns +2 per project
4. **Add screenshots** — +1 point and makes your profile look professional
5. **List your full tech stack** — 3+ technologies earns +2 per project

### Long-term growth

1. **Maintain your streak** — log activity daily for steady point growth
2. **Ship more projects** — each verified project contributes up to 10 Vibe Score points
3. **Earn badges** — permanent bonus that never goes away
4. **Get client reviews** — deliver great work and ask clients to review you
5. **Connect GitHub** — auto-log activity so you never miss a day

## Where Your Score Appears

Your Vibe Score shows up everywhere:

- Your **public profile** — front and center
- **Explore page** — clients sort by Vibe Score by default
- **Leaderboard** — the main ranking
- **AI matching** — the agent weighs your score when recommending you
- **Share card** — your auto-generated social media card includes it
