import { useLayoutEffect } from "react";

/**
 * Scrolls the page to its top. The installed app scrolls inside `#app-scroll`
 * (AppShell); editorial pages scroll the document.
 */
export function scrollAppToTop(behavior: ScrollBehavior = "auto"): void {
  const appScroll = document.getElementById("app-scroll");
  if (appScroll) {
    appScroll.scrollTo({ top: 0, behavior });
    return;
  }
  window.scrollTo({ top: 0, behavior });
}

/**
 * Resets the page scroller to position 0 on mount.
 *
 * Runs in useLayoutEffect so the reset happens before paint — prevents the
 * flash that occurs when the outgoing page scrolls to 0 before the incoming
 * page mounts.
 */
export function useScrollToTop() {
  useLayoutEffect(() => {
    scrollAppToTop();
  }, []);
}
