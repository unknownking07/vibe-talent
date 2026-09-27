import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileNavigationLoading } from "@/components/profile/profile-navigation-loading";

let pathname = "/explore";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
let main: HTMLElement;
let navbar: HTMLElement;
let footer: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  pathname = "/explore";
  container = document.createElement("div");
  document.body.appendChild(container);
  main = document.createElement("main");
  main.id = "site-content";
  document.body.appendChild(main);
  navbar = document.createElement("nav");
  navbar.id = "site-navbar";
  vi.spyOn(navbar, "getBoundingClientRect").mockReturnValue({ bottom: 100 } as DOMRect);
  document.body.appendChild(navbar);
  footer = document.createElement("footer");
  footer.id = "site-footer";
  document.body.appendChild(footer);
  root = createRoot(container);
  act(() => root.render(<ProfileNavigationLoading />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  main.remove();
  navbar.remove();
  footer.remove();
  vi.useRealTimers();
});

function clickProfile(options: MouseEventInit = {}, href = "/profile/alice") {
  const link = document.createElement("a");
  link.href = href;
  link.addEventListener("click", (event) => event.preventDefault());
  document.body.appendChild(link);
  act(() => link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...options })));
  link.remove();
}

describe("profile navigation loading", () => {
  it("shows the profile skeleton on a cached click for a short minimum duration", () => {
    clickProfile();
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Loading builder profile");
    expect(main.inert).toBe(true);
    expect(main.getAttribute("aria-hidden")).toBe("true");
    expect(footer.inert).toBe(true);
    expect((container.firstElementChild as HTMLElement).style.top).toBe("100px");

    vi.spyOn(navbar, "getBoundingClientRect").mockReturnValue({ bottom: 64 } as DOMRect);
    act(() => window.dispatchEvent(new Event("scroll")));
    expect((container.firstElementChild as HTMLElement).style.top).toBe("64px");

    pathname = "/profile/alice";
    act(() => root.render(<ProfileNavigationLoading />));
    act(() => vi.advanceTimersByTime(499));
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(main.inert).toBe(false);
    expect(main.hasAttribute("aria-hidden")).toBe(false);
    expect(footer.inert).toBe(false);
  });

  it("does not intercept a modified click that opens a new tab", () => {
    clickProfile({ metaKey: true });
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("keeps the skeleton visible when navigation takes longer than three seconds", () => {
    clickProfile();
    act(() => vi.advanceTimersByTime(3000));
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(main.inert).toBe(true);
  });

  it("falls back to the requested profile when soft navigation stalls", () => {
    const onNavigationStall = vi.fn();
    window.history.replaceState({}, "", "/explore");
    act(() => root.render(<ProfileNavigationLoading onNavigationStall={onNavigationStall} />));
    clickProfile({}, "/profile/alice?ref=leaderboard#reviews");

    act(() => vi.advanceTimersByTime(4999));
    expect(onNavigationStall).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')).not.toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(onNavigationStall).toHaveBeenCalledWith("/profile/alice?ref=leaderboard#reviews");
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });
});
