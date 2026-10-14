# Supabase disk I/O mitigation — 14 October 2026

Production project `okxjdenxztzuqqlekqdb` is on Free Nano compute. The investigation found a database of approximately 40 MB and substantial system-disk traffic, including active swap. A 99-second sample averaged approximately 23 MB/s on the system disk and 0.04 MB/s on the PostgreSQL data disk; a subsequent 170-second sample settled below Nano's 5 MB/s baseline. These observations indicate intermittent system/memory I/O pressure rather than a database storage-capacity problem. They do not identify the process responsible for every system-disk read or establish the exact remaining burst-credit percentage.

## Application changes

- GitHub sync previously upserted each builder's entire contribution history on every run, including identical rows. It now reads the builder's bounded activity dates and writes only missing dates or changed counts. Existing freeze/restore source markers are not included in the upsert payload. A read failure stops that builder's sync rather than falling back to a full history rewrite. `update_user_streak` still runs after a successful comparison even when no activity changes, because today's streak state may need recalculation.
- Cron responses retain `dates_logged` and add per-builder `dates_written` plus aggregate `activity_rows_checked` and `activity_rows_written`. The aggregate write counter counts acknowledged activity upserts, including those preceding a later recalculation failure. Operational failures remain visible to the daily orchestrator and GitHub Actions.
- Homepage hero aggregates now use a five-minute shared cache. The proof wall composes its cached rows with the cached hero aggregate outside either cache callback, so both use the hero's exact activity count. Nesting another `unstable_cache` inside those callbacks would bypass cache reads in the installed Next implementation and repeat the count. The API cache header uses the same five-minute lifetime. Counts remain exact when refreshed; failures are not cached as zero.

No database migration, access-control change, new dependency, or billing change is needed.

## Verification

- The unchanged-history regression reproduced 365 unnecessary writes before the fix and zero afterward.
- Tests cover new and corrected counts, user/date query scope, preserved source payloads, lookup/write failures, and continued streak recalculation for unchanged activity.
- Cache tests use the installed Next implementation and real async request context with an in-memory cache backend. The nested-cache version failed the shared-count test; the composed version passes. Tests also cover the five-minute lifetime and error recovery.
- Final local checks: 885 tests across 92 files, source ESLint, TypeScript, and the full OpenNext Cloudflare build passed. Independent review found no remaining release blockers.

After deployment, run the daily cron once and compare its checked/written counters. Take resource samples after cache warmup to assess residual system-disk and swap traffic. These application changes reduce avoidable work; they do not guarantee that Nano's system-level burst-budget pressure is eliminated. Sustained pressure may require Supabase-side investigation or additional memory.

References: [compute and disk limits](https://supabase.com/docs/guides/platform/compute-and-disk), [memory and swap](https://supabase.com/docs/guides/troubleshooting/memory-and-swap-usage-explained-aPNgm0).
