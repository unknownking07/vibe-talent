import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client with the service role key for admin operations.
 * This bypasses RLS and should only be used in API routes for operations
 * that require elevated privileges (e.g., inserting hire requests on behalf
 * of unauthenticated users).
 *
 * Throws if SUPABASE_SERVICE_ROLE_KEY is not set — never silently falls back
 * to the anon key, which would fail silently on admin operations.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. " +
      "Admin operations require the service role key — do not fall back to the anon key."
    );
  }

  return createClient(url, serviceRoleKey);
}
