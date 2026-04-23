"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "itax-theme";

const applyTheme = (dark: boolean) => {
  const root = document.documentElement;
  if (dark) {
    root.classList.add("dark");
    localStorage.setItem(STORAGE_KEY, "dark");
  } else {
    root.classList.remove("dark");
    localStorage.setItem(STORAGE_KEY, "light");
  }
};

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    applyTheme(next);
    setDark(next);
  };

  if (!mounted) {
    return (
      <div
        className="h-11 w-[7.5rem] shrink-0 rounded-full border border-[color:var(--line)] bg-[color:var(--card)]/50"
        aria-hidden
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--card)]/90 px-4 text-sm font-medium text-[color:var(--foreground)] shadow-sm transition hover:border-[color:var(--accent-violet)]/35 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent-violet)]"
    >
      <span className="tabular-nums">{dark ? "Dark" : "Light"}</span>
      <span className="text-base leading-none" aria-hidden>
        {dark ? "\u2600" : "\u263E"}
      </span>
    </button>
  );
}
