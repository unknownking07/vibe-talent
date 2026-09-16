import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createNotification: vi.fn(),
  sendHireNotification: vi.fn(),
  getUserById: vi.fn(),
  profileLookup: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: mocks.createNotification,
}));
vi.mock("@/lib/email", () => ({
  sendHireNotification: mocks.sendHireNotification,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { getUserById: mocks.getUserById } },
    from: () => ({
      select: () => ({ eq: () => ({ single: mocks.profileLookup }) }),
    }),
  }),
}));

import { notifyBuilderOfHireRequest } from "@/lib/hire-notifications";

const notice = {
  builderId: "builder-1",
  senderName: "Ada",
  message: "Can you build our onboarding flow?",
  requestId: "request-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserById.mockResolvedValue({
    data: { user: { email: "builder@example.com" } },
  });
  mocks.profileLookup.mockResolvedValue({ data: { username: "octocat" } });
});

describe("notifyBuilderOfHireRequest", () => {
  it("notifies the builder in-app and by email", async () => {
    await notifyBuilderOfHireRequest(notice);

    expect(mocks.createNotification).toHaveBeenCalledWith({
      user_id: "builder-1",
      type: "hire_request",
      title: "New hire request",
      message: "Ada wants to hire you",
      metadata: { hire_request_id: "request-1", sender_name: "Ada" },
    });
    expect(mocks.sendHireNotification).toHaveBeenCalledWith({
      builderEmail: "builder@example.com",
      builderUsername: "octocat",
      senderName: "Ada",
      message: "Can you build our onboarding flow?",
      requestId: "request-1",
    });
  });

  it("skips the email when the builder has no address, but still notifies in-app", async () => {
    mocks.getUserById.mockResolvedValue({ data: { user: { email: null } } });

    await notifyBuilderOfHireRequest(notice);

    expect(mocks.createNotification).toHaveBeenCalledOnce();
    expect(mocks.sendHireNotification).not.toHaveBeenCalled();
  });

  it("never throws, so a failed email cannot surface as a failed hire request", async () => {
    mocks.getUserById.mockRejectedValue(new Error("auth admin down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(notifyBuilderOfHireRequest(notice)).resolves.toBeUndefined();
    expect(mocks.createNotification).toHaveBeenCalledOnce();
  });
});
