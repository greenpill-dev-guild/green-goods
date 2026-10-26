import { restoreDashboardScroll } from "@/components/Navigation/restoreDashboardScroll";

/**
 * Where Home was when it opened a page (QA finding 3): the app scroller's offset and the control
 * that opened the page. Home stays mounted, out of sight, under the pages it opens, so its rows
 * and their layout outlive the visit and both can go back as they were. `away` holds from the
 * moment Home opens a page until its place is back: the scroller's offset then belongs to the
 * page and to the shell's route resets, never to Home.
 */
export interface HomePlace {
  scrollTop: number;
  opener: HTMLElement | null;
  away: boolean;
}

const CONTROL = "a[href], button, [role='button'], [tabindex]:not([tabindex='-1'])";

/**
 * Follows Home while it shows: the scroller's offset, and the last control pressed in Home's
 * own content, such as a row, the chip or a launcher. A press in a sheet over Home lands in
 * <body>, not in Home's content, so a page opened from a sheet hands focus back to the control
 * that opened the sheet. Returns the cleanup.
 */
export function followHomePlace(
  content: HTMLElement,
  scroller: HTMLElement,
  place: HomePlace
): () => void {
  const onScroll = () => {
    // Away, the scroller is the page's, and the shell resets it as Home shows again before its
    // place is back; neither may replace the place.
    if (!place.away) place.scrollTop = scroller.scrollTop;
  };
  // A click, not focus: Safari does not focus a button or link on a tap.
  const onPress = (event: Event) => {
    const control =
      event.target instanceof Element ? event.target.closest<HTMLElement>(CONTROL) : null;
    if (control && content.contains(control)) place.opener = control;
  };
  scroller.addEventListener("scroll", onScroll, { passive: true });
  content.addEventListener("click", onPress, { capture: true });
  return () => {
    scroller.removeEventListener("scroll", onScroll);
    content.removeEventListener("click", onPress, { capture: true });
  };
}

/**
 * Puts Home back where it was once it shows again. The shell scrolls every new route to the top
 * in a layout effect that runs after Home's own, so the offset goes back on the next frame,
 * before it paints, and holds while late rows settle until it fits or the reader scrolls. Focus
 * then returns to the control that opened the page, unless something else took it, such as a
 * sheet reopened over Home. Following resumes once both are back. Returns the cleanup.
 */
export function restoreHomePlace(
  content: HTMLElement,
  scroller: HTMLElement,
  place: HomePlace
): () => void {
  let stopScroll = () => {};
  const frame = requestAnimationFrame(() => {
    stopScroll = restoreDashboardScroll(
      content,
      () => scroller,
      place.scrollTop,
      () => {}
    );
    const { opener } = place;
    place.opener = null;
    const unclaimed = document.activeElement === null || document.activeElement === document.body;
    if (opener?.isConnected && unclaimed) opener.focus({ preventScroll: true });
    place.away = false;
  });
  return () => {
    cancelAnimationFrame(frame);
    stopScroll();
  };
}
