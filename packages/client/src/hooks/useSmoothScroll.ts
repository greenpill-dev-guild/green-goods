import { useCallback, useRef } from "react";

interface SmoothScrollOptions {
  duration?: number;
  easing?: "ease" | "ease-in" | "ease-out" | "ease-in-out" | "linear";
  offset?: number;
  behavior?: "smooth" | "instant";
}

interface ScrollToOptions extends SmoothScrollOptions {
  element?: HTMLElement | null;
  selector?: string;
  top?: number;
  left?: number;
}

// Easing functions for smooth scrolling
const easingFunctions = {
  ease: (t: number) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  "ease-in": (t: number) => t * t,
  "ease-out": (t: number) => t * (2 - t),
  "ease-in-out": (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  linear: (t: number) => t,
};

export function useSmoothScroll() {
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  const scrollTo = useCallback(
    ({
      element,
      selector,
      top,
      left,
      duration = 800,
      easing = "ease-out",
      offset = 0,
      behavior = "smooth",
    }: ScrollToOptions) => {
      // Clear any existing scroll animation
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      let targetElement: HTMLElement | null = null;
      let targetTop = top;
      let targetLeft = left;

      // Determine target element and position
      if (element) {
        targetElement = element;
      } else if (selector) {
        targetElement = document.querySelector(selector) as HTMLElement;
      }

      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        targetTop = rect.top + scrollTop - offset;
        targetLeft = rect.left + scrollLeft;
      }

      // Use native smooth scrolling if available and requested
      if (behavior === "smooth" && "scrollBehavior" in document.documentElement.style) {
        window.scrollTo({
          top: targetTop,
          left: targetLeft,
          behavior: "smooth",
        });
        return;
      }

      // Custom smooth scrolling with easing
      const startTop = window.pageYOffset;
      const startLeft = window.pageXOffset;
      const distanceTop = (targetTop ?? startTop) - startTop;
      const distanceLeft = (targetLeft ?? startLeft) - startLeft;
      const startTime = performance.now();

      const animateScroll = (currentTime: number) => {
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        const easedProgress = easingFunctions[easing](progress);

        const currentTop = startTop + distanceTop * easedProgress;
        const currentLeft = startLeft + distanceLeft * easedProgress;

        window.scrollTo(currentLeft, currentTop);

        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        }
      };

      requestAnimationFrame(animateScroll);
    },
    []
  );

  const scrollToTop = useCallback(
    (options?: Omit<ScrollToOptions, "top">) => {
      scrollTo({ top: 0, ...options });
    },
    [scrollTo]
  );

  const scrollToBottom = useCallback(
    (options?: Omit<ScrollToOptions, "top">) => {
      const documentHeight = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
      );
      scrollTo({ top: documentHeight, ...options });
    },
    [scrollTo]
  );

  const scrollIntoView = useCallback(
    (elementOrSelector: HTMLElement | string, options?: SmoothScrollOptions) => {
      if (typeof elementOrSelector === "string") {
        scrollTo({ selector: elementOrSelector, ...options });
      } else {
        scrollTo({ element: elementOrSelector, ...options });
      }
    },
    [scrollTo]
  );

  // Momentum scrolling for better mobile experience
  const scrollWithMomentum = useCallback(
    (container: HTMLElement, deltaY: number, duration = 300) => {
      if (!container) return;

      const startScrollTop = container.scrollTop;
      const targetScrollTop = Math.max(
        0,
        Math.min(container.scrollHeight - container.clientHeight, startScrollTop + deltaY)
      );
      const distance = targetScrollTop - startScrollTop;
      const startTime = performance.now();

      const animateScroll = (currentTime: number) => {
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        const easedProgress = easingFunctions["ease-out"](progress);

        container.scrollTop = startScrollTop + distance * easedProgress;

        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        }
      };

      requestAnimationFrame(animateScroll);
    },
    []
  );

  return {
    scrollTo,
    scrollToTop,
    scrollToBottom,
    scrollIntoView,
    scrollWithMomentum,
  };
}
