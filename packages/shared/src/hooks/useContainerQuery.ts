import { useEffect, useRef, useState } from "react";

/**
 * Returns the current width of a container element via ResizeObserver.
 * Use instead of useMediaQuery when layout depends on container width, not viewport.
 */
export function useContainerQuery<T extends HTMLElement = HTMLDivElement>(
  breakpoint: number,
): { ref: React.RefObject<T | null>; matches: boolean; width: number } {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });

    observer.observe(element);
    setWidth(element.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, []);

  return { ref, matches: width >= breakpoint, width };
}
