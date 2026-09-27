import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileNavigationLoading } from "@/components/profile/profile-navigation-loading";

let pathname = "/explore";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.useFakeTimers();
  pathname = "/explore";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<ProfileNavigationLoading />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function clickProfile(options: MouseEventInit = {}) {
  const link = document.createElement("a");
  link.href = "/profile/alice";
  link.addEventListener("click", (event) => event.preventDefault());
  document.body.appendChild(link);
  act(() => link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...options })));
  link.remove();
}

describe("profile navigation loading", () => {
  it("shows the profile skeleton on a cached click for a short minimum duration", () => {
    clickProfile();
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Loading builder profile");

    pathname = "/profile/alice";
    act(() => root.render(<ProfileNavigationLoading />));
    act(() => vi.advanceTimersByTime(499));
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("does not intercept a modified click that opens a new tab", () => {
    clickProfile({ metaKey: true });
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("clears the skeleton if navigation never completes", () => {
    clickProfile();
    act(() => vi.advanceTimersByTime(3000));
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
