/** Restore late-arriving dashboard rows until the saved position fits or the reader takes over. */
export function restoreDashboardScroll(
  container: HTMLElement,
  findScroller: () => HTMLElement | null,
  scrollTop: number,
  onComplete: () => void
): () => void {
  let active = true;
  const interactionEvents = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
  const dispose = () => {
    active = false;
    observer.disconnect();
    for (const event of interactionEvents) container.removeEventListener(event, complete, true);
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
  for (const event of interactionEvents)
    container.addEventListener(event, complete, { capture: true, passive: true });
  restore();
  return dispose;
}
