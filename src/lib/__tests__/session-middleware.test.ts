import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { updateSession, hasAuthSessionCookie } from "@/lib/supabase/middleware";
import { middleware } from "@/middleware";

const auth = vi.hoisted(() => ({ getClaims: vi.fn(), getUser: vi.fn() }));
const serverClient = vi.hoisted(() => vi.fn());
vi.mock("@supabase/ssr", () => ({ createServerClient: serverClient }));
afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-key");
  serverClient.mockReturnValue({ auth });
  auth.getClaims.mockResolvedValue({ data: { claims: { sub: "builder-id" } }, error: null });
  auth.getUser.mockResolvedValue({ data: { user: { id: "builder-id" } }, error: null });
});

function request(path = "/dashboard", cookie = "sb-example-auth-token=session") {
  return new NextRequest(`https://www.vibetalent.work${path}`, {
    headers: { cookie },
  });
}

describe("session middleware", () => {
  it("serves public home and profile pages without waiting for an expired session refresh", async () => {
    for (const path of ["/", "/profile/builder", "/profile/builder/projects"]) {
      const response = await middleware(request(path));
      expect(response.headers.get("location")).toBeNull();
    }
    expect(auth.getClaims).not.toHaveBeenCalled();
  });

  it("uses verified claims without requesting the auth user on every navigation", async () => {
    const response = await updateSession(request());
    expect(response.headers.get("location")).toBeNull();
    expect(auth.getClaims).toHaveBeenCalledOnce();
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it("redirects a signed-out visitor away from the dashboard", async () => {
    auth.getClaims.mockResolvedValue({ data: null, error: null });
    const response = await updateSession(request("/dashboard", ""));
    expect(response.headers.get("location")).toBe("https://www.vibetalent.work/auth/login");
  });

  it("keeps public pages accessible without valid claims", async () => {
    auth.getClaims.mockResolvedValue({ data: null, error: null });
    const response = await updateSession(request("/projects"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("lets the client recover a session after a transient refresh error", async () => {
    auth.getClaims.mockResolvedValue({ data: null, error: new Error("Auth unavailable") });
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("Auth unavailable") });
    const response = await updateSession(request("/dashboard", "sb-example-auth-token.0=session"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("propagates refreshed cookies on public pages as well as the dashboard", async () => {
    const req = request("/feed");
    auth.getClaims.mockImplementation(async () => {
      const options = serverClient.mock.calls[0][2];
      options.cookies.setAll([{ name: "sb-example-auth-token", value: "refreshed", options: { httpOnly: true } }]);
      return { data: { claims: { sub: "builder-id" } }, error: null };
    });
    const response = await updateSession(req);
    expect(req.cookies.get("sb-example-auth-token")?.value).toBe("refreshed");
    expect(response.cookies.get("sb-example-auth-token")?.value).toBe("refreshed");
  });

  it("recognizes chunked sessions but excludes OAuth code verifiers", () => {
    expect(hasAuthSessionCookie(request("/feed", "sb-example-auth-token.0=session"))).toBe(true);
    expect(hasAuthSessionCookie(request("/feed", "sb-example-auth-token-code-verifier=pkce"))).toBe(false);
  });
});
