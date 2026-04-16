/**
 * Dark Mode Detection Hook
 *
 * Watches the `data-theme` attribute on `<html>` for dark mode changes.
 * Uses a MutationObserver to react to theme toggles in real time.
 *
 * @module hooks/ui/useIsDarkMode
 */

import { useEffect, useState } from "react";

/**
 * Returns `true` when the document's `data-theme` attribute is `"dark"`.
 * Automatically updates when the theme changes.
 */
export function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() => document.documentElement.dataset.theme === "dark");

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.dataset.theme === "dark");
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
