import { Resend } from "resend";
import { getSiteUrl } from "@/lib/seo";

let resend: Resend | null = null;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getResend(): Resend | null {
  if (resend) return resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  resend = new Resend(apiKey);
  return resend;
}

const FROM = "VibeTalent <notifications@vibetalent.work>";
const REPLY_TO = "hello@vibetalent.work";

function unsubUrl(email: string) {
  return `${getSiteUrl()}/settings?tab=emails&ref=unsubscribe&email=${encodeURIComponent(email)}`;
}

function sendEmail(client: Resend, opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  return client.emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    headers: {
      "List-Unsubscribe": `<${unsubUrl(opts.to)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

export const BRAND = {
  ink: "#FAFAFA",
  paper: "#141414",
  bg: "#0A0A0A",
  bgSoft: "#1C1C1C",
  hairline: "#2A2A2A",
  textBody: "#B5B5B5",
  textMuted: "#7A7A7A",
  accent: "#FF3A00",
  accentText: "#FFFFFF",
  warn: "#FF5C5C",
  star: "#FFB935",
  fontSans: `'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`,
  fontMono: `'JetBrains Mono', SFMono-Regular, ui-monospace, Menlo, Monaco, Consolas, monospace`,
};

export function renderEmail(opts: {
  preheader: string;
  body: string;
  footerContext: string;
  unsubLink: string;
  logoUrl?: string;
}): string {
  const siteUrl = getSiteUrl();
  const logoUrl = opts.logoUrl ?? `${siteUrl}/logo.png`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>VibeTalent</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:${BRAND.fontSans};color:${BRAND.ink};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND.bg};opacity:0;">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.bg}" style="background:${BRAND.bg};">
<tr><td bgcolor="${BRAND.bg}" align="center" style="padding:48px 16px;background:${BRAND.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${BRAND.paper};">
<tr><td bgcolor="${BRAND.accent}" style="height:3px;background:${BRAND.accent};font-size:0;line-height:3px;mso-line-height-rule:exactly;">&nbsp;</td></tr>
<tr><td style="padding:28px 40px 22px;border-bottom:1px solid ${BRAND.hairline};">
<a href="${siteUrl}" style="text-decoration:none;color:${BRAND.ink};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
<tr>
<td valign="middle" style="vertical-align:middle;padding-right:14px;line-height:0;">
<img src="${logoUrl}" width="36" height="36" alt="VibeTalent" style="display:block;width:36px;height:36px;border:0;outline:none;text-decoration:none;border-radius:50%;" />
</td>
<td valign="middle" style="vertical-align:middle;font-family:${BRAND.fontSans};font-size:19px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.ink};">VIBE TALENT</td>
</tr>
</table>
</a>
</td></tr>
<tr><td style="padding:36px 40px 40px;font-family:${BRAND.fontSans};color:${BRAND.ink};">
${opts.body}
</td></tr>
<tr><td style="padding:22px 40px 26px;border-top:1px solid ${BRAND.hairline};background:${BRAND.bgSoft};font-family:${BRAND.fontSans};">
<p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${BRAND.textMuted};">
${opts.footerContext}
</p>
<p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.textMuted};">
<a href="${opts.unsubLink}" style="color:${BRAND.textMuted};text-decoration:underline;">Unsubscribe</a>
&nbsp;·&nbsp;
<a href="${siteUrl}" style="color:${BRAND.textMuted};text-decoration:underline;">vibetalent.work</a>
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function eyebrow(text: string, color: string = BRAND.accent): string {
  return `<p style="margin:0 0 14px;font-family:${BRAND.fontMono};font-size:11px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:${color};">${text}</p>`;
}

export function headline(text: string): string {
  return `<h1 style="margin:0 0 18px;font-family:${BRAND.fontSans};font-size:28px;line-height:1.2;font-weight:600;letter-spacing:-0.02em;color:${BRAND.ink};">${text}</h1>`;
}

export function paragraph(html: string, marginBottom: number = 28): string {
  return `<p style="margin:0 0 ${marginBottom}px;font-family:${BRAND.fontSans};font-size:16px;line-height:1.65;color:${BRAND.textBody};">${html}</p>`;
}

export function cta(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 0;">
<tr><td bgcolor="${BRAND.accent}" style="background:${BRAND.accent};">
<a href="${href}" style="display:inline-block;background:${BRAND.accent};color:${BRAND.accentText};padding:14px 26px;text-decoration:none;font-family:${BRAND.fontSans};font-size:14px;font-weight:600;letter-spacing:-0.005em;mso-padding-alt:0;">
${label}<span style="margin-left:8px;">→</span>
</a>
</td></tr>
</table>`;
}

export function inlineSecondary(href: string, label: string): string {
  return `<p style="margin:18px 0 0;font-family:${BRAND.fontSans};font-size:14px;line-height:1.5;color:${BRAND.textMuted};">${label.replace("{LINK}", `<a href="${href}" style="color:${BRAND.ink};text-decoration:underline;">`)}</p>`;
}

export function quoteCard(opts: { kicker: string; title: string; body?: string }): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;background:${BRAND.bgSoft};">
<tr><td style="padding:18px 22px;border-left:2px solid ${BRAND.accent};">
<p style="margin:0 0 6px;font-family:${BRAND.fontMono};font-size:10px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.textMuted};">${escapeHtml(opts.kicker)}</p>
<p style="margin:0${opts.body ? " 0 10px" : ""};font-family:${BRAND.fontSans};font-size:15px;font-weight:600;color:${BRAND.ink};">${opts.title}</p>
${opts.body ? `<p style="margin:0;font-family:${BRAND.fontSans};font-size:15px;line-height:1.6;color:${BRAND.textBody};">${opts.body}</p>` : ""}
</td></tr>
</table>`;
}

function statCell(opts: {
  value: string | number;
  label: string;
  accent?: boolean;
  borderRight?: boolean;
  borderBottom?: boolean;
  side: "left" | "right";
}): string {
  const valueColor = opts.accent ? BRAND.accent : BRAND.ink;
  const padding = opts.side === "left"
    ? `${opts.borderBottom ? "22px" : "26px"} 24px ${opts.borderBottom ? "26px" : "0"} 0`
    : `${opts.borderBottom ? "22px" : "26px"} 0 ${opts.borderBottom ? "26px" : "0"} 24px`;
  const borders: string[] = [];
  if (opts.borderRight) borders.push(`border-right:1px solid ${BRAND.hairline}`);
  if (opts.borderBottom) borders.push(`border-bottom:1px solid ${BRAND.hairline}`);
  return `<td valign="top" width="50%" style="padding:${padding};${borders.join(";")};">
<div style="font-family:${BRAND.fontSans};font-size:40px;font-weight:600;letter-spacing:-0.03em;color:${valueColor};line-height:1;">${opts.value}</div>
<div style="margin-top:10px;font-family:${BRAND.fontMono};font-size:11px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND.textMuted};">${opts.label}</div>
</td>`;
}

export function renderStatsGrid(stats: {
  profileViews: number;
  streakDays: number;
  vibeScore: number;
  hireRequests: number;
}): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px;border-top:1px solid ${BRAND.hairline};">
<tr>
${statCell({ value: stats.profileViews, label: "Profile views", side: "left", borderRight: true, borderBottom: true })}
${statCell({ value: stats.streakDays, label: "Day streak", side: "right", accent: stats.streakDays > 0, borderBottom: true })}
</tr>
<tr>
${statCell({ value: stats.vibeScore, label: "Vibe score", side: "left", borderRight: true })}
${statCell({ value: stats.hireRequests, label: "Hire requests", side: "right" })}
</tr>
</table>`;
}

interface HireNotificationParams {
  builderEmail: string;
  builderUsername: string;
  senderName: string;
  message: string;
  requestId: string;
}

/**
 * Send an email notification to a builder when they receive a new hire request.
 * Fire-and-forget — never throws.
 */
export async function sendHireNotification({
  builderEmail,
  builderUsername,
  senderName,
  message,
  requestId,
}: HireNotificationParams): Promise<void> {
  const client = getResend();
  if (!client) {
    console.warn("Resend not configured — skipping hire notification email");
    return;
  }

  const siteUrl = getSiteUrl();
  const dashboardUrl = `${siteUrl}/dashboard`;
  const chatUrl = `${siteUrl}/hire/chat/${requestId}`;
  const trimmed = message.slice(0, 200);
  const truncated = message.length > 200 ? "…" : "";

  const body = `
${eyebrow("Hire request")}
${headline(`${escapeHtml(senderName)} wants to work with you`)}
${paragraph(`Hey <strong>@${escapeHtml(builderUsername)}</strong>, you just received a new hire request on VibeTalent.`)}
${quoteCard({
  kicker: "Message",
  title: escapeHtml(senderName),
  body: `&ldquo;${escapeHtml(trimmed)}${truncated}&rdquo;`,
})}
${cta(chatUrl, "Open chat")}
${inlineSecondary(dashboardUrl, `Or {LINK}view in dashboard</a>.`)}
`;

  try {
    await sendEmail(client, {
      to: builderEmail,
      subject: `New hire request from ${senderName}`,
      text: `Hey @${builderUsername}, you've received a new hire request.\n\nFrom: ${senderName}\n"${trimmed}${truncated}"\n\nOpen chat: ${chatUrl}\nView in dashboard: ${dashboardUrl}\n\nUnsubscribe: ${unsubUrl(builderEmail)}`,
      html: renderEmail({
        preheader: `${senderName}: ${trimmed.slice(0, 90)}${trimmed.length > 90 ? "…" : ""}`,
        body,
        footerContext: "You received this because someone sent you a hire request on VibeTalent.",
        unsubLink: unsubUrl(builderEmail),
      }),
    });
  } catch (error) {
    console.error("Failed to send hire notification email:", error);
  }
}

/**
 * Send an email when a user hits a streak milestone. Fire-and-forget.
 */
export async function sendStreakMilestoneEmail({
  email,
  username,
  streakDays,
}: {
  email: string;
  username: string;
  streakDays: number;
}): Promise<void> {
  const client = getResend();
  if (!client) return;

  const siteUrl = getSiteUrl();

  const body = `
${eyebrow("Streak milestone")}
${headline(`${streakDays} days strong`)}
${paragraph(`Hey <strong>@${escapeHtml(username)}</strong>, you've shipped on VibeTalent for <strong>${streakDays} consecutive days</strong>. Keep the momentum going.`)}
${cta(`${siteUrl}/dashboard`, "View dashboard")}
`;

  try {
    await sendEmail(client, {
      to: email,
      subject: `${streakDays} days strong`,
      text: `Hey @${username}, you've shipped on VibeTalent for ${streakDays} consecutive days. Keep the momentum going.\n\nView dashboard: ${siteUrl}/dashboard\n\nUnsubscribe: ${unsubUrl(email)}`,
      html: renderEmail({
        preheader: `${streakDays} consecutive days of shipping. That's not luck.`,
        body,
        footerContext: "You received this because you hit a streak milestone on VibeTalent.",
        unsubLink: unsubUrl(email),
      }),
    });
  } catch (error) {
    console.error("Failed to send streak milestone email:", error);
  }
}

/**
 * Send an email when a user earns a new badge. Fire-and-forget.
 */
export async function sendBadgeEarnedEmail({
  email,
  username,
  badgeLevel,
}: {
  email: string;
  username: string;
  badgeLevel: string;
}): Promise<void> {
  const client = getResend();
  if (!client) return;

  const siteUrl = getSiteUrl();
  const badgeName = badgeLevel.charAt(0).toUpperCase() + badgeLevel.slice(1);

  const body = `
${eyebrow("Badge unlocked")}
${headline(`The ${escapeHtml(badgeName)} badge is yours`)}
${paragraph(`Congrats <strong>@${escapeHtml(username)}</strong>. Your consistency just earned the <strong>${escapeHtml(badgeName)}</strong> badge — it lives on your profile permanently.`)}
${cta(`${siteUrl}/dashboard`, "View your profile")}
`;

  try {
    await sendEmail(client, {
      to: email,
      subject: `${badgeName} badge unlocked`,
      text: `Congrats @${username}! Your consistency has earned you the ${badgeName} badge. It now lives on your profile permanently.\n\nView your profile: ${siteUrl}/dashboard\n\nUnsubscribe: ${unsubUrl(email)}`,
      html: renderEmail({
        preheader: `The ${badgeName} badge is now permanently on your profile.`,
        body,
        footerContext: "You received this because you earned a new badge on VibeTalent.",
        unsubLink: unsubUrl(email),
      }),
    });
  } catch (error) {
    console.error("Failed to send badge earned email:", error);
  }
}

/**
 * Send an email when a project is verified. Fire-and-forget.
 */
export async function sendProjectVerifiedEmail({
  email,
  username,
  projectTitle,
}: {
  email: string;
  username: string;
  projectTitle: string;
}): Promise<void> {
  const client = getResend();
  if (!client) return;

  const siteUrl = getSiteUrl();

  const body = `
${eyebrow("Project verified")}
${headline(`${escapeHtml(projectTitle)} is now verified`)}
${paragraph(`Hey <strong>@${escapeHtml(username)}</strong>, your project is verified and now shows the verified mark across your profile and listings.`)}
${cta(`${siteUrl}/dashboard`, "View dashboard")}
`;

  try {
    await sendEmail(client, {
      to: email,
      subject: `${projectTitle} is now verified`,
      text: `Hey @${username}, your project "${projectTitle}" has been verified. It now shows a verified mark across your profile and listings.\n\nView dashboard: ${siteUrl}/dashboard\n\nUnsubscribe: ${unsubUrl(email)}`,
      html: renderEmail({
        preheader: `Verified mark now showing on ${projectTitle}.`,
        body,
        footerContext: "You received this because your project was verified on VibeTalent.",
        unsubLink: unsubUrl(email),
      }),
    });
  } catch (error) {
    console.error("Failed to send project verified email:", error);
  }
}


/**
 * Send an email warning a user their streak is about to end. Fire-and-forget.
 */
export async function sendStreakWarningEmail({
  email,
  username,
  streakDays,
}: {
  email: string;
  username: string;
  streakDays: number;
}): Promise<void> {
  const client = getResend();
  if (!client) return;

  const siteUrl = getSiteUrl();

  const body = `
${eyebrow("Time-sensitive", BRAND.warn)}
${headline(`Your ${streakDays}-day streak ends today`)}
${paragraph(`Hey <strong>@${escapeHtml(username)}</strong>, you have less than 6 hours to log activity before your <strong>${streakDays}-day streak</strong> resets to zero. Don't let it slip.`)}
${cta(`${siteUrl}/dashboard`, "Log activity now")}
`;

  try {
    await sendEmail(client, {
      to: email,
      subject: `Your ${streakDays}-day streak ends today`,
      text: `Hey @${username}, your ${streakDays}-day streak will reset within the next 6 hours if you don't log activity today. Don't let it slip.\n\nLog activity now: ${siteUrl}/dashboard\n\nUnsubscribe: ${unsubUrl(email)}`,
      html: renderEmail({
        preheader: `Less than 6 hours to keep your ${streakDays}-day streak alive.`,
        body,
        footerContext: "You received this because your streak is about to expire on VibeTalent.",
        unsubLink: unsubUrl(email),
      }),
    });
  } catch (error) {
    console.error("Failed to send streak warning email:", error);
  }
}

/**
 * Send a profile view digest email. Fire-and-forget.
 */
export async function sendProfileViewDigestEmail({
  email,
  username,
  viewCount,
  viewerNames,
}: {
  email: string;
  username: string;
  viewCount: number;
  viewerNames: string[];
}): Promise<void> {
  const client = getResend();
  if (!client) return;

  const siteUrl = getSiteUrl();
  const viewerHtml = viewerNames.length > 0
    ? viewerNames.map(n => `<strong>@${escapeHtml(n)}</strong>`).join(", ")
    : "";
  const anonymousCount = viewCount - viewerNames.length;
  const anonymousHtml = anonymousCount > 0
    ? `${viewerNames.length > 0 ? " plus " : ""}${anonymousCount} anonymous visitor${anonymousCount !== 1 ? "s" : ""}`
    : "";
  const viewerPlain = viewerNames.length > 0 ? viewerNames.map(n => `@${n}`).join(", ") : "";
  const anonymousPlain = anonymousCount > 0
    ? `${viewerNames.length > 0 ? " plus " : ""}${anonymousCount} anonymous visitor${anonymousCount !== 1 ? "s" : ""}`
    : "";

  const body = `
${eyebrow("Profile activity")}
${headline(`${viewCount} ${viewCount === 1 ? "person" : "people"} viewed your profile`)}
${paragraph(`Hey <strong>@${escapeHtml(username)}</strong>, ${viewerHtml}${anonymousHtml} checked out your profile in the last 24 hours.`)}
${cta(`${siteUrl}/dashboard`, "View dashboard")}
`;

  try {
    await sendEmail(client, {
      to: email,
      subject: `${viewCount} ${viewCount === 1 ? "person" : "people"} viewed your profile`,
      text: `Hey @${username}, ${viewerPlain}${anonymousPlain} checked out your profile today.\n\nView dashboard: ${siteUrl}/dashboard\n\nUnsubscribe: ${unsubUrl(email)}`,
      html: renderEmail({
        preheader: viewerNames.length > 0
          ? `${viewerPlain}${anonymousPlain ? `${anonymousPlain}` : ""} stopped by your profile.`
          : `${viewCount} ${viewCount === 1 ? "visitor" : "visitors"} on your profile in the last 24 hours.`,
        body,
        footerContext: "You received this daily digest because someone viewed your profile on VibeTalent.",
        unsubLink: unsubUrl(email),
      }),
    });
  } catch (error) {
    console.error("Failed to send profile view digest email:", error);
  }
}

/**
 * Send a weekly digest email. Fire-and-forget.
 */
export async function sendWeeklyDigestEmail({
  email,
  username,
  stats,
}: {
  email: string;
  username: string;
  stats: {
    profileViews: number;
    streakDays: number;
    vibeScore: number;
    projectCount: number;
    hireRequests: number;
  };
}): Promise<void> {
  const client = getResend();
  if (!client) return;

  const siteUrl = getSiteUrl();

  const body = `
${eyebrow("Weekly recap")}
${headline("Your week on VibeTalent")}
${paragraph(`Hey <strong>@${escapeHtml(username)}</strong>, here's how the past 7 days went.`)}
${renderStatsGrid({
  profileViews: stats.profileViews,
  streakDays: stats.streakDays,
  vibeScore: stats.vibeScore,
  hireRequests: stats.hireRequests,
})}
${cta(`${siteUrl}/dashboard`, "View dashboard")}
`;

  try {
    await sendEmail(client, {
      to: email,
      subject: `Your week on VibeTalent`,
      text: `Hey @${username}, here's how your week went:\n\nProfile views: ${stats.profileViews}\nDay streak: ${stats.streakDays}\nVibe score: ${stats.vibeScore}\nHire requests: ${stats.hireRequests}\n\nView dashboard: ${siteUrl}/dashboard\n\nUnsubscribe: ${unsubUrl(email)}`,
      html: renderEmail({
        preheader: `${stats.profileViews} profile views · ${stats.streakDays}-day streak · ${stats.vibeScore} vibe score`,
        body,
        footerContext: "You received this weekly recap from VibeTalent.",
        unsubLink: unsubUrl(email),
      }),
    });
  } catch (error) {
    console.error("Failed to send weekly digest email:", error);
  }
}

/**
 * Send a vibe score milestone email. Fire-and-forget.
 */
export async function sendVibeScoreMilestoneEmail({
  email,
  username,
  vibeScore,
  milestone,
}: {
  email: string;
  username: string;
  vibeScore: number;
  milestone: number;
}): Promise<void> {
  const client = getResend();
  if (!client) return;

  const siteUrl = getSiteUrl();

  const body = `
${eyebrow("Score milestone")}
${headline(`Vibe score ${vibeScore}`)}
${paragraph(`Congrats <strong>@${escapeHtml(username)}</strong>, your vibe score just crossed <strong>${milestone}</strong>. The work is paying off.`)}
${cta(`${siteUrl}/profile/${encodeURIComponent(username)}`, "View your profile")}
`;

  try {
    await sendEmail(client, {
      to: email,
      subject: `Vibe score ${vibeScore} — milestone unlocked`,
      text: `Congrats @${username}! Your vibe score just hit ${vibeScore}, passing the ${milestone} milestone. Your consistency is paying off.\n\nView your profile: ${siteUrl}/profile/${encodeURIComponent(username)}\n\nUnsubscribe: ${unsubUrl(email)}`,
      html: renderEmail({
        preheader: `You just crossed the ${milestone} vibe score milestone.`,
        body,
        footerContext: "You received this because you hit a vibe score milestone on VibeTalent.",
        unsubLink: unsubUrl(email),
      }),
    });
  } catch (error) {
    console.error("Failed to send vibe score milestone email:", error);
  }
}

/**
 * Send a re-engagement email to inactive users asking for feedback. Fire-and-forget.
 */
export async function sendReEngagementEmail({
  email,
  username,
  daysSinceLastActive,
}: {
  email: string;
  username: string;
  daysSinceLastActive: number;
}): Promise<void> {
  const client = getResend();
  if (!client) return;

  const siteUrl = getSiteUrl();
  const feedbackUrl = `${siteUrl}/feedback?ref=re-engagement&u=${encodeURIComponent(username)}`;

  const body = `
${eyebrow("We'd love your input")}
${headline("What would bring you back?")}
${paragraph(`Hey <strong>@${escapeHtml(username)}</strong>, you haven't been on VibeTalent for <strong>${daysSinceLastActive} days</strong>. No guilt trip — we just want to understand what happened.`)}
${paragraph(`Was something missing? Confusing? Not useful? Your honest answer genuinely shapes what we build next.`)}
${quoteCard({
  kicker: "Quick question",
  title: "What's the #1 thing that would bring you back?",
})}
${cta(feedbackUrl, "Share feedback (30 sec)")}
${inlineSecondary(`${siteUrl}/dashboard`, `Or {LINK}head back to your dashboard</a>.`)}
`;

  try {
    await sendEmail(client, {
      to: email,
      subject: `What would bring you back?`,
      text: `Hey @${username}, you haven't been on VibeTalent for ${daysSinceLastActive} days. No guilt trip — we just want to understand what happened. Was something missing, confusing, or not useful?\n\nQuick question: What's the #1 thing that would bring you back?\n\nShare feedback (30 sec): ${feedbackUrl}\n\nYour answer genuinely shapes what we build next.\n\n— The VibeTalent team\n\nUnsubscribe: ${unsubUrl(email)}`,
      html: renderEmail({
        preheader: `30 seconds of honest feedback genuinely shapes what we build next.`,
        body,
        footerContext: "You received this because you haven't been active on VibeTalent recently.",
        unsubLink: unsubUrl(email),
      }),
    });
  } catch (error) {
    console.error("Failed to send re-engagement email:", error);
  }
}

/**
 * Send an email when a builder receives a new review. Fire-and-forget.
 */
export async function sendReviewNotificationEmail({
  email,
  username,
  reviewerName,
  rating,
  comment,
}: {
  email: string;
  username: string;
  reviewerName: string;
  rating: number;
  comment: string | null;
}): Promise<void> {
  const client = getResend();
  if (!client) return;

  const siteUrl = getSiteUrl();
  const safeReviewer = escapeHtml(reviewerName);
  const trimmed = comment ? comment.slice(0, 200) : "";
  const truncated = comment && comment.length > 200 ? "…" : "";
  const safeComment = trimmed ? escapeHtml(trimmed) : null;
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  const commentPlain = comment ? `"${trimmed}${truncated}"` : "";

  const reviewBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;background:${BRAND.bgSoft};">
<tr><td style="padding:18px 22px;border-left:2px solid ${BRAND.accent};">
<p style="margin:0 0 10px;font-family:${BRAND.fontMono};font-size:18px;letter-spacing:0.18em;color:${BRAND.star};">${escapeHtml(stars)}</p>
<p style="margin:0${safeComment ? " 0 10px" : ""};font-family:${BRAND.fontSans};font-size:15px;font-weight:600;color:${BRAND.ink};">${safeReviewer}</p>
${safeComment ? `<p style="margin:0;font-family:${BRAND.fontSans};font-size:15px;line-height:1.6;color:${BRAND.textBody};">&ldquo;${safeComment}${truncated}&rdquo;</p>` : ""}
</td></tr>
</table>`;

  const body = `
${eyebrow("New review")}
${headline(`${rating}-star review from ${safeReviewer}`)}
${paragraph(`Hey <strong>@${escapeHtml(username)}</strong>, you just received a new review on your profile.`)}
${reviewBlock}
${cta(`${siteUrl}/dashboard`, "View dashboard")}
`;

  try {
    await sendEmail(client, {
      to: email,
      subject: `${rating}-star review from ${reviewerName}`,
      text: `Hey @${username}, you received a new review.\n\n${stars}\nFrom: ${reviewerName}\n${commentPlain}\n\nView dashboard: ${siteUrl}/dashboard\n\nUnsubscribe: ${unsubUrl(email)}`,
      html: renderEmail({
        preheader: comment ? `${stars} — ${trimmed.slice(0, 80)}${trimmed.length > 80 ? "…" : ""}` : `${stars} from ${reviewerName}`,
        body,
        footerContext: "You received this because someone reviewed you on VibeTalent.",
        unsubLink: unsubUrl(email),
      }),
    });
  } catch (error) {
    console.error("Failed to send review notification email:", error);
  }
}

export type EmailPreviewSample = {
  key: string;
  label: string;
  subject: string;
  html: string;
};

export function renderAllEmailPreviews(opts?: { logoUrl?: string }): EmailPreviewSample[] {
  const siteUrl = getSiteUrl();
  const username = "max";
  const safeUser = escapeHtml(username);
  const sampleUnsub = `${siteUrl}/settings?tab=emails&ref=preview`;
  const logoUrl = opts?.logoUrl;

  function wrap(o: { preheader: string; body: string; footerContext: string }): string {
    return renderEmail({ ...o, unsubLink: sampleUnsub, logoUrl });
  }

  const samples: EmailPreviewSample[] = [];

  {
    const senderName = "Sarah Chen";
    const message = "Loved your TerminalGPT project — clean implementation, fast UX. We're building a developer-tools platform and would love to chat about a 2-week contract to ship a similar feature in our app.";
    const dashboardUrl = `${siteUrl}/dashboard`;
    const chatUrl = `${siteUrl}/hire/chat/preview-id`;
    const trimmed = message.slice(0, 200);
    const truncated = message.length > 200 ? "…" : "";
    const body = `
${eyebrow("Hire request")}
${headline(`${escapeHtml(senderName)} wants to work with you`)}
${paragraph(`Hey <strong>@${safeUser}</strong>, you just received a new hire request on VibeTalent.`)}
${quoteCard({
  kicker: "Message",
  title: escapeHtml(senderName),
  body: `&ldquo;${escapeHtml(trimmed)}${truncated}&rdquo;`,
})}
${cta(chatUrl, "Open chat")}
${inlineSecondary(dashboardUrl, `Or {LINK}view in dashboard</a>.`)}
`;
    samples.push({
      key: "hire",
      label: "Hire request",
      subject: `New hire request from ${senderName}`,
      html: wrap({
        preheader: `${senderName}: ${trimmed.slice(0, 90)}…`,
        body,
        footerContext: "You received this because someone sent you a hire request on VibeTalent.",
      }),
    });
  }

  {
    const streakDays = 30;
    const body = `
${eyebrow("Streak milestone")}
${headline(`${streakDays} days strong`)}
${paragraph(`Hey <strong>@${safeUser}</strong>, you've shipped on VibeTalent for <strong>${streakDays} consecutive days</strong>. Keep the momentum going.`)}
${cta(`${siteUrl}/dashboard`, "View dashboard")}
`;
    samples.push({
      key: "streak-milestone",
      label: "Streak milestone",
      subject: `${streakDays} days strong`,
      html: wrap({
        preheader: `${streakDays} consecutive days of shipping. That's not luck.`,
        body,
        footerContext: "You received this because you hit a streak milestone on VibeTalent.",
      }),
    });
  }

  {
    const badgeName = "Gold";
    const body = `
${eyebrow("Badge unlocked")}
${headline(`The ${badgeName} badge is yours`)}
${paragraph(`Congrats <strong>@${safeUser}</strong>. Your consistency just earned the <strong>${badgeName}</strong> badge — it lives on your profile permanently.`)}
${cta(`${siteUrl}/dashboard`, "View your profile")}
`;
    samples.push({
      key: "badge",
      label: "Badge earned",
      subject: `${badgeName} badge unlocked`,
      html: wrap({
        preheader: `The ${badgeName} badge is now permanently on your profile.`,
        body,
        footerContext: "You received this because you earned a new badge on VibeTalent.",
      }),
    });
  }

  {
    const projectTitle = "TerminalGPT";
    const body = `
${eyebrow("Project verified")}
${headline(`${escapeHtml(projectTitle)} is now verified`)}
${paragraph(`Hey <strong>@${safeUser}</strong>, your project is verified and now shows the verified mark across your profile and listings.`)}
${cta(`${siteUrl}/dashboard`, "View dashboard")}
`;
    samples.push({
      key: "project-verified",
      label: "Project verified",
      subject: `${projectTitle} is now verified`,
      html: wrap({
        preheader: `Verified mark now showing on ${projectTitle}.`,
        body,
        footerContext: "You received this because your project was verified on VibeTalent.",
      }),
    });
  }

  {
    const streakDays = 14;
    const body = `
${eyebrow("Time-sensitive", BRAND.warn)}
${headline(`Your ${streakDays}-day streak ends today`)}
${paragraph(`Hey <strong>@${safeUser}</strong>, you have less than 6 hours to log activity before your <strong>${streakDays}-day streak</strong> resets to zero. Don't let it slip.`)}
${cta(`${siteUrl}/dashboard`, "Log activity now")}
`;
    samples.push({
      key: "streak-warning",
      label: "Streak warning",
      subject: `Your ${streakDays}-day streak ends today`,
      html: wrap({
        preheader: `Less than 6 hours to keep your ${streakDays}-day streak alive.`,
        body,
        footerContext: "You received this because your streak is about to expire on VibeTalent.",
      }),
    });
  }

  {
    const viewCount = 12;
    const viewerNames = ["sarahc", "deveshw"];
    const anonymous = viewCount - viewerNames.length;
    const viewerHtml = viewerNames.map(n => `<strong>@${escapeHtml(n)}</strong>`).join(", ");
    const anonHtml = anonymous > 0 ? ` plus ${anonymous} anonymous visitor${anonymous !== 1 ? "s" : ""}` : "";
    const body = `
${eyebrow("Profile activity")}
${headline(`${viewCount} people viewed your profile`)}
${paragraph(`Hey <strong>@${safeUser}</strong>, ${viewerHtml}${anonHtml} checked out your profile in the last 24 hours.`)}
${cta(`${siteUrl}/dashboard`, "View dashboard")}
`;
    samples.push({
      key: "profile-views",
      label: "Profile view digest",
      subject: `${viewCount} people viewed your profile`,
      html: wrap({
        preheader: `@sarahc, @deveshw plus ${anonymous} anonymous visitors stopped by.`,
        body,
        footerContext: "You received this daily digest because someone viewed your profile on VibeTalent.",
      }),
    });
  }

  {
    const stats = { profileViews: 47, streakDays: 12, vibeScore: 84, hireRequests: 3 };
    const body = `
${eyebrow("Weekly recap")}
${headline("Your week on VibeTalent")}
${paragraph(`Hey <strong>@${safeUser}</strong>, here's how the past 7 days went.`)}
${renderStatsGrid(stats)}
${cta(`${siteUrl}/dashboard`, "View dashboard")}
`;
    samples.push({
      key: "weekly-digest",
      label: "Weekly recap",
      subject: `Your week on VibeTalent`,
      html: wrap({
        preheader: `${stats.profileViews} profile views · ${stats.streakDays}-day streak · ${stats.vibeScore} vibe score`,
        body,
        footerContext: "You received this weekly recap from VibeTalent.",
      }),
    });
  }

  {
    const vibeScore = 105;
    const milestone = 100;
    const body = `
${eyebrow("Score milestone")}
${headline(`Vibe score ${vibeScore}`)}
${paragraph(`Congrats <strong>@${safeUser}</strong>, your vibe score just crossed <strong>${milestone}</strong>. The work is paying off.`)}
${cta(`${siteUrl}/profile/${encodeURIComponent(username)}`, "View your profile")}
`;
    samples.push({
      key: "vibe-milestone",
      label: "Vibe score milestone",
      subject: `Vibe score ${vibeScore} — milestone unlocked`,
      html: wrap({
        preheader: `You just crossed the ${milestone} vibe score milestone.`,
        body,
        footerContext: "You received this because you hit a vibe score milestone on VibeTalent.",
      }),
    });
  }

  {
    const daysSinceLastActive = 21;
    const feedbackUrl = `${siteUrl}/feedback?ref=preview`;
    const body = `
${eyebrow("We'd love your input")}
${headline("What would bring you back?")}
${paragraph(`Hey <strong>@${safeUser}</strong>, you haven't been on VibeTalent for <strong>${daysSinceLastActive} days</strong>. No guilt trip — we just want to understand what happened.`)}
${paragraph(`Was something missing? Confusing? Not useful? Your honest answer genuinely shapes what we build next.`)}
${quoteCard({
  kicker: "Quick question",
  title: "What's the #1 thing that would bring you back?",
})}
${cta(feedbackUrl, "Share feedback (30 sec)")}
${inlineSecondary(`${siteUrl}/dashboard`, `Or {LINK}head back to your dashboard</a>.`)}
`;
    samples.push({
      key: "re-engagement",
      label: "Re-engagement",
      subject: `What would bring you back?`,
      html: wrap({
        preheader: `30 seconds of honest feedback genuinely shapes what we build next.`,
        body,
        footerContext: "You received this because you haven't been active on VibeTalent recently.",
      }),
    });
  }

  {
    const reviewerName = "Sarah Chen";
    const rating = 5;
    const comment = "Shipped fast, communicated clearly, and the code was clean. Would absolutely work with again.";
    const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
    const trimmed = comment.slice(0, 200);
    const reviewBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;background:${BRAND.bgSoft};">
<tr><td style="padding:18px 22px;border-left:2px solid ${BRAND.accent};">
<p style="margin:0 0 10px;font-family:${BRAND.fontMono};font-size:18px;letter-spacing:0.18em;color:${BRAND.star};">${escapeHtml(stars)}</p>
<p style="margin:0 0 10px;font-family:${BRAND.fontSans};font-size:15px;font-weight:600;color:${BRAND.ink};">${escapeHtml(reviewerName)}</p>
<p style="margin:0;font-family:${BRAND.fontSans};font-size:15px;line-height:1.6;color:${BRAND.textBody};">&ldquo;${escapeHtml(trimmed)}&rdquo;</p>
</td></tr>
</table>`;
    const body = `
${eyebrow("New review")}
${headline(`${rating}-star review from ${escapeHtml(reviewerName)}`)}
${paragraph(`Hey <strong>@${safeUser}</strong>, you just received a new review on your profile.`)}
${reviewBlock}
${cta(`${siteUrl}/dashboard`, "View dashboard")}
`;
    samples.push({
      key: "review",
      label: "New review",
      subject: `${rating}-star review from ${reviewerName}`,
      html: wrap({
        preheader: `${stars} — ${trimmed.slice(0, 80)}`,
        body,
        footerContext: "You received this because someone reviewed you on VibeTalent.",
      }),
    });
  }

  return samples;
}
