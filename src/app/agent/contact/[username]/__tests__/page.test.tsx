import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContactPage from "@/app/agent/contact/[username]/page";

const mocks = vi.hoisted(() => ({ fetchUser: vi.fn() }));
vi.mock("@/lib/supabase/queries", () => ({ fetchUserByUsername: mocks.fetchUser }));
vi.mock("@/components/agent/agent-thinking", () => ({
  AgentThinking: ({ onComplete }: { onComplete: () => void }) => (
    <button onClick={onComplete}>Finish draft</button>
  ),
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
let fetchMock: ReturnType<typeof vi.fn>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchUser.mockResolvedValue({
    id: "builder-id", username: "shipper", vibe_score: 100, streak: 7,
    projects: [], social_links: null,
  });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  container = document.body.appendChild(document.createElement("div"));
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render() {
  const params = Promise.resolve({ username: "shipper" });
  await act(async () => {
    root.render(<Suspense><ContactPage params={params} /></Suspense>);
  });
  await act(async () => { container.querySelector("button")!.click(); });
}

async function type(selector: string, value: string) {
  const input = container.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
  expect(input, `Missing form field: ${selector}`).not.toBeNull();
  const prototype = input instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function sendButton() {
  return [...container.querySelectorAll("button")].find((button) =>
    /Send Hire Request|Sending/.test(button.textContent ?? ""),
  )!;
}

async function fillContact() {
  await type('input[type="text"]', "Ada Lovelace");
  await type('input[type="email"]', "  ADA@ACME.DEV  ");
}

describe("agent contact", () => {
  it("waits for a saved request before showing success", async () => {
    const pending = deferred<Response>();
    fetchMock.mockReturnValue(pending.promise);
    await render();
    await fillContact();
    const form = container.querySelector("form")!;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).not.toContain("Request Sent!");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(sendButton().disabled).toBe(true);
    await act(async () => { sendButton().click(); });
    expect(fetchMock).toHaveBeenCalledOnce();

    await act(async () => {
      pending.resolve(new Response(JSON.stringify({ success: true, id: "saved-request" })));
    });
    expect(container.textContent).toContain("Request Sent!");
    expect(container.querySelector('a[href="/hire/chat/saved-request"]')).not.toBeNull();
  });

  it("sends the builder, cleaned contact details, and edited draft to the hire API", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, id: "saved-request" })));
    await render();
    await fillContact();
    await type("textarea", "  Please build a working onboarding screen for our app.  ");
    await act(async () => { sendButton().click(); });

    expect(fetchMock).toHaveBeenCalledWith("/api/hire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        builder_id: "builder-id",
        sender_name: "Ada Lovelace",
        sender_email: "ada@acme.dev",
        message: "Please build a working onboarding screen for our app.",
        budget: null,
      }),
    });
  });

  it("keeps the draft and allows retry after the API rejects the request", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Too many requests. Please try again tomorrow." }), { status: 429 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, id: "retry-request" })));
    await render();
    await fillContact();
    const draft = container.querySelector("textarea")!.value;
    await act(async () => { sendButton().click(); });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Too many requests");
    expect(container.textContent).not.toContain("Request Sent!");
    expect(container.querySelector("textarea")!.value).toBe(draft);
    expect(sendButton().disabled).toBe(false);
    await act(async () => { sendButton().click(); });
    expect(container.querySelector('a[href="/hire/chat/retry-request"]')).not.toBeNull();
  });

  it("keeps the form available after a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await render();
    await fillContact();
    await act(async () => { sendButton().click(); });
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Request Sent!");
    expect(sendButton().disabled).toBe(false);
  });

  it("does not claim success when the response has no saved request ID", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true })));
    await render();
    await fillContact();
    await act(async () => { sendButton().click(); });
    expect(container.textContent).not.toContain("Request Sent!");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it.each([
    ['input[type="text"]', "A"],
    ['input[type="email"]', "not-an-email"],
    ['input[type="email"]', "ada@mailinator.com"],
    ["textarea", "too short"],
  ])("blocks invalid %s values before sending: %s", async (selector, value) => {
    await render();
    await fillContact();
    await type(selector, value);
    await act(async () => { sendButton().click(); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Request Sent!");
  });
});
