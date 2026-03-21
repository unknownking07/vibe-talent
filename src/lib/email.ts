import { Resend } from "resend";

let resend: Resend | null = null;

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
      from: "VibeTalent <notifications@vibetalent.dev>",
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
