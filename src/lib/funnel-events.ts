/** GA4 funnel events. Keep payloads categorical so contact details never reach analytics. */
type FunnelEvent =
  | "hire_profile_viewed"
  | "hire_opened"
  | "hire_form_started"
  | "hire_request_submitted"
  | "hire_request_created"
  | "hire_request_validation_failed"
  | "hire_request_api_failed"
  | "hire_request_network_failed"
  | "hire_builder_replied"
  | "onboarding_profile_viewed"
  | "onboarding_links_viewed"
  | "onboarding_project_viewed"
  | "onboarding_go_viewed"
  | "onboarding_profile_completed"
  | "onboarding_links_completed"
  | "onboarding_project_added"
  | "onboarding_project_skipped"
  | "onboarding_completed";

type AnalyticsWindow = Window & {
  gtag?: (command: "event", event: string) => void;
};

export function trackFunnelEvent(event: FunnelEvent): void {
  if (typeof window === "undefined") return;
  try {
    (window as AnalyticsWindow).gtag?.("event", event);
  } catch {
    // Analytics failures must never interrupt signup or hiring.
  }
}

/** The reply stage counts requests answered, rather than every message sent. */
export function isFirstBuilderReply(
  requests: ReadonlyArray<{ id: string; status: string }>,
  requestId: string,
): boolean {
  return requests.some((request) =>
    request.id === requestId && request.status !== "replied"
  );
}
