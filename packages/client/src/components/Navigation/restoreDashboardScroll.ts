/**
 * Restore late-arriving dashboard rows until the saved position fits or the reader takes over.
 * The reader takes over with a wheel, a touch, a press or a key in the container, or in any of
 * `takeoverFrom`: the scroller itself, where a scrollbar drag or a key lands without touching
 * the container's content.
 */
export function restoreDashboardScroll(
  container: HTMLElement,
  findScroller: () => HTMLElement | null,
  scrollTop: number,
  onComplete: () => void,
  takeoverFrom: readonly HTMLElement[] = []
): () => void {
  let active = true;
  const interactionEvents = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
  const targets = [container, ...takeoverFrom];
  const dispose = () => {
    active = false;
    observer.disconnect();
    for (const target of targets)
      for (const event of interactionEvents) target.removeEventListener(event, complete, true);
  };
  const complete = () => {
    if (!active) return;
    dispose();
    onComplete();
  };
  const restore = () => {
    if (!active) return;
    const scroller = findScroller();
    if (!scroller) return;
    scroller.scrollTop = scrollTop;
    if (scroller.scrollTop >= scrollTop) complete();
  };
  const observer = new MutationObserver(restore);
  observer.observe(container, { childList: true, subtree: true });
  for (const target of targets)
    for (const event of interactionEvents)
      target.addEventListener(event, complete, { capture: true, passive: true });
  restore();
  return dispose;
}
