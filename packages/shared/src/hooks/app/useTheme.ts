import { useCallback, useEffect, useState } from "react";
import { type Theme, getTheme, getResolvedTheme, setTheme as setThemeAPI } from "../../theme";

/**
 * React hook for theme management
 * Provides theme state and controls compatible with old useDarkMode interface
 */
export function useTheme() {
  const [themeState, setThemeState] = useState<Theme>(() => getTheme());
  const [isDark, setIsDark] = useState<boolean>(() => {
    const theme = getTheme();
    return getResolvedTheme(theme) === "dark";
  });

  // Update theme and persist
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeAPI(newTheme);
    setThemeState(newTheme);
    setIsDark(getResolvedTheme(newTheme) === "dark");
  }, []);

  // Toggle through light → dark → system
  const toggleTheme = useCallback(() => {
    const order: Theme[] = ["light", "dark", "system"];
    const currentIndex = order.indexOf(themeState);
    const nextIndex = (currentIndex + 1) % order.length;
    const next = order[nextIndex];
    setTheme(next);
  }, [themeState, setTheme]);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (themeState !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      setIsDark(mediaQuery.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    // Legacy browsers
    if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener?.(handleChange);
    }

    return undefined;
  }, [themeState]);

  return {
    theme: themeState,
    isDark,
    setTheme,
    toggleTheme,
  } as const;
}
