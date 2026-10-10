import { afterEach, describe, expect, it, vi } from "vitest";
import {
  repositoryControlVerified,
  verificationFileMatches,
} from "../project-verification";

afterEach(() => vi.unstubAllGlobals());
const uuid = "00000000-0000-0000-0000-000000000001";
describe("stable repository control proof", () => {
  it("accepts a complete account UUID in a multi-line team file", () => {
    expect(verificationFileMatches(`someone-else\r\n ${uuid} \n`, uuid)).toBe(
      true,
    );
    expect(verificationFileMatches(`prefix-${uuid}`, uuid)).toBe(false);
    expect(verificationFileMatches("alice", uuid)).toBe(false);
  });
  it("verifies matching numeric GitHub IDs without trusting names or extra calls", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(
      await repositoryControlVerified("renamed", "repo", 42, 42, uuid),
    ).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects a reclaimed name whose repository owner ID differs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    expect(
      await repositoryControlVerified("old-handle", "repo", 99, 42, uuid),
    ).toBe(false);
    expect(
      await repositoryControlVerified("old-handle", "repo", null, null, uuid),
    ).toBe(false);
  });
  it("permits shared repositories only with an explicit account UUID file", async () => {
    let content = "alice";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ content: btoa(content), encoding: "base64" }),
      ),
    );
    expect(await repositoryControlVerified("org", "repo", 99, 42, uuid)).toBe(
      false,
    );
    content = uuid;
    expect(await repositoryControlVerified("org", "repo", 99, 42, uuid)).toBe(
      true,
    );
  });
  it("preserves unknown proof on transient GitHub errors so rescoring can retry", async () => {
    for (const status of [403, 429, 500, 503]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(null, { status })),
      );
      await expect(
        repositoryControlVerified("org", "repo", 99, 42, uuid),
      ).rejects.toThrow("Repository proof lookup failed");
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      }),
    );
    await expect(
      repositoryControlVerified("org", "repo", 99, 42, uuid),
    ).rejects.toThrow("timeout");
  });
});
