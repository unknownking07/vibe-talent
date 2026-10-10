// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { projectEvidenceScore } from "../project-evidence";

const alice = "00000000-0000-0000-0000-000000000001";
const bot = "00000000-0000-0000-0000-000000000002";
const recipient = "00000000-0000-0000-0000-000000000003";
const project = "10000000-0000-0000-0000-000000000001";
const legacyProject = "10000000-0000-0000-0000-000000000002";
const db = new PGlite();
const migrationPath =
  "supabase/migrations/20261009112538_commit_independent_reputation.sql";
const migration = () => readFile(migrationPath, "utf8");

async function score(id = alice) {
  return (
    await db.query<{ vibe_score: number }>(
      "SELECT vibe_score FROM public.users WHERE id=$1",
      [id],
    )
  ).rows[0].vibe_score;
}
async function asOwner(sql: string) {
  await db.exec(
    `SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${alice}', false);`,
  );
  try {
    return await db.exec(sql);
  } finally {
    await db.exec("RESET ROLE;");
  }
}

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE TYPE public.badge_level AS ENUM ('none','bronze','silver','gold','diamond');
    CREATE TABLE public.users (
      id uuid PRIMARY KEY, username text, github_username text, github_id bigint UNIQUE,
      streak integer DEFAULT 0, longest_streak integer DEFAULT 0, badge_level public.badge_level DEFAULT 'none',
      vibe_score integer DEFAULT 10, lifetime_contributions integer DEFAULT 0, contributions_30d integer DEFAULT 0
    );
    CREATE TABLE auth.identities (user_id uuid, provider text, identity_data jsonb);
    CREATE TABLE public.projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES public.users,
      title text, description text, tech_stack text[], live_url text, github_url text, image_url text, build_time text, tags text[],
      verified boolean DEFAULT false, flagged boolean DEFAULT false, is_private boolean DEFAULT false,
      quality_score integer DEFAULT 0, quality_metrics jsonb, live_url_ok boolean, last_verify_attempt_at timestamptz, endorsement_count integer DEFAULT 0
    );
    CREATE TABLE public.project_endorsements (project_id uuid);
    CREATE TABLE public.reviews (builder_id uuid, rating integer, trust_score integer);
    CREATE TABLE public.vouches (voucher_id uuid, builder_id uuid, usd_at_burn numeric);
    CREATE TABLE public.streak_logs (user_id uuid, activity_date date, commit_count integer);
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.users, public.projects TO anon, authenticated, service_role;
    ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
    CREATE POLICY project_read ON public.projects FOR SELECT USING (true);
    CREATE POLICY project_insert ON public.projects FOR INSERT WITH CHECK (auth.uid()=user_id);
    CREATE POLICY project_update ON public.projects FOR UPDATE USING (auth.uid()=user_id);
    INSERT INTO public.users(id,username,github_username,github_id,vibe_score,lifetime_contributions,contributions_30d) VALUES
      ('${alice}', 'alice','alice',2, 9000,1000000,1000000),
      ('${bot}', 'bot','forged',1, 900000,1000000,1000000),
      ('${recipient}', 'recipient',null,null,35,0,0);
    INSERT INTO auth.identities VALUES ('${alice}','github','{"user_name":"alice","sub":"1"}'), ('${bot}','github','{"user_name":"bot","sub":"2"}');
    INSERT INTO public.projects(id,user_id,github_url,live_url,verified,quality_score,quality_metrics,live_url_ok)
      VALUES ('${project}','${alice}','https://github.com/alice/app','https://example.com',true,80,'{"has_readme":true,"has_tests":true,"has_ci":true}',true);
    -- Production has link-less projects created before this NOT VALID constraint.
    INSERT INTO public.projects(id,user_id,title) VALUES ('${legacyProject}','${bot}','Legacy project');
    ALTER TABLE public.projects ADD CONSTRAINT projects_has_live_or_github
      CHECK ((live_url IS NOT NULL AND live_url <> '') OR (github_url IS NOT NULL AND github_url <> '')) NOT VALID;
    -- A voucher whose old score comes entirely from farmed activity.
    INSERT INTO public.vouches VALUES ('${bot}','${recipient}',1000000);
  `);
  await db.exec(await migration());
  // Use the same SECURITY DEFINER wrapper behavior as the live score triggers.
  await db.exec(`
    CREATE FUNCTION public.test_score_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
    BEGIN PERFORM public.update_user_streak(COALESCE(NEW.user_id,OLD.user_id)); RETURN COALESCE(NEW,OLD); END $$;
    CREATE TRIGGER on_project_change AFTER INSERT OR UPDATE OR DELETE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.test_score_trigger();
    CREATE TRIGGER on_streak_log_insert AFTER INSERT ON public.streak_logs FOR EACH ROW EXECUTE FUNCTION public.test_score_trigger();
  `);
}, 30000);
afterAll(() => db.close());

describe("commit-independent reputation migration on PostgreSQL", () => {
  it("preserves already-cleared legacy projects without weakening the link constraint", async () => {
    expect((await db.query("SELECT verified,quality_score,quality_metrics,verification_version FROM public.projects WHERE id=$1", [legacyProject])).rows[0]).toEqual({
      verified: false, quality_score: 0, quality_metrics: null, verification_version: 0,
    });
    await expect(db.exec(`INSERT INTO public.projects(user_id,title) VALUES ('${bot}','New link-less project')`)).rejects.toMatchObject({ code: "23514" });
    expect(await score(bot)).toBe(10);
  });
  it("removes old activity credit, including credit inherited through an inflated voucher", async () => {
    expect(await score()).toBe(10);
    expect(
      (
        await db.query(
          "SELECT verified,quality_metrics FROM public.projects WHERE id=$1",
          [project],
        )
      ).rows[0],
    ).toEqual({ verified: false, quality_metrics: null });
    expect(
      (
        await db.query("SELECT github_id FROM public.users WHERE id=$1", [
          alice,
        ])
      ).rows[0],
    ).toEqual({ github_id: 1 });
    expect(await score(bot)).toBe(10);
    expect(await score(recipient)).toBe(10);
  });

  it("uses the same project evidence weights as TypeScript, with a strongest-project cap", async () => {
    await db.exec(
      `UPDATE public.projects SET verified=true,live_url_ok=true,verification_version=2 WHERE id='${project}'`,
    );
    const combinations = [
      null,
      {},
      { has_readme: true },
      { has_tests: true },
      { has_ci: true },
      { has_readme: true, has_tests: true, has_ci: true },
    ];
    for (const metrics of combinations) {
      await db.query(
        "UPDATE public.projects SET quality_metrics=$1 WHERE id=$2",
        [JSON.stringify(metrics), project],
      );
      expect(await score()).toBe(
        10 +
          projectEvidenceScore({
            verified: true,
            live_url: "https://example.com",
            live_url_ok: true,
            quality_metrics: metrics,
          }),
      );
    }
    await db.exec(
      `INSERT INTO public.projects(user_id,verified,verification_version,github_url) VALUES ('${alice}',true,2,'https://github.com/alice/duplicate');`,
    );
    expect(await score()).toBe(110);
  });

  it("a million empty commits, contribution totals and diamond streak add zero points", async () => {
    await db.exec(`INSERT INTO public.streak_logs SELECT '${alice}', CURRENT_DATE - n, 1000000 FROM generate_series(0,365) n;
      UPDATE public.users SET lifetime_contributions=2000000000,contributions_30d=2000000000 WHERE id='${alice}';
      SELECT public.update_user_streak('${alice}');`);
    expect(await score()).toBe(110);
    expect(
      (
        await db.query(
          "SELECT streak,badge_level FROM public.users WHERE id=$1",
          [alice],
        )
      ).rows[0],
    ).toEqual({ streak: 366, badge_level: "diamond" });
  });

  it("old quality_score and commit metrics cannot contribute", async () => {
    await db.exec(
      `UPDATE public.projects SET quality_score=1000000,quality_metrics=quality_metrics || '{"total_commits":1000000,"maintenance_score":100,"community_score":100}'::jsonb WHERE id='${project}';`,
    );
    expect(await score()).toBe(110);
  });

  it("rejects direct INSERT and protected-column UPDATE, even for the owner", async () => {
    for (const assignment of [
      "quality_score=999999",
      "verified=true",
      "quality_metrics='{}'",
      "live_url_ok=true",
      "endorsement_count=999",
      "flagged=false",
      "is_private=false",
      "verification_version=2",
      `user_id='${bot}'`,
    ]) {
      await expect(
        asOwner(
          `UPDATE public.projects SET ${assignment} WHERE id='${project}'`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
    }
    await expect(
      asOwner(
        `INSERT INTO public.projects(user_id,title) VALUES ('${alice}','forged')`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asOwner(`SELECT public.update_user_streak('${alice}')`),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asOwner(`SELECT public.base_vibe_score('${alice}')`),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("still permits content edits but invalidates proof when the repo or live URL changes", async () => {
    await asOwner(
      `UPDATE public.projects SET title='Updated title' WHERE id='${project}'`,
    );
    expect(await score()).toBe(110);
    await asOwner(
      `UPDATE public.projects SET live_url='https://changed.example' WHERE id='${project}'`,
    );
    expect(await score()).toBe(90);
    await asOwner(
      `UPDATE public.projects SET github_url='https://github.com/other/app' WHERE id='${project}'`,
    );
    const result = (
      await db.query(
        "SELECT verified,quality_score,quality_metrics,live_url_ok FROM public.projects WHERE id=$1",
        [project],
      )
    ).rows[0];
    expect(result).toEqual({
      verified: false,
      quality_score: 0,
      quality_metrics: null,
      live_url_ok: null,
    });
    // The unrelated verified project still earns its ownership-only 40.
    expect(await score()).toBe(50);
  });

  it("replaces client-forged GitHub handles with the trusted provider identity", async () => {
    await asOwner(
      `UPDATE public.users SET github_username='someone-else',github_id=999 WHERE id='${alice}'`,
    );
    expect(
      (
        await db.query(
          "SELECT github_username,github_id FROM public.users WHERE id=$1",
          [alice],
        )
      ).rows[0],
    ).toEqual({ github_username: "alice", github_id: 1 });
  });

  it("preserves trusted server rename reconciliation by stable ID", async () => {
    await db.exec(
      `SET ROLE service_role; UPDATE public.users SET github_username='alice-renamed' WHERE id='${alice}'; RESET ROLE;`,
    );
    expect(
      (
        await db.query("SELECT github_username FROM public.users WHERE id=$1", [
          alice,
        ])
      ).rows[0],
    ).toEqual({ github_username: "alice-renamed" });
  });

  it("can be reapplied without compounding bonuses", async () => {
    const before = await score();
    await db.exec(await migration());
    expect(await score()).toBe(before);
    const once = await score();
    await db.exec(await migration());
    expect(await score()).toBe(once);
  });
});
