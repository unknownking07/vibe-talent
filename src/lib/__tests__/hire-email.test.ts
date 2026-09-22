import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));

import { sendHireNotification } from "@/lib/email";

const originalApiKey = process.env.RESEND_API_KEY;

afterEach(() => {
  vi.restoreAllMocks();
  mocks.send.mockReset();
  if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalApiKey;
});

describe("sendHireNotification", () => {
  it("logs a provider response error without throwing", async () => {
    process.env.RESEND_API_KEY = "test-key";
    const providerError = { name: "validation_error", message: "provider rejected" };
    mocks.send.mockResolvedValue({ data: null, error: providerError });
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(sendHireNotification({
      builderEmail: "builder@example.com",
      builderUsername: "octocat",
      senderName: "Ada",
      message: "Can you build our onboarding flow?",
      requestId: "request-1",
    })).resolves.toBeUndefined();

    expect(mocks.send).toHaveBeenCalledOnce();
    expect(logError).toHaveBeenCalledWith("Failed to send hire notification email:", providerError);
  });
});
