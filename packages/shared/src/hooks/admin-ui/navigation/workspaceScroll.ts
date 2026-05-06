const CANVAS_SCROLL_SELECTOR = '[data-region="main-scroll-area"]';

function getCanvasScrollElement(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(CANVAS_SCROLL_SELECTOR);
}

export function readCanvasScrollPosition(): number {
  return getCanvasScrollElement()?.scrollTop ?? 0;
}

export function restoreCanvasScrollPosition(scrollPosition: number): void {
  if (scrollPosition <= 0 || typeof window === "undefined") return;

  const restore = () => {
    const scrollElement = getCanvasScrollElement();
    if (!scrollElement) return;

    if (typeof scrollElement.scrollTo === "function") {
      scrollElement.scrollTo({ top: scrollPosition });
      return;
    }

    scrollElement.scrollTop = scrollPosition;
  };

  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(restore);
    return;
  }

  window.setTimeout(restore, 0);
}

export function bindCanvasScrollPositionPersistence(
  onScrollPositionChange: (scrollPosition: number) => void
): () => void {
  const scrollElement = getCanvasScrollElement();
  if (!scrollElement || typeof window === "undefined") return () => {};

  let frameId: number | null = null;
  let timeoutId: number | null = null;
  const persistScrollPosition = () => {
    if (frameId !== null || timeoutId !== null) return;

    const persist = () => {
      frameId = null;
      timeoutId = null;
      onScrollPositionChange(scrollElement.scrollTop);
    };

    if (typeof window.requestAnimationFrame === "function") {
      frameId = window.requestAnimationFrame(persist);
    } else {
      timeoutId = window.setTimeout(persist, 0);
    }
  };

  scrollElement.addEventListener("scroll", persistScrollPosition, { passive: true });

  return () => {
    scrollElement.removeEventListener("scroll", persistScrollPosition);
    if (frameId !== null) {
      window.cancelAnimationFrame(frameId);
    }
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  };
}
