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

const SunGlyph = ({ className = "" }: { className?: string }) => (
  <span className={`text-[15px] leading-none ${className}`} aria-hidden>
    &#9728;
  </span>
);

const MoonGlyph = ({ className = "" }: { className?: string }) => (
  <span className={`text-[15px] leading-none ${className}`} aria-hidden>
    &#9789;
  </span>
);

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
        className="h-9 w-9 shrink-0 rounded-full border border-[color:var(--line)] bg-[color:var(--card)]/50 sm:h-8 sm:w-[68px] sm:rounded-full"
        aria-hidden
      />
    );
  }

  return (
    <div className="flex shrink-0 items-center justify-end">
      {/* Mobile: compact icon-only */}
      <button
        type="button"
        onClick={toggle}
        aria-pressed={dark}
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--line)] bg-[color:var(--card)]/90 text-[color:var(--foreground)] shadow-sm transition hover:border-[color:var(--accent-violet)]/35 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent-violet)] motion-safe:active:scale-95 sm:hidden"
      >
        <span className="inline-flex motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out">
          {dark ? (
            <MoonGlyph className="motion-safe:-rotate-[8deg]" />
          ) : (
            <SunGlyph className="motion-safe:rotate-[8deg]" />
          )}
        </span>
      </button>

      {/* sm+: slim sliding pill */}
      <button
        type="button"
        onClick={toggle}
        aria-pressed={dark}
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        className="relative hidden h-8 w-[68px] shrink-0 rounded-full border border-[color:var(--line)] bg-[color:var(--pill-track)] px-1 text-[color:var(--foreground)] shadow-sm ring-1 ring-[color:var(--pill-track-border)]/80 transition hover:border-[color:var(--accent-violet)]/35 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent-violet)] motion-safe:active:scale-[0.98] sm:inline-flex sm:items-center"
      >
        <span
          aria-hidden
          className="theme-toggle-thumb pointer-events-none absolute top-1 bottom-1 w-[calc(50%-5px)] rounded-full bg-gradient-to-b from-violet-500 to-violet-700 shadow-[var(--pill-glow)] dark:from-violet-400 dark:to-violet-700 dark:shadow-[var(--pill-glow-strong)]"
          data-dark={dark ? "true" : "false"}
        />
        <span className="relative z-[1] flex w-full items-center justify-between px-1.5 text-[11px] opacity-90">
          <SunGlyph />
          <MoonGlyph />
        </span>
      </button>
    </div>
  );
}
