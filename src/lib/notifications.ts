import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationType } from "@/lib/types/database";

/**
 * Create a notification for a user. Fire-and-forget — never throws.
 */
export async function createNotification(params: {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const sb = createAdminClient();
    const { error } = await sb.from("notifications").insert({
      user_id: params.user_id,
      type: params.type,
      title: params.title,
      message: params.message,
      metadata: params.metadata || {},
    });
    if (error) {
      console.error("Failed to create notification:", error);
    }
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}
