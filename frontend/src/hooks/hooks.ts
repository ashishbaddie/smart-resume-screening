import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

/** Light/dark theme stored on <html data-theme>. The initial value is set by a script in index.html. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light",
  );

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch { /* private mode: keep it for this session only */ }
      return next;
    });
  }, []);

  return [theme, toggle];
}

/** Matches a CSS media query. Falls back to `fallback` where matchMedia is unavailable (tests). */
export function useMediaQuery(query: string, fallback = true): boolean {
  const supported = typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [matches, setMatches] = useState(() => (supported ? window.matchMedia(query).matches : fallback));

  useEffect(() => {
    if (!supported) return;
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query, supported]);

  return matches;
}

/** Whole seconds since `active` became true; resets to 0 when it turns false. */
export function useElapsed(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) { setSeconds(0); return; }
    const started = Date.now();
    const id = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 500);
    return () => window.clearInterval(id);
  }, [active]);
  return seconds;
}

/** Calls `onEscape` when Escape is pressed while `active`. */
export function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onEscape(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, onEscape]);
}
