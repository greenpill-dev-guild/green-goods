import { type RefObject, useEffect, useRef, useState } from "react";

interface UseInViewRevealOptions {
  /** Fraction of the element that must be visible to trigger. 0–1. Default 0
   * — any visibility triggers. The 0 default keeps the hook reliable for
   * sections taller than the viewport (e.g. evidence ledgers, action grids),
   * where a percentage-based threshold can be borderline-impossible to meet
   * because the visible portion is capped by the viewport size. */
  threshold?: number;
  /** Root margin passed to IntersectionObserver (CSS shorthand). Default biases trigger toward earlier reveal. */
  rootMargin?: string;
  /** When true, stays revealed once triggered. When false, toggles on enter/leave. Default true. */
  once?: boolean;
}

/**
 * Tracks whether an element has crossed into the viewport. Pair with a
 * `data-revealed` attribute on the same node + CSS that flips appearance
 * when the attribute becomes "true". Falls back to revealed=true when
 * IntersectionObserver is unavailable (older browsers / SSR).
 */
export function useInViewReveal<T extends HTMLElement = HTMLElement>(
  options: UseInViewRevealOptions = {}
): { ref: RefObject<T | null>; revealed: boolean } {
  const { threshold = 0, rootMargin = "0px 0px -10% 0px", once = true } = options;
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setRevealed(false);
          }
        }
      },
      { threshold, rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, revealed };
}
