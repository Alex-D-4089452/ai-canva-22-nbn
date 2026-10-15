import { useCallback, useEffect, useState } from "react";

export type ThemePref = "light" | "dark" | "system";

const STORAGE_KEY = "landing-theme";

/** Read the stored preference; "system" (the default) follows the OS. */
function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/**
 * Landing-page theme: system preference by default, with a manual override
 * that persists to localStorage. The resolved `isDark` is applied as the
 * `dark` class on the landing root (Tailwind `darkMode: "class"`), so the
 * theme is scoped to the landing page and never leaks into the app chrome.
 */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readPref);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Follow OS changes while the preference is "system".
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Persist explicit choices; "system" clears the stored value.
  useEffect(() => {
    try {
      if (pref === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      /* private mode — theme just won't persist */
    }
  }, [pref]);

  const isDark = pref === "system" ? systemDark : pref === "dark";

  // Keep the browser chrome/overscroll area in step with the theme so it
  // doesn't flash white (or black) around the page while scrolling.
  useEffect(() => {
    document.body.style.backgroundColor = isDark ? "#0a0a0c" : "#ffffff";
    return () => {
      document.body.style.backgroundColor = "";
    };
  }, [isDark]);

  // One click flips between the two explicit themes (to return to "system",
  // clear the site preference — a three-state cycle would be guesswork).
  const toggle = useCallback(() => setPref(isDark ? "light" : "dark"), [isDark]);

  return { isDark, toggle };
}
