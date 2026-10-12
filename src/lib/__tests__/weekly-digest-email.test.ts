// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({ Resend: class { emails = { send: mocks.send }; } }));
const params = { email: "builder@example.com", username: "builder", stats: { profileViews: 1, streakDays: 0, vibeScore: 10, projectCount: 1, hireRequests: 0 } };
afterEach(() => { vi.resetModules(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("weekly digest provider acknowledgement", () => {
  it("rejects a provider error returned without throwing", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    mocks.send.mockResolvedValue({ data: null, error: { message: "daily quota exceeded" } });
    const { sendWeeklyDigestEmail } = await import("../email");
    await expect(sendWeeklyDigestEmail(params)).rejects.toThrow("daily quota exceeded");
  });
  it("does not claim delivery when the provider is unconfigured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { sendWeeklyDigestEmail } = await import("../email");
    await expect(sendWeeklyDigestEmail(params)).rejects.toThrow("not configured");
  });
  it("accepts a successful provider acknowledgement", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    mocks.send.mockResolvedValue({ data: { id: "email-id" }, error: null });
    const { sendWeeklyDigestEmail } = await import("../email");
    await expect(sendWeeklyDigestEmail(params)).resolves.toBeUndefined();
  });
});
