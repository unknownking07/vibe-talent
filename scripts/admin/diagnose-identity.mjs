// READ-ONLY diagnostic for the username/identity bug.
//
// Finds:
//   [A] Duplicate auth identities — same email → more than one auth.users row.
//       The person can log in as either; logging in as the one WITHOUT a profile
//       re-prompts them for a username (and their own name collides → 23505).
//   [B] Orphaned profiles — public.users.id matches no current auth user, so the
//       owner can never reach it by their auth.uid().
//   + tries to match each orphan back to a live auth user by GitHub numeric id
//     (tells us how many are auto-recoverable).
//
// No writes. Prints counts + small samples (usernames are public; emails masked).
// Run: node scripts/admin/diagnose-identity.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = loadEnv(fileURLToPath(new URL("../../.env.local", import.meta.url)));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const maskEmail = (e) => {
  if (!e) return "(none)";
  const [u, d] = e.split("@");
  return d ? `${u.slice(0, 1)}***@${d}` : "***";
};

const ghIdOf = (user) => {
  const gh = (user.identities || []).find((i) => i.provider === "github");
  const raw = gh?.identity_data?.sub ?? gh?.identity_data?.provider_id ?? null;
  return raw != null && /^\d+$/.test(String(raw)) ? Number(raw) : null;
};

const providersOf = (user) => {
  const fromId = (user.identities || []).map((i) => i.provider);
  if (fromId.length) return fromId.join("+");
  const am = user.app_metadata?.providers || (user.app_metadata?.provider ? [user.app_metadata.provider] : []);
  return am.length ? am.join("+") : "(none)";
};

// 1) Page through all auth users.
const authUsers = [];
for (let page = 1; ; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.error("listUsers error:", error.message); process.exit(1); }
  authUsers.push(...data.users);
  if (data.users.length < 1000) break;
}
const authUidSet = new Set(authUsers.map((u) => u.id));
const ghIdToAuth = new Map();
for (const u of authUsers) { const g = ghIdOf(u); if (g != null) ghIdToAuth.set(g, u); }

// Duplicate-email groups.
const emailMap = new Map();
for (const u of authUsers) {
  const e = (u.email || "").toLowerCase();
  if (!e) continue;
  if (!emailMap.has(e)) emailMap.set(e, []);
  emailMap.get(e).push(u);
}
const dupEmails = [...emailMap.entries()].filter(([, arr]) => arr.length > 1);

// 2) Page through all public.users.
const profiles = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from("users")
    .select("id, username, github_id, created_at")
    .range(from, from + 999);
  if (error) { console.error("users select error:", error.message); process.exit(1); }
  profiles.push(...data);
  if (data.length < 1000) break;
}
const profileIdSet = new Set(profiles.map((p) => p.id));
const orphans = profiles.filter((p) => !authUidSet.has(p.id));

console.log("\n================ IDENTITY DIAGNOSTIC (read-only) ================");
console.log(`auth.users total:    ${authUsers.length}`);
console.log(`public.users total:  ${profiles.length}`);

// Of the duplicate-email groups, which leave the person stuck (some identities
// have a profile, some don't)?
const stuckDup = dupEmails.filter(([, arr]) => {
  const withP = arr.filter((u) => profileIdSet.has(u.id)).length;
  return withP >= 1 && withP < arr.length;
});

console.log(`\n[A] Duplicate auth identities (same email, >1 auth user): ${dupEmails.length} group(s)`);
console.log(`    of which leave the person STUCK (one identity has the profile, another doesn't): ${stuckDup.length}`);
for (const [email, arr] of dupEmails.slice(0, 20)) {
  const withProfile = arr.filter((u) => profileIdSet.has(u.id)).length;
  console.log(`   - ${maskEmail(email)}: ${arr.length} identities, ${withProfile} own a profile | providers: ${arr.map(providersOf).join(", ")}`);
}
if (dupEmails.length > 20) console.log(`   ... and ${dupEmails.length - 20} more`);

console.log(`\n[B] Orphaned profiles (users.id matches no auth user): ${orphans.length}`);
for (const p of orphans.slice(0, 30)) {
  const match = p.github_id != null ? ghIdToAuth.get(Number(p.github_id)) : null;
  const recover = match ? `recoverable → auth ${match.id.slice(0, 8)} (${maskEmail(match.email)})` : "no github_id match";
  console.log(`   - @${p.username} (profile ${p.id.slice(0, 8)}, github_id ${p.github_id ?? "—"}) | ${recover}`);
}
if (orphans.length > 30) console.log(`   ... and ${orphans.length - 30} more`);

// [C] Cross-identity by GitHub id: an auth user whose GitHub identity's numeric
// id matches an existing profile owned by a DIFFERENT auth id. The person has a
// profile under one identity but logs in under another → PGRST116 + their own
// username "taken". The email-based [A] check misses this when the two
// identities carry different emails (e.g. Google email ≠ GitHub email).
const profileByGhId = new Map();
for (const p of profiles) { if (p.github_id != null) profileByGhId.set(Number(p.github_id), p); }
const shadow = [];
for (const u of authUsers) {
  const g = ghIdOf(u);
  if (g == null) continue;
  const p = profileByGhId.get(g);
  if (p && p.id !== u.id) {
    shadow.push({ authId: u.id, email: u.email, username: p.username, profileId: p.id, loginHasProfile: profileIdSet.has(u.id) });
  }
}
console.log(`\n[C] Second identities matched by GitHub id (profile under a different auth id): ${shadow.length}`);
for (const s of shadow.slice(0, 30)) {
  console.log(`   - auth ${s.authId.slice(0, 8)} (${maskEmail(s.email)}) ↔ profile @${s.username} (owner ${s.profileId.slice(0, 8)}) | this login already has its own profile: ${s.loginHasProfile}`);
}
if (shadow.length > 30) console.log(`   ... and ${shadow.length - 30} more`);

const recoverable = orphans.filter((p) => p.github_id != null && ghIdToAuth.has(Number(p.github_id))).length;
console.log(`\nSummary: ${dupEmails.length} duplicate-email group(s) (${stuckDup.length} stuck), ${orphans.length} orphaned profile(s) (${recoverable} auto-recoverable via github_id).`);
console.log("================================================================\n");
