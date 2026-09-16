import { createAdminClient } from "@/lib/supabase/admin";
import { sendHireNotification } from "@/lib/email";
import { createNotification } from "@/lib/notifications";

type HireRequestNotice = {
  builderId: string;
  senderName: string;
  message: string;
  requestId: string;
};

/**
 * Tell a builder about a new hire request: an in-app notification and an
 * email. Shared by the site form (/api/hire) and the public API (/api/v1/hire)
 * so a request sent either way reaches the builder the same way.
 *
 * Pass the call to `after()` rather than leaving it floating. On Workers,
 * promises still pending when the response returns can be cancelled, and a
 * hire request the builder never hears about is lost demand. Never throws.
 */
export async function notifyBuilderOfHireRequest(
  notice: HireRequestNotice,
): Promise<void> {
  await Promise.all([
    createNotification({
      user_id: notice.builderId,
      type: "hire_request",
      title: "New hire request",
      message: `${notice.senderName} wants to hire you`,
      metadata: {
        hire_request_id: notice.requestId,
        sender_name: notice.senderName,
      },
    }),
    emailBuilder(notice),
  ]);
}

async function emailBuilder({
  builderId,
  senderName,
  message,
  requestId,
}: HireRequestNotice): Promise<void> {
  try {
    const admin = createAdminClient();
    const [{ data: auth }, { data: profile }] = await Promise.all([
      admin.auth.admin.getUserById(builderId),
      admin.from("users").select("username").eq("id", builderId).single(),
    ]);

    const builderEmail = auth?.user?.email;
    if (!builderEmail) return;

    await sendHireNotification({
      builderEmail,
      builderUsername: profile?.username || "builder",
      senderName,
      message,
      requestId,
    });
  } catch (error) {
    console.error("Failed to email builder about hire request:", error);
  }
}
