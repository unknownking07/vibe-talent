"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import ProfileLoading from "@/components/profile/profile-loading";

const MIN_VISIBLE_MS = 500;
const NAVIGATION_TIMEOUT_MS = 3000;

type PendingProfile = {
  destination: string;
  source: string;
  startedAt: number;
};

/** Keep the route skeleton visible for a beat even when a profile was prefetched. */
export function ProfileNavigationLoading() {
  const pathname = usePathname();
  const [pending, setPending] = useState<PendingProfile | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (!(event.target instanceof Element)) return;

      const link = event.target.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;

      const destination = new URL(link.href);
      if (destination.origin !== window.location.origin) return;
      const destinationPath = destination.pathname.replace(/\/$/, "");
      if (!/^\/profile\/[^/]+$/.test(destinationPath)) return;
      if (destinationPath === pathname) return;

      setPending({ destination: destinationPath, source: pathname, startedAt: Date.now() });
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  useEffect(() => {
    if (!pending) return;

    const elapsed = Date.now() - pending.startedAt;
    const duration = pathname === pending.destination
      ? MIN_VISIBLE_MS
      : pathname === pending.source
        ? NAVIGATION_TIMEOUT_MS
        : 0;
    const timeout = window.setTimeout(() => {
      setPending((current) => current === pending ? null : current);
    }, Math.max(0, duration - elapsed));

    return () => window.clearTimeout(timeout);
  }, [pathname, pending]);

  useLayoutEffect(() => {
    if (!pending) return;

    const covered = ["site-content", "site-footer"]
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    const previous = covered.map((element) => ({
      element,
      inert: Boolean(element.inert),
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    for (const element of covered) {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    }

    function positionBelowNavbar() {
      const bottom = document.getElementById("site-navbar")?.getBoundingClientRect().bottom ?? 64;
      if (overlayRef.current) overlayRef.current.style.top = `${Math.max(0, Math.ceil(bottom))}px`;
    }
    positionBelowNavbar();
    window.addEventListener("scroll", positionBelowNavbar, { passive: true });

    return () => {
      window.removeEventListener("scroll", positionBelowNavbar);
      for (const { element, inert, ariaHidden } of previous) {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      }
    };
  }, [pending, pathname]);

  if (!pending || (pathname !== pending.source && pathname !== pending.destination)) return null;

  return (
    <div ref={overlayRef} className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto bg-[var(--background)]">
      <ProfileLoading />
    </div>
  );
}
