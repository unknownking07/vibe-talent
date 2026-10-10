# Commit-independent reputation

Status: production rollout authorized and activated on 2026-10-10. Application PR #299 and migration repair PR #300 are merged and deployed. The matching migration was applied individually in the SQL editor after database recovery. Cron recovery results are recorded below.

## Scoring contract

Raw commits, lifetime/recent contributions, streaks, activity badges, push recency, contributor aliases, code volume, popularity and project count earn zero reputation points. Weekly and all-time rankings use vibe score and neutral username ties. Zero-activity builders remain eligible for both views; weekly activity is context only.

The project component uses the strongest public, verified, unflagged project: GitHub control 40, README 15, test-related files/config 15, CI/container config 10, reachable demo 20 (maximum 100). Multiple copies add no project points. A repository checklist score separately describes README/test/CI file presence (30/40/30). Neither score establishes passing tests, semantic code quality, original authorship, or client delivery.

Community endorsement, trusted review and vouch formulas remain separate. The existing vouch formula and payment/on-chain code are unchanged. Backfill seeds all users from non-activity base scores, then converges the existing vouch formula from below so cached activity-heavy voucher scores cannot leak into the reset.

## Trusted input boundary

- Only the authenticated server project-create pipeline can insert projects.
- RLS still scopes ownership. Column grants limit owner edits to project content. Clients cannot set verified/quality fields, flags, privacy, endorsement totals or the new verification_version marker.
- GitHub control compares the repository owner's immutable numeric ID to the attached Supabase provider identity. User-editable auth metadata and profile/social handles are not proof. A shared repository can instead name the complete VibeTalent account UUID on its own line in `.vibetalent`; plain/reclaimed usernames and substring matches are rejected.
- Authenticated profile mirror writes derive GitHub fields from the provider identity. Trusted service reconciliation can still resolve GitHub renames using the stable ID.
- Repo URL edits clear verification and metrics; demo edits clear reachability. Every analysis write compares user ID and both original URLs so a delayed response cannot restore evidence for an edited project.
- Existing project proof fields were client-writable. The migration invalidates legacy proof for server revalidation instead of treating cached assertions as trusted. The new protected marker preserves fresh v2 verification if the migration is reapplied.

## Read-only production impact check (2026-10-09)

Live database was queried, not changed. At the time of inspection: 227 users, 199 projects, one vouch. Initial reset (before fresh GitHub checks): 181 scores decrease, 46 remain unchanged, none increase; maximum goes from 650 to 40. This is not a permanent project penalty: successfully reverified work restores up to 100 project-evidence points. Scores decreasing during the reset is not proof of fraud.

## Activation

Do not run `supabase db push`; local and remote migration histories differ. Release the matching application and apply only `supabase/migrations/20261009112538_commit_independent_reputation.sql` individually in the SQL editor during the same maintenance window. Server writes include the new verification_version field, and legacy clients lose direct project INSERT/protected UPDATE access; a mixed release will temporarily fail project creation/verification. Coordinate both changes, then run verify-backfill through the existing authenticated cron mechanism until the legacy backlog has been processed. Shared repos need the UUID proof file. Accounts without an attached GitHub identity must reconnect GitHub before automatic owner verification.

Revalidation triggers the normal project-verified notifications; assess/coordinate that user-visible batch before invoking it. No revalidation cron, email, hire request, publication or production mutation was performed during implementation.

After activation, verify direct protected writes fail as an authenticated owner, edit a test project's URL to confirm evidence invalidates, and confirm activity-only sync leaves stored scores unchanged. Check project-creation and manual-verification endpoints, cron errors and representative public profiles. Cached public pages may need up to their existing cache TTL to refresh.

If any migration statement fails, its explicit transaction rolls everything back. After a successful commit, do not restore client-writable proof fields or the activity formula as a rollback. Fix forward with the protected boundary retained; restore public profile mirrors from provider identities, and re-analyze projects through the API/cron.

## Verification

Automated tests execute the actual migration against isolated PostgreSQL (PGlite), with realistic roles/RLS and score triggers. They cover volume farming, legacy proof removal, swapped unique GitHub IDs, protected writes/RPC, content editing, proof invalidation, trusted renames, unchanged vouch handling and reapplication. Separate regressions cover analyzer activity invariance, ranking eligibility/ties, immutable GitHub owner IDs, UUID file proofs and actual Supabase serialization of conditional analysis writes. Final local checks: 842 tests pass across 84 files; source-only lint and TypeScript pass; Cloudflare OpenNext build passes. Independent review reports no remaining blockers after the transient-proof retry fix. Re-run applicable checks after subsequent code changes.

## 2026-10-10 release hardening

GitHub scheduled runs 38044483209 (quality-rescore), 38047851647 (verify-backfill), and 38049448471 (daily) failed before repository processing. Reads returned "Failed to fetch projects/users"; daily timed out at 600s. Direct production SQL and REST probes also timed out, and PostgREST logs report schema-cache query statement timeouts (PGRST002). The infrastructure bottleneck requires resource inspection/recovery before applying the coordinated migration.

Admin Supabase requests now have a 20s transport deadline. Daily fanout bounds each child and calibration, retains service-binding authentication, never retries a failed binding through public fetch, and returns 503 for failed/partially failed children. GitHub Actions also rejects partial JSON failures and records transport errors. No automatic replay of mutating jobs is added. Live URL checks compare the originally checked URL before restoring health. Public skill/OpenAPI/llms guidance describes the new scoring contract and does not present activity or repository file presence as proof of delivery.

Release verification (2026-10-10): 853 tests pass across 87 files; source lint and TypeScript pass. Cron YAML and bash syntax pass; JSON success/failure fixtures exercise the workflow guard. Independent review reports no code blockers. Cloudflare build compiles and type-checks, but static rendering times out against the unavailable production database. Restart/recovery and a successful fresh full build are required before merging the coordinated release.

## 2026-10-10 production recovery and activation

Supabase reported the project unhealthy with a nearly depleted disk I/O budget on Nano compute. A restart restored SQL and REST access; the project subsequently reported ACTIVE_HEALTHY. All 230 users and 202 projects remain present. Resource pressure was observed, but no individual application query was established as the outage's cause. No compute upgrade was purchased.

Both application and migration deployments passed. The migration initially rolled back on nine legacy linkless projects under the existing NOT VALID link constraint. The repair skips already-cleared legacy rows instead of issuing a no-op UPDATE that revalidates that constraint; the constraint remains enforced. SQL tests reproduce that failure and verify the repaired migration, protected writes, and fresh v2 proof preservation. The applied migration and its repair are committed.

The first verification backfill restored fresh proof for 84 projects and reported 59 repository errors. Sampled failed repositories return GitHub 404. Backfill now treats not_found/needs_repo_scope as unavailable candidates, leaves them unverified, and stamps a bounded retry window; rate limits, network failures, unknown errors, and database write failures remain operational errors. Retry timestamp writes compare ownership and both original URLs so an edited repository is not postponed by stale work.

Recovery runs: quality-rescore 38059358185 passed (no projects needed rescoring); daily 38059624198 passed. The classification follow-up still requires deployment and a fresh verify-backfill run. Follow-up release verification: 861 tests across 88 files, source lint, TypeScript, and the full Cloudflare OpenNext build pass. Independent review found no blockers.
