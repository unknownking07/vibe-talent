"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

function getThemeSnapshot(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function getServerSnapshot(): "light" | "dark" {
  return "dark";
}

function subscribeToTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function toggle() {
  const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const next = current === "light" ? "dark" : "light";
  localStorage.setItem("theme", next);
  if (next === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerSnapshot);

  return (
    <button
      onClick={toggle}
      className="flex items-center justify-center w-10 h-10 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_var(--border-hard)]"
      style={{
        border: "2px solid var(--border-hard)",
        backgroundColor: theme === "dark" ? "#1a1a1a" : "var(--bg-surface)",
        color: "var(--foreground)",
        boxShadow: "var(--shadow-brutal-sm)",
        cursor: "pointer",
        transition: "transform 0.1s, box-shadow 0.1s",
      }}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
