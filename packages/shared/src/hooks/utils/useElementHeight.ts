import { useCallback, useState } from "react";

/**
 * Measures an element's height and keeps it current, for content that has to
 * start below a `position: fixed` header whose height depends on its content.
 *
 * Returns a callback ref and the height in pixels (`null` until measured, so
 * the caller can hold a static fallback for the first frame). Each element gets
 * its own observer, disconnected before the element leaves: a removed element
 * reports a height of 0, which would slide the content under a header that
 * only renders on some routes.
 */
export function useElementHeight<T extends HTMLElement = HTMLDivElement>(): [
  (element: T | null) => (() => void) | undefined,
  number | null,
] {
  const [height, setHeight] = useState<number | null>(null);
  const measure = useCallback((element: T | null) => {
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setHeight(entry.contentRect.height);
    });
    observer.observe(element);
    setHeight(element.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, []);
  return [measure, height];
}
