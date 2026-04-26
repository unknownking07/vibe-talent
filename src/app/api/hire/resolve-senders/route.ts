import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { statsLimiter, checkRateLimit } from "@/lib/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate-limit by authenticated user id, not IP — multiple builders behind a
    // shared NAT shouldn't burn each other's quota.
    const { success } = await checkRateLimit(
      statsLimiter,
      `resolve-senders:${user.id}`
    );
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const ids: unknown = body?.hire_request_ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ resolved: {} });
    }
    if (ids.length > 100) {
      return NextResponse.json({ error: "Too many ids" }, { status: 400 });
    }
    const requestIds = ids.filter(
      (v): v is string => typeof v === "string" && UUID_RE.test(v)
    );
    if (requestIds.length === 0) {
      return NextResponse.json({ resolved: {} });
    }

    const sb = createAdminClient();

    // Only resolve hire requests addressed to the authenticated builder, AND
    // only those with a captured sender_user_id (i.e., the sender was logged in
    // and their auth email matched the form-submitted email — see hire POST).
    // Requests without a sender_user_id stay unresolved so we never link a
    // form-submitted email to a profile we haven't proven ownership of.
    const { data: hireRequests, error: hrError } = await sb
      .from("hire_requests")
      .select("id, sender_user_id")
      .in("id", requestIds)
      .eq("builder_id", user.id)
      .not("sender_user_id", "is", null);

    if (hrError) {
      console.error("[hire/resolve-senders] hire_requests fetch failed:", hrError);
      return NextResponse.json({ resolved: {} });
    }
    if (!hireRequests || hireRequests.length === 0) {
      return NextResponse.json({ resolved: {} });
    }

    const userIds = Array.from(
      new Set(
        hireRequests
          .map((r) => r.sender_user_id as string | null)
          .filter((v): v is string => !!v)
      )
    );
    if (userIds.length === 0) {
      return NextResponse.json({ resolved: {} });
    }

    const { data: usersRows, error: usersErr } = await sb
      .from("users")
      .select("id, username")
      .in("id", userIds);

    if (usersErr) {
      console.error("[hire/resolve-senders] users fetch failed:", usersErr);
      return NextResponse.json({ resolved: {} });
    }

    const idToUsername = new Map<string, string>();
    for (const row of usersRows || []) {
      if (row?.id && row?.username) idToUsername.set(row.id, row.username);
    }

    const resolved: Record<string, { username: string }> = {};
    for (const r of hireRequests) {
      if (!r.sender_user_id) continue;
      const username = idToUsername.get(r.sender_user_id);
      if (username) resolved[r.id] = { username };
    }

    return NextResponse.json({ resolved });
  } catch (err) {
    console.error("[hire/resolve-senders] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
