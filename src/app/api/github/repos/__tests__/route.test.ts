import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

const getUser = vi.hoisted(() => vi.fn());
const checkRateLimit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/rate-limit", () => ({
  projectsLimiter: null,
  getIP: () => "127.0.0.1",
  checkRateLimit,
}));

const request = () => new NextRequest("https://www.vibetalent.work/api/github/repos");
const linkedUser = {
  id: "builder-1",
  identities: [{ provider: "github", identity_data: { user_name: "octocat", sub: "42" } }],
};

describe("GET /api/github/repos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    checkRateLimit.mockResolvedValue({ success: true });
  });

  it("does not call GitHub for an anonymous visitor", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET(request())).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires a currently linked GitHub identity", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "builder-1", user_metadata: { user_name: "octocat" } } }, error: null });
    expect((await GET(request())).status).toBe(409);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns only safe public repo details from the linked account", async () => {
    getUser.mockResolvedValue({ data: { user: linkedUser }, error: null });
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 42, login: "octocat" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
      name: "hello-world", html_url: "https://github.com/octocat/hello-world",
      description: "Useful", language: "TypeScript", private: false,
      fork: false, archived: false, disabled: false,
      owner: { login: "octocat", id: 42 }, secret_field: "never-return",
    }]), { status: 200 }));

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ repos: [{
      name: "hello-world", description: "Useful", language: "TypeScript",
      github_url: "https://github.com/octocat/hello-world",
    }] });
    expect(vi.mocked(fetch).mock.calls[1][0]).toContain("/users/octocat/repos?");
  });

  it("reports an upstream failure without showing a stale or invented list", async () => {
    getUser.mockResolvedValue({ data: { user: linkedUser }, error: null });
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 42, login: "octocat" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("failed", { status: 500 }));
    const response = await GET(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toHaveProperty("error");
  });

  it("uses the stable GitHub ID to find repos after a username change", async () => {
    getUser.mockResolvedValue({ data: { user: linkedUser }, error: null });
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 42, login: "new-name" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        name: "app", html_url: "https://github.com/new-name/app",
        description: "My app", language: "TypeScript", private: false,
        fork: false, archived: false, disabled: false,
        owner: { login: "new-name", id: 42 },
      }]), { status: 200 }));

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ repos: [{
      name: "app", description: "My app", language: "TypeScript",
      github_url: "https://github.com/new-name/app",
    }] });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("https://api.github.com/user/42");
    expect(vi.mocked(fetch).mock.calls[1][0]).toContain("/users/new-name/repos?");
  });
});
