/**
 * Diagnose why projects aren't getting verified.
 *
 * Usage:
 *   npx tsx scripts/admin/debug-verify-project.ts <username>           # one user
 *   npx tsx scripts/admin/debug-verify-project.ts <username> --unstick # one user, clear stale stamps
 *   npx tsx scripts/admin/debug-verify-project.ts --all                # every user, summary
 *   npx tsx scripts/admin/debug-verify-project.ts --all --unstick      # every user, clear stale stamps
 *
 * Per-project diagnoses:
 *   already_verified — verified=true with quality_metrics populated. Nothing to do.
 *   owner_match      — repo owner matches users.github_username. Should be verified;
 *                      if it isn't, the cron is stuck (stamp blocks retry, or analyze
 *                      keeps failing). --unstick clears last_verify_attempt_at.
 *   owner_mismatch   — repo owner != users.github_username. Cannot auto-verify;
 *                      user must add a .vibetalent file to the repo and click Verify.
 *   missing_username — users.github_username is null. Will retry on next cron run
 *                      after the user links GitHub (now unstamped after the fix).
 *   bad_url / no_github_url — project URL is unparseable or missing.
 */
import { createClient } from "@supabase/supabase-js";
import { parseGithubRepoUrl } from "../../src/lib/github-quality";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env. " +
      "Source .env.local or export them before running."
  );
  process.exit(1);
}

const sb = createClient(url, serviceRoleKey);

type Diagnosis =
  | "already_verified"
  | "owner_match"
  | "owner_mismatch"
  | "bad_url"
  | "missing_username"
  | "no_github_url";

interface ProjectRow {
  id: string;
  title: string;
  github_url: string | null;
  verified: boolean;
  quality_score: number | null;
  quality_metrics: unknown | null;
  last_verify_attempt_at: string | null;
  created_at: string;
}

function diagnose(p: ProjectRow, githubUsername: string | null): Diagnosis {
  if (p.verified && p.quality_metrics) return "already_verified";
  if (!p.github_url) return "no_github_url";
  const parsed = parseGithubRepoUrl(p.github_url);
  if (!parsed) return "bad_url";
  if (!githubUsername) return "missing_username";
  return parsed.owner.toLowerCase() === githubUsername.toLowerCase()
    ? "owner_match"
    : "owner_mismatch";
}

interface UserRow {
  id: string;
  username: string;
  github_username: string | null;
  created_at: string;
}

async function diagnoseOne(user: UserRow, unstick: boolean, verbose = true): Promise<string[]> {
  const { data: projects, error: projErr } = await sb
    .from("projects")
    .select(
      "id, title, github_url, verified, quality_score, quality_metrics, last_verify_attempt_at, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (projErr) {
    console.error(`Failed to fetch projects for ${user.username}:`, projErr.message);
    return [];
  }
  if (!projects || projects.length === 0) {
    if (verbose) console.log("\nNo projects for this user.");
    return [];
  }

  const stuck: string[] = [];
  if (verbose) console.log(`\n── Projects (${projects.length}) ──`);
  for (const p of projects as ProjectRow[]) {
    const dx = diagnose(p, user.github_username);
    const parsed = parseGithubRepoUrl(p.github_url ?? "");
    const owner = parsed?.owner ?? "(unparseable)";
    if (verbose) {
      console.log(`\n  ${p.title} (${p.id})`);
      console.log(`    github_url:             ${p.github_url ?? "(null)"}`);
      console.log(`    repo owner:             ${owner}`);
      console.log(`    verified:               ${p.verified}`);
      console.log(`    quality_score:          ${p.quality_score ?? "(null)"}`);
      console.log(`    quality_metrics null?   ${p.quality_metrics === null}`);
      console.log(`    last_verify_attempt_at: ${p.last_verify_attempt_at ?? "(null)"}`);
      console.log(`    diagnosis:              ${dx}`);
    }

    if (
      (dx === "owner_match" || dx === "missing_username") &&
      !p.verified &&
      p.last_verify_attempt_at
    ) {
      stuck.push(p.id);
      if (verbose) console.log("    -> recoverable; clearing last_verify_attempt_at would let cron retry.");
    } else if (dx === "owner_mismatch" && verbose) {
      console.log(
        `    -> user must add a .vibetalent file at github.com/${owner}/.../.vibetalent ` +
          `containing "${user.github_username ?? user.id}", then click Verify.`
      );
    }
  }

  if (unstick && stuck.length > 0) {
    const { error: updErr } = await sb
      .from("projects")
      .update({ last_verify_attempt_at: null })
      .in("id", stuck);
    if (updErr) {
      console.error(`Update failed for ${user.username}:`, updErr.message);
    } else if (verbose) {
      console.log(`\n  Unstuck ${stuck.length} project(s) for ${user.username}.`);
    }
  }
  return stuck;
}

async function runAll(unstick: boolean) {
  console.log(`\n── Scanning all users with at least one project ──`);
  const { data: users, error: usersErr } = await sb
    .from("users")
    .select("id, username, github_username, created_at")
    .order("created_at", { ascending: true });
  if (usersErr) {
    console.error("Failed to fetch users:", usersErr.message);
    process.exit(1);
  }
  if (!users || users.length === 0) {
    console.log("No users found.");
    return;
  }

  let totalUnstuck = 0;
  let usersWithStuck = 0;
  let usersWithMismatch = 0;
  let usersWithMatchVerified = 0;
  for (const user of users as UserRow[]) {
    const { data: projects } = await sb
      .from("projects")
      .select(
        "id, title, github_url, verified, quality_score, quality_metrics, last_verify_attempt_at, created_at"
      )
      .eq("user_id", user.id);
    if (!projects || projects.length === 0) continue;

    const rows = projects as ProjectRow[];
    const diagnoses = rows.map((p) => diagnose(p, user.github_username));
    const hasMatchVerified = rows.some((p, i) => diagnoses[i] === "already_verified");
    const hasMatchUnverified = rows.some((p, i) => diagnoses[i] === "owner_match" && !p.verified);
    const hasMismatch = diagnoses.includes("owner_mismatch");

    if (hasMatchVerified) usersWithMatchVerified++;
    if (hasMismatch) usersWithMismatch++;

    if (hasMatchUnverified) {
      console.log(
        `\n  STUCK: ${user.username} (gh=${user.github_username ?? "null"}) — owner-match but not verified:`
      );
      const stuck = await diagnoseOne(user, unstick, false);
      for (const p of rows) {
        const dx = diagnose(p, user.github_username);
        if (dx === "owner_match" && !p.verified) {
          console.log(
            `    - ${p.title} (${p.id}) repo=${p.github_url} stamped=${p.last_verify_attempt_at ?? "null"}`
          );
        }
      }
      if (stuck.length > 0) {
        totalUnstuck += stuck.length;
        usersWithStuck++;
      }
    }
  }
  console.log(`\n── Scan summary ──`);
  console.log(`  users scanned:                ${users.length}`);
  console.log(`  users with verified projects: ${usersWithMatchVerified}`);
  console.log(`  users with owner-mismatch:    ${usersWithMismatch}  (need .vibetalent file)`);
  console.log(`  users with stuck verifications: ${usersWithStuck}`);
  if (unstick) {
    console.log(`  projects unstuck this run:    ${totalUnstuck}  (next cron run will retry)`);
  } else if (usersWithStuck > 0) {
    console.log(`  re-run with --unstick to clear stale last_verify_attempt_at on stuck rows.`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const unstick = args.includes("--unstick");
  const all = args.includes("--all");
  const username = args.find((a) => !a.startsWith("--"));

  if (all) {
    await runAll(unstick);
    return;
  }

  if (!username) {
    console.error(
      "Usage:\n" +
        "  npx tsx scripts/admin/debug-verify-project.ts <username> [--unstick]\n" +
        "  npx tsx scripts/admin/debug-verify-project.ts --all [--unstick]"
    );
    process.exit(1);
  }

  const { data: user, error: userErr } = await sb
    .from("users")
    .select("id, username, github_username, created_at")
    .eq("username", username)
    .single();

  if (userErr || !user) {
    console.error(`User "${username}" not found:`, userErr?.message);
    process.exit(1);
  }

  console.log("\n── User ──");
  console.log(`  username:        ${user.username}`);
  console.log(`  id:              ${user.id}`);
  console.log(`  github_username: ${user.github_username ?? "(null)"}`);
  console.log(`  created_at:      ${user.created_at}`);
  await diagnoseOne(user as UserRow, unstick);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
