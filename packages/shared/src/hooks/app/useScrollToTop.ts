import { useLayoutEffect } from "react";

/**
 * Resets the #app-scroll container to scroll position 0 on mount.
 *
 * Runs in useLayoutEffect so the reset happens before paint — prevents the
 * flash that occurs when the outgoing page scrolls to 0 before the incoming
 * page mounts.
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
