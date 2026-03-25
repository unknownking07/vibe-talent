import { Resend } from "resend";

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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vibetalent.dev";
  const dashboardUrl = `${siteUrl}/dashboard`;
  const chatUrl = `${siteUrl}/hire/chat/${requestId}`;

  try {
    await client.emails.send({
      from: "VibeTalent <notifications@vibetalent.work>",
      to: builderEmail,
      subject: `New hire request from ${senderName} | VibeTalent`,
      html: `
        <div style="font-family: 'Space Grotesk', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #0F0F0F; background: #FFFFFF;">
          <div style="background: #0F0F0F; color: #FFFFFF; padding: 24px 32px;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800;">⚡ VibeTalent</h1>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #0F0F0F; font-size: 24px; font-weight: 700; margin: 0 0 16px;">
              New Hire Request
            </h2>
            <p style="color: #52525B; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
              Hey <strong>@${builderUsername}</strong>, you've received a new hire request!
            </p>
            <div style="border: 2px solid #0F0F0F; padding: 20px; margin: 0 0 24px;">
              <p style="color: #0F0F0F; font-size: 14px; margin: 0 0 8px;">
                <strong>From:</strong> ${senderName}
              </p>
              <p style="color: #52525B; font-size: 14px; line-height: 1.5; margin: 0;">
                "${message.slice(0, 200)}${message.length > 200 ? "..." : ""}"
              </p>
            </div>
            <a href="${dashboardUrl}" style="display: inline-block; background: #FF3A00; color: #FFFFFF; padding: 12px 24px; text-decoration: none; font-weight: 700; font-size: 14px; border: 2px solid #0F0F0F; box-shadow: 4px 4px 0 #0F0F0F;">
              View in Dashboard
            </a>
            <a href="${chatUrl}" style="display: inline-block; background: #FFFFFF; color: #0F0F0F; padding: 12px 24px; text-decoration: none; font-weight: 700; font-size: 14px; border: 2px solid #0F0F0F; box-shadow: 4px 4px 0 #0F0F0F; margin-left: 12px;">
              Open Chat
            </a>
          </div>
          <div style="background: #F4F4F5; padding: 16px 32px; border-top: 2px solid #0F0F0F;">
            <p style="color: #71717A; font-size: 12px; margin: 0;">
              You received this because someone wants to hire you on VibeTalent.
            </p>
          </div>
        </div>
      `,
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vibetalent.dev";

  try {
    await client.emails.send({
      from: "VibeTalent <notifications@vibetalent.work>",
      to: email,
      subject: `You hit a ${streakDays}-day streak! | VibeTalent`,
      html: `
        <div style="font-family: 'Space Grotesk', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #0F0F0F; background: #FFFFFF;">
          <div style="background: #0F0F0F; color: #FFFFFF; padding: 24px 32px;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800;">⚡ VibeTalent</h1>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #0F0F0F; font-size: 24px; font-weight: 700; margin: 0 0 16px;">
              🔥 ${streakDays}-Day Streak!
            </h2>
            <p style="color: #52525B; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
              Hey <strong>@${username}</strong>, you've been coding for <strong>${streakDays} consecutive days</strong>. Keep the momentum going!
            </p>
            <a href="${siteUrl}/dashboard" style="display: inline-block; background: #FF3A00; color: #FFFFFF; padding: 12px 24px; text-decoration: none; font-weight: 700; font-size: 14px; border: 2px solid #0F0F0F; box-shadow: 4px 4px 0 #0F0F0F;">
              View Dashboard
            </a>
          </div>
          <div style="background: #F4F4F5; padding: 16px 32px; border-top: 2px solid #0F0F0F;">
            <p style="color: #71717A; font-size: 12px; margin: 0;">
              You received this because you hit a streak milestone on VibeTalent.
            </p>
          </div>
        </div>
      `,
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vibetalent.dev";
  const badgeEmoji: Record<string, string> = { bronze: "🥉", silver: "🥈", gold: "🥇", diamond: "💎" };

  try {
    await client.emails.send({
      from: "VibeTalent <notifications@vibetalent.work>",
      to: email,
      subject: `You earned a ${badgeLevel} badge! | VibeTalent`,
      html: `
        <div style="font-family: 'Space Grotesk', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #0F0F0F; background: #FFFFFF;">
          <div style="background: #0F0F0F; color: #FFFFFF; padding: 24px 32px;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800;">⚡ VibeTalent</h1>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #0F0F0F; font-size: 24px; font-weight: 700; margin: 0 0 16px;">
              ${badgeEmoji[badgeLevel] || "🏅"} ${badgeLevel.charAt(0).toUpperCase() + badgeLevel.slice(1)} Badge Earned!
            </h2>
            <p style="color: #52525B; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
              Congrats <strong>@${username}</strong>! Your consistency has earned you the <strong>${badgeLevel}</strong> badge. This badge is permanently displayed on your profile.
            </p>
            <a href="${siteUrl}/dashboard" style="display: inline-block; background: #FF3A00; color: #FFFFFF; padding: 12px 24px; text-decoration: none; font-weight: 700; font-size: 14px; border: 2px solid #0F0F0F; box-shadow: 4px 4px 0 #0F0F0F;">
              View Your Profile
            </a>
          </div>
          <div style="background: #F4F4F5; padding: 16px 32px; border-top: 2px solid #0F0F0F;">
            <p style="color: #71717A; font-size: 12px; margin: 0;">
              You received this because you earned a new badge on VibeTalent.
            </p>
          </div>
        </div>
      `,
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vibetalent.dev";

  try {
    await client.emails.send({
      from: "VibeTalent <notifications@vibetalent.work>",
      to: email,
      subject: `Your project "${projectTitle}" is verified! | VibeTalent`,
      html: `
        <div style="font-family: 'Space Grotesk', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #0F0F0F; background: #FFFFFF;">
          <div style="background: #0F0F0F; color: #FFFFFF; padding: 24px 32px;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800;">⚡ VibeTalent</h1>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #0F0F0F; font-size: 24px; font-weight: 700; margin: 0 0 16px;">
              ✅ Project Verified!
            </h2>
            <p style="color: #52525B; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
              Hey <strong>@${username}</strong>, your project <strong>"${projectTitle}"</strong> has been verified. It now shows a verified badge in your profile and listings.
            </p>
            <a href="${siteUrl}/dashboard" style="display: inline-block; background: #FF3A00; color: #FFFFFF; padding: 12px 24px; text-decoration: none; font-weight: 700; font-size: 14px; border: 2px solid #0F0F0F; box-shadow: 4px 4px 0 #0F0F0F;">
              View Dashboard
            </a>
          </div>
          <div style="background: #F4F4F5; padding: 16px 32px; border-top: 2px solid #0F0F0F;">
            <p style="color: #71717A; font-size: 12px; margin: 0;">
              You received this because your project was verified on VibeTalent.
            </p>
          </div>
        </div>
      `,
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vibetalent.dev";
  const safeUsername = escapeHtml(username);

  try {
    await client.emails.send({
      from: "VibeTalent <notifications@vibetalent.work>",
      to: email,
      subject: `Your ${streakDays}-day streak is about to end! | VibeTalent`,
      html: `
        <div style="font-family: 'Space Grotesk', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #0F0F0F; background: #FFFFFF;">
          <div style="background: #0F0F0F; color: #FFFFFF; padding: 24px 32px;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800;">⚡ VibeTalent</h1>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #EF4444; font-size: 24px; font-weight: 700; margin: 0 0 16px;">
              ⚠️ Streak Ending Soon!
            </h2>
            <p style="color: #52525B; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
              Hey <strong>@${safeUsername}</strong>, your <strong>${streakDays}-day streak</strong> will reset within the next 6 hours if you don't log activity today. Don't let it slip!
            </p>
            <a href="${siteUrl}/dashboard" style="display: inline-block; background: #FF3A00; color: #FFFFFF; padding: 12px 24px; text-decoration: none; font-weight: 700; font-size: 14px; border: 2px solid #0F0F0F; box-shadow: 4px 4px 0 #0F0F0F;">
              Log Activity Now
            </a>
          </div>
          <div style="background: #F4F4F5; padding: 16px 32px; border-top: 2px solid #0F0F0F;">
            <p style="color: #71717A; font-size: 12px; margin: 0;">
              You received this because your streak is about to expire on VibeTalent.
            </p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send streak warning email:", error);
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vibetalent.dev";
  const safeReviewer = escapeHtml(reviewerName);
  const safeComment = comment ? escapeHtml(comment.slice(0, 200)) : null;
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);

  try {
    await client.emails.send({
      from: "VibeTalent <notifications@vibetalent.work>",
      to: email,
      subject: `New ${rating}-star review from ${reviewerName} | VibeTalent`,
      html: `
        <div style="font-family: 'Space Grotesk', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #0F0F0F; background: #FFFFFF;">
          <div style="background: #0F0F0F; color: #FFFFFF; padding: 24px 32px;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800;">⚡ VibeTalent</h1>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #0F0F0F; font-size: 24px; font-weight: 700; margin: 0 0 16px;">
              ⭐ New Review
            </h2>
            <p style="color: #52525B; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
              Hey <strong>@${escapeHtml(username)}</strong>, you received a new review!
            </p>
            <div style="border: 2px solid #0F0F0F; padding: 20px; margin: 0 0 24px;">
              <p style="color: #F59E0B; font-size: 20px; margin: 0 0 8px; letter-spacing: 2px;">
                ${stars}
              </p>
              <p style="color: #0F0F0F; font-size: 14px; margin: 0 0 8px;">
                <strong>From:</strong> ${safeReviewer}
              </p>
              ${safeComment ? `<p style="color: #52525B; font-size: 14px; line-height: 1.5; margin: 0;">"${safeComment}${(comment?.length || 0) > 200 ? "..." : ""}"</p>` : ""}
            </div>
            <a href="${siteUrl}/dashboard" style="display: inline-block; background: #FF3A00; color: #FFFFFF; padding: 12px 24px; text-decoration: none; font-weight: 700; font-size: 14px; border: 2px solid #0F0F0F; box-shadow: 4px 4px 0 #0F0F0F;">
              View Dashboard
            </a>
          </div>
          <div style="background: #F4F4F5; padding: 16px 32px; border-top: 2px solid #0F0F0F;">
            <p style="color: #71717A; font-size: 12px; margin: 0;">
              You received this because someone reviewed you on VibeTalent.
            </p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send review notification email:", error);
  }
}
