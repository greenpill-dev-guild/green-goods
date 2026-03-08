import { useLayoutEffect } from "react";

/**
 * Resets the #app-scroll container to scroll position 0 on mount.
 *
 * Uses useLayoutEffect so the reset runs synchronously after DOM mutations
 * but BEFORE the browser paints — making the scroll jump invisible.
 *
 * Use this in views that should always start at the top (e.g., Garden, Work detail).
 * This replaces scroll logic that was previously in useNavigateToTop, which caused
 * a visible flash because the old page scrolled to top before the new page rendered.
 */
export function useScrollToTop() {
  useLayoutEffect(() => {
    const el = document.getElementById("app-scroll");
    if (el) {
      el.scrollTop = 0;
    } else {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, []);
}
