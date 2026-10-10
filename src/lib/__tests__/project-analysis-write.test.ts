import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { writeProjectAnalysis } from "../project-analysis-write";

// Exercise real Supabase request serialization: stale analysis must only write
// if BOTH analyzed URLs and ownership still match, including a null demo URL.
describe("conditional project analysis writes", () => {
  for (const live_url of [null, "https://example.com/demo"]) {
    it(`guards the original repository and demo (${live_url})`, async () => {
      const fetcher = vi.fn(async (input: RequestInfo | URL) => {
        expect(String(input)).toContain("/rest/v1/projects?");
        return new Response("[]", {
          headers: { "content-type": "application/json" },
        });
      });
      const client = createClient("https://example.supabase.co", "test-key", {
        global: { fetch: fetcher },
      });
      const project = {
        id: "project",
        user_id: "owner",
        github_url: "https://github.com/alice/app",
        live_url,
      };
      const result = await writeProjectAnalysis(client, project, {
        verified: true,
        quality_score: 100,
      });
      const url = new URL(fetcher.mock.calls[0][0] as unknown as string);
      expect(url.searchParams.get("id")).toBe("eq.project");
      expect(url.searchParams.get("user_id")).toBe("eq.owner");
      expect(url.searchParams.get("github_url")).toBe(
        `eq.${project.github_url}`,
      );
      expect(url.searchParams.get("live_url")).toBe(
        live_url === null ? "is.null" : `eq.${live_url}`,
      );
      expect(result.data).toBeNull(); // A changed row produces no saved proof.
      expect(result.error).toBeNull();
    });
  }
});
