import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));

import { sendFounderBriefNotification } from "@/lib/email";

const originalApiKey = process.env.RESEND_API_KEY;
afterEach(() => {
  mocks.send.mockReset();
  if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalApiKey;
});

describe("sendFounderBriefNotification", () => {
  it("sends only to the operator and escapes founder text in HTML", async () => {
    process.env.RESEND_API_KEY = "test-key";
    mocks.send.mockResolvedValue({ data: { id: "email-1" }, error: null });
    await sendFounderBriefNotification({
      id: "brief-1",
      name: "Ada Lovelace",
      email: "ada@startup.io",
      description: "Build an <img src=x onerror=alert(1)> for our customers.",
      tech_stack: ["React"],
      project_type: "mvp",
      timeline: "1_month",
      budget: "2k_5k",
      source: "agent_find",
      consent_at: new Date().toISOString(),
      status: "new",
    });
    const message = mocks.send.mock.calls[0][0];
    expect(message.to).toBe("vibetalentwork@gmail.com");
    expect(message.replyTo).toBe("ada@startup.io");
    expect(message.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(message.html).not.toContain("<img src=x onerror=alert(1)>");
  });
});
