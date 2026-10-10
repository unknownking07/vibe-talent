import type { SupabaseClient } from "@supabase/supabase-js";

/** Compare the analyzed URLs when saving: edits must invalidate old evidence,
 * even if GitHub responds after the user has changed the project. */
export async function writeProjectAnalysis(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: Pick<SupabaseClient<any, any, any>, "from">,
  project: {
    id: string;
    user_id: string;
    github_url: string;
    live_url: string | null;
  },
  values: Record<string, unknown>,
) {
  let query = client
    .from("projects")
    .update({ ...values, verification_version: 2 })
    .eq("id", project.id)
    .eq("user_id", project.user_id)
    .eq("github_url", project.github_url);
  query =
    project.live_url === null
      ? query.is("live_url", null)
      : query.eq("live_url", project.live_url);
  return query.select("id").maybeSingle();
}
