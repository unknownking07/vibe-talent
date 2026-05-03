import { NextResponse } from "next/server";
import { getPriceSnapshot, formatUsd, type PriceSnapshot } from "@/lib/pricing";

function buildLlmsTxt(p: PriceSnapshot): string {
  // Compute the displayed discounts from the live snapshot so they stay
  // honest when admin changes prices on-chain.
  const weekDiscount = Math.round((1 - p.week / 7 / p.day) * 100);
  const monthDiscount = Math.round((1 - p.month / 30 / p.day) * 100);

  return `# VibeTalent

> The marketplace for vibe coders who actually ship.

VibeTalent is a developer talent marketplace that ranks software engineers by coding consistency, shipped projects, and community endorsements rather than traditional resumes.

## Key Concepts

- **Vibe Coding**: Building software using AI-powered IDEs (Claude Code, Cursor, Bolt, etc.) with a focus on shipping fast and consistently.
- **Vibe Score**: A reputation metric calculated from a developer's streak, project quality, GitHub activity, and peer endorsements.
- **Streaks**: Consecutive days a developer has committed code. Streaks are the core trust signal on VibeTalent.
- **Badge Levels**: Bronze (30-day streak), Silver (90-day), Gold (180-day), Diamond (365-day).
- **Quality Score**: A per-project metric based on GitHub repo health — community engagement, code substance, and maintenance activity.

## How It Works

1. Developers sign up and connect their GitHub profiles.
2. They add projects with live URLs that get verified.
3. The platform tracks their daily coding streak and calculates a vibe score.
4. Clients browse builders by tech stack, badge level, and streak — or use the AI agent to get matched automatically.

## Key Pages

- Homepage: https://www.vibetalent.work/
- Explore Talent: https://www.vibetalent.work/explore
- Leaderboard: https://www.vibetalent.work/leaderboard
- Roadmap: https://www.vibetalent.work/roadmap
- AI Agent (find talent): https://www.vibetalent.work/agent
- AI Agent (chat): https://www.vibetalent.work/agent/chat
- Featured Project Pricing: https://www.vibetalent.work/pricing

## Featured Project Promotion (USDC, live now)

Builders can pay to feature a shipped project at the top of the homepage Featured Projects section. Payment is in USDC on Base or Solana — prices read live from the on-chain contract on Base (0x2cDB438f418f5cb53e8Ea87cFD981397FDe3d0da). No platform fees on top of the on-chain price.

Tiers:
- **Day** — ${formatUsd(p.day)} USDC, 24 hours.
- **Week** — ${formatUsd(p.week)} USDC, 7 days. ~${weekDiscount}% off the daily rate.
- **Month** — ${formatUsd(p.month)} USDC, 30 days. ~${monthDiscount}% off the daily rate. Best value tier.
- **Lifetime** — ${formatUsd(p.annual)} USDC. Slot persists indefinitely until the contract is upgraded or removed.

When a paid slot expires it returns to the available pool automatically. Removed slots (content guideline violations) refund the unused paid time to the original wallet. Full pricing, guidelines, and FAQ at https://www.vibetalent.work/pricing.

This is the existing USDC-based featuring product. The $VIBE-token-based featuring (a separate $1 utility) activates in Q2 2026 — see roadmap.

## $VIBE Token

- **Status**: Live on Solana.
- **Contract address**: FfDYT3WqimMw7itMxw4kYJ26GPG78RfpZmepQCFpBAGS
- **Chain**: Solana
- **Utility activation**: Q2 2026 (streak protect + project featuring — see roadmap).
- **Classification**: Utility token only. Not an investment, not financial advice, not a security. $VIBE can go to zero.
- **Creator fee**: The creator receives a fee on $VIBE trades. That fee is reinvested directly into building VibeTalent — shipping new features, covering infrastructure, and growing the platform. Openly disclosed for transparency and not a reason to buy.
- **Focus**: Utility and shipping, not price action or speculation.

## 2026 Roadmap Summary

- **Q2 2026** — $VIBE token utility activates. $1 streak protect (burn $VIBE to save a missed-day streak) and $1 project featuring (promote a shipped project on the homepage/explore feed). Token is already live on Solana at FfDYT3WqimMw7itMxw4kYJ26GPG78RfpZmepQCFpBAGS.
- **Q3 2026** — Stake-to-vouch profiles (vouchers stake $VIBE behind builders they believe in) and Ethereum USDC support. USDC payments on Base and Solana are already live; Q3 adds Ethereum as the third supported chain.
- **Q4 2026** — Try-before-you-hire ($50 paid 1-hour trial tasks), squad hiring (hire a pod of dev + designer + PM), recurring retainers, auto-generated portfolios from GitHub deploys, public shipping radar digest, and a "Built by a VibeTalent builder" GitHub PR badge.

## Who Uses VibeTalent

- **Developers** who want to build a reputation based on proof of work rather than resumes.
- **Clients and founders** looking to hire developers with verified track records of consistent shipping.

## Machine-Readable Resources

- OpenAPI Spec: https://www.vibetalent.work/api/v1/openapi
- AI Plugin Manifest: https://www.vibetalent.work/.well-known/ai-plugin.json
- Agent Skill File: https://www.vibetalent.work/skill.md
- Extended Docs: https://www.vibetalent.work/llms-full.txt

## API Endpoints

- GET /api/v1/builders — Search builders by skills, streak, vibe score
- GET /api/v1/builders/:username — Full builder profile with projects and stats
- POST /api/v1/hire — Send a hire request to any builder


## Contact

- Built by @abhiontwt
- Website: https://www.vibetalent.work
- GitHub: https://github.com/unknownking07/vibe-talent
`;
}

export async function GET() {
  const prices = await getPriceSnapshot();
  return new NextResponse(buildLlmsTxt(prices), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Match the inner snapshot revalidate window so an admin price update
      // propagates within ~5 min instead of the previous 24h staleness.
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
