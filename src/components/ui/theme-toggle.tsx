"use client";

import { useState, useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

function getThemeSnapshot(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function getServerSnapshot(): "light" | "dark" {
  return "light";
}

function subscribeToTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerSnapshot);
  const [mounted] = useState(() => typeof window !== "undefined");

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    localStorage.setItem("theme", next);
    if (next === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  // Avoid hydration mismatch — show placeholder on server
  if (!mounted) {
    return (
      <button
        className="flex items-center justify-center w-9 h-9"
        style={{
          border: "2px solid var(--border-hard)",
          backgroundColor: "var(--bg-surface)",
          boxShadow: "var(--shadow-brutal-sm)",
          cursor: "pointer",
          transition: "transform 0.1s, box-shadow 0.1s",
        }}
        aria-label="Toggle theme"
      >
        <Sun size={16} />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center justify-center w-9 h-9 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_var(--border-hard)]"
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
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
