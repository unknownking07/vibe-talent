import { createClient } from "@supabase/supabase-js";
import type { NotificationType } from "@/lib/types/database";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

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
    const sb = getServiceClient();
    await sb.from("notifications").insert({
      user_id: params.user_id,
      type: params.type,
      title: params.title,
      message: params.message,
      metadata: params.metadata || {},
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}
