import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  REFERRAL_CODE_KEY,
  submitPendingReferral,
} from "@/lib/referral-client";

function respondWith(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  });
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(REFERRAL_CODE_KEY, "octocat");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("submitPendingReferral", () => {
  it("does nothing when no code was saved at signup", async () => {
    localStorage.clear();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await submitPendingReferral();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the saved code as the referrer", async () => {
    const fetchMock = respondWith(200, { credited: true });
    vi.stubGlobal("fetch", fetchMock);

    await submitPendingReferral();
    expect(fetchMock).toHaveBeenCalledWith("/api/referrals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referrer: "octocat" }),
    });
  });

  it.each([
    ["the referral is credited", 200, { credited: true }],
    ["it is refused for good", 200, { credited: false, reason: "already_referred" }],
    ["the request is malformed", 400, { error: "referrer is required" }],
  ])("drops the code once %s", async (_label, status, body) => {
    vi.stubGlobal("fetch", respondWith(status, body));

    await submitPendingReferral();
    expect(localStorage.getItem(REFERRAL_CODE_KEY)).toBeNull();
  });

  it.each([
    ["GitHub isn't verified yet", 200, { credited: false, reason: "github_not_verified" }],
    ["the session isn't ready", 401, { error: "Unauthorized" }],
    ["the server fails", 500, { error: "Failed to credit referral" }],
  ])("keeps the code for a later visit when %s", async (_label, status, body) => {
    vi.stubGlobal("fetch", respondWith(status, body));

    await submitPendingReferral();
    expect(localStorage.getItem(REFERRAL_CODE_KEY)).toBe("octocat");
  });

  it("keeps the code on a network failure, without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(submitPendingReferral()).resolves.toBeUndefined();
    expect(localStorage.getItem(REFERRAL_CODE_KEY)).toBe("octocat");
  });
});
