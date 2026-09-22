import { afterEach, describe, expect, it, vi } from "vitest";
import { isFirstBuilderReply, trackFunnelEvent } from "../funnel-events";

type AnalyticsWindow = Window & {
  gtag?: (...args: unknown[]) => void;
};

const analyticsWindow = window as AnalyticsWindow;

afterEach(() => {
  delete analyticsWindow.gtag;
});

describe("trackFunnelEvent", () => {
  it("sends a stage-specific event without contact details to GA", () => {
    const gtag = vi.fn();
    analyticsWindow.gtag = gtag;

    trackFunnelEvent("onboarding_project_viewed");

    expect(gtag).toHaveBeenCalledWith("event", "onboarding_project_viewed");
  });

  it("never interrupts the user flow when analytics is unavailable or broken", () => {
    expect(() => trackFunnelEvent("hire_request_created")).not.toThrow();
    analyticsWindow.gtag = () => {
      throw new Error("blocked analytics");
    };
    expect(() => trackFunnelEvent("hire_request_created")).not.toThrow();
  });
});

describe("isFirstBuilderReply", () => {
  const requests = [
    { id: "new-request", status: "read" },
    { id: "answered-request", status: "replied" },
  ];

  it("counts the first response to an existing open request", () => {
    expect(isFirstBuilderReply(requests, "new-request")).toBe(true);
  });

  it("does not count later responses or missing requests", () => {
    expect(isFirstBuilderReply(requests, "answered-request")).toBe(false);
    expect(isFirstBuilderReply(requests, "missing-request")).toBe(false);
  });
});
