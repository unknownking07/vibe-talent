import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { statsLimiter, getIP, checkRateLimit } from "@/lib/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cap the listUsers scan so we never burn through every user on a heavy build.
const MAX_AUTH_USERS_SCAN = 5000;
const PAGE_SIZE = 1000;

export async function POST(req: NextRequest) {
  const { success } = await checkRateLimit(statsLimiter, getIP(req));
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Only resolve hire requests addressed to the authenticated builder.
    const { data: hireRequests, error: hrError } = await sb
      .from("hire_requests")
      .select("id, sender_email")
      .in("id", requestIds)
      .eq("builder_id", user.id);

    if (hrError || !hireRequests || hireRequests.length === 0) {
      return NextResponse.json({ resolved: {} });
    }

    const wantedEmails = new Set<string>();
    for (const r of hireRequests) {
      if (r.sender_email) wantedEmails.add(r.sender_email.toLowerCase());
    }
    if (wantedEmails.size === 0) {
      return NextResponse.json({ resolved: {} });
    }

    // Walk auth.users to map emails → user ids. The JS SDK has no email filter, so we
    // paginate. Stop early once every wanted email is resolved.
    const emailToId = new Map<string, string>();
    const maxPages = Math.ceil(MAX_AUTH_USERS_SCAN / PAGE_SIZE);
    for (let page = 1; page <= maxPages; page++) {
      const { data, error } = await sb.auth.admin.listUsers({
        page,
        perPage: PAGE_SIZE,
      });
      if (error || !data?.users?.length) break;
      for (const u of data.users) {
        const email = u.email?.toLowerCase();
        if (email && wantedEmails.has(email) && !emailToId.has(email)) {
          emailToId.set(email, u.id);
          if (emailToId.size === wantedEmails.size) break;
        }
      }
      if (emailToId.size === wantedEmails.size) break;
      if (data.users.length < PAGE_SIZE) break;
    }

    if (emailToId.size === 0) {
      return NextResponse.json({ resolved: {} });
    }

    // public.users.id == auth.users.id, so we can resolve usernames in one query.
    const { data: usersRows, error: usersErr } = await sb
      .from("users")
      .select("id, username")
      .in("id", Array.from(emailToId.values()));

    if (usersErr) {
      return NextResponse.json({ resolved: {} });
    }

    const idToUsername = new Map<string, string>();
    for (const row of usersRows || []) {
      if (row?.id && row?.username) idToUsername.set(row.id, row.username);
    }

    const resolved: Record<string, { username: string }> = {};
    for (const r of hireRequests) {
      const email = r.sender_email?.toLowerCase();
      if (!email) continue;
      const id = emailToId.get(email);
      if (!id) continue;
      const username = idToUsername.get(id);
      if (username) resolved[r.id] = { username };
    }

    return NextResponse.json({ resolved });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
