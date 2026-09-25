import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/dashboard/page";
import type { Project } from "@/lib/types/database";

const mocks = vi.hoisted(() => ({ client: vi.fn(), streaks: vi.fn(), walletMounted: vi.fn(), recoveryMounted: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/queries", () => ({ fetchStreakLogs: mocks.streaks }));
vi.mock("next/dynamic", () => ({
  default: (loader: () => unknown) => {
    const wallet = loader.toString().includes("link-wallet");
    const recovery = loader.toString().includes("streak-protect-card");
    return function DeferredFeature(props: { initialAddress?: string | null }) {
      if (wallet) mocks.walletMounted(props.initialAddress);
      if (recovery) mocks.recoveryMounted();
      return null;
    };
  },
}));
vi.mock("@/components/dashboard/profile-views-widget", () => ({ ProfileViewsWidget: () => null }));
vi.mock("@/components/ui/project-card", () => ({ ProjectCard: ({ project }: { project: Project }) => <div>{project.title}</div> }));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

type QueryResult = { data: unknown; error?: { message: string } | null; count?: number };
let root: Root;
let container: HTMLDivElement;
let projects: ReturnType<typeof deferred<QueryResult>>;
let inbox: ReturnType<typeof deferred<QueryResult>>;
let streaks: ReturnType<typeof deferred<Record<string, number>>>;
let reloadedProjects: ReturnType<typeof deferred<QueryResult>>;
let profile: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_PRIVY_APP_ID", "configured-app");
  localStorage.clear();
  localStorage.setItem("last_github_sync", String(Date.now()));
  projects = deferred<QueryResult>();
  inbox = deferred<QueryResult>();
  streaks = deferred<Record<string, number>>();
  reloadedProjects = deferred<QueryResult>();
  mocks.streaks.mockReturnValue(streaks.promise);
  profile = {
    id: "builder-id", username: "fast-builder", display_name: "Fast Builder",
    github_username: "fast-builder", github_id: 123, streak: 7, longest_streak: 7,
    badge_level: "none", vibe_score: 100, created_at: new Date().toISOString(),
    streak_before_break: 7, streak_broken_at: new Date().toISOString(),
  };
  const responses: Record<string, Promise<QueryResult>> = {
    users: Promise.resolve({ data: profile, error: null }),
    social_links: Promise.resolve({ data: { github: "fast-builder" }, error: null }),
    projects: projects.promise,
    hire_requests: inbox.promise,
  };
  let projectReads = 0;
  mocks.client.mockReturnValue({
    auth: {
      getClaims: async () => ({ data: { claims: { sub: "builder-id" } } }),
      getUser: vi.fn(async () => ({ data: { user: { id: "builder-id" } } })),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from(table: string) {
      const response = table === "projects" && projectReads++ > 0 ? reloadedProjects.promise : responses[table];
      const query = {
        select: () => query, eq: () => query, order: () => query, maybeSingle: () => query,
        then: response.then.bind(response),
      };
      return query;
    },
    rpc: async () => ({ error: null }),
  });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function render() {
  await act(async () => { root.render(<DashboardPage />); });
}

describe("dashboard loading", () => {
  it("shows the profile before projects, streak history, or inbox counts finish", async () => {
    await render();
    expect(mocks.client.mock.results[0].value.auth.getUser).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Current Streak");
    expect(container.textContent).toContain("Loading projects");
    const activity = [...container.querySelectorAll("button")].find((button) => button.textContent === "Loading activity...");
    expect(activity?.disabled).toBe(true);

    await act(async () => { projects.resolve({ data: [{ id: "p1", title: "Shipped project" }], error: null }); });
    expect(container.textContent).toContain("Shipped project");
    expect(container.textContent).not.toContain("Loading projects");
  });

  it("fetches the current Auth user only when a GitHub mirror needs repair", async () => {
    profile.github_id = null;
    await render();
    expect(mocks.client.mock.results[0].value.auth.getUser).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Current Streak");
  });

  it("does not load the wallet SDK until the wallet controls are opened", async () => {
    await act(async () => {
      projects.resolve({ data: [] }); inbox.resolve({ data: null, count: 0 }); streaks.resolve({});
    });
    await render();
    expect(mocks.walletMounted).not.toHaveBeenCalled();
    const button = [...container.querySelectorAll("button")].find((item) => item.textContent === "Link wallet");
    expect(button).toBeDefined();
    await act(async () => { button!.click(); });
    expect(mocks.walletMounted).toHaveBeenCalled();
  });

  it("defers streak recovery's wallet SDK until recovery controls are opened", async () => {
    await render();
    expect(mocks.recoveryMounted).not.toHaveBeenCalled();
    const recovery = [...container.querySelectorAll("button")].find((button) => button.textContent === "View streak recovery");
    expect(recovery).toBeDefined();
    await act(async () => { recovery!.click(); });
    expect(mocks.recoveryMounted).toHaveBeenCalled();
  });

  it("loads no recovery SDK or offer for an expired break", async () => {
    profile.streak_broken_at = new Date(Date.now() - 49 * 3_600_000).toISOString();
    await render();
    expect(container.textContent).not.toContain("View streak recovery");
    expect(mocks.recoveryMounted).not.toHaveBeenCalled();
  });

  it("hides recovery when the wallet integration is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVY_APP_ID", undefined);
    await render();
    expect(container.textContent).not.toContain("View streak recovery");
    expect(mocks.recoveryMounted).not.toHaveBeenCalled();
  });

  it("preserves the linked address when wallet controls are opened", async () => {
    profile.solana_wallet = "So1anaLinkedWalletAddress";
    await render();
    expect(container.textContent).toContain("So1ana...ress");
    expect(mocks.walletMounted).not.toHaveBeenCalled();
    const manage = [...container.querySelectorAll("button")].find((button) => button.textContent === "Manage wallet");
    await act(async () => { manage!.click(); });
    expect(mocks.walletMounted).toHaveBeenCalledWith(profile.solana_wallet);
  });

  it("reports a failed projects request without blanking the profile", async () => {
    await render();
    await act(async () => { projects.resolve({ data: null, error: { message: "Network unavailable" } }); });
    expect(container.textContent).toContain("Current Streak");
    expect(container.textContent).toContain("Couldn't load your projects");
  });

  it("settles today's activity while projects and inbox are still pending", async () => {
    await render();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    await act(async () => { streaks.resolve({ [today]: 1 }); });
    expect(container.textContent).toContain("Logged Today");
    expect(container.textContent).toContain("Loading projects");
  });

  it("keeps a fresh sync when older initial reads finish later", async () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    mocks.streaks.mockReturnValueOnce(streaks.promise).mockResolvedValueOnce({ [today]: 1 });
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ synced: true, dates_logged: 1 }) } as Response);
    await render();
    const sync = [...container.querySelectorAll("button")].find((button) => button.textContent === "Sync Now");
    await act(async () => {
      sync!.click();
      reloadedProjects.resolve({ data: [{ id: "p2", title: "Fresh project" }], error: null });
    });
    expect(container.textContent).toContain("Fresh project");
    expect(container.textContent).not.toContain("Loading projects");
    expect(container.textContent).toContain("Logged Today");
    await act(async () => {
      projects.resolve({ data: [{ id: "p1", title: "Old project" }], error: null });
      streaks.resolve({});
    });
    expect(container.textContent).toContain("Fresh project");
    expect(container.textContent).not.toContain("Old project");
    expect(container.textContent).toContain("Logged Today");
    expect(fetch).toHaveBeenCalledWith("/api/github/contributions");
  });
});
