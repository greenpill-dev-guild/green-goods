import { useCallback } from "react";

/**
 * Hook for navigating with native View Transitions API
 *
 * Provides smooth, GPU-accelerated page transitions using the browser's
 * View Transitions API. Falls back gracefully to instant navigation
 * in unsupported browsers.
 *
 * @example
 * ```tsx
 * import { useViewTransition } from "@green-goods/shared";
 * import { useNavigate } from "react-router-dom";
 *
 * function MyComponent() {
 *   const navigate = useNavigate();
 *   const navigateWithTransition = useViewTransition(navigate);
 *
 *   return (
 *     <button onClick={() => navigateWithTransition("/profile")}>
 *       Go to Profile
 *     </button>
 *   );
 * }
 * ```
 *
 * @param navigate - The navigation function (from react-router, tanstack router, etc.)
 * @returns A wrapped navigation function that uses View Transitions
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
 */
export function useViewTransition<T extends (...args: unknown[]) => void>(
  navigate: T
): (...args: Parameters<T>) => void {
  return useCallback(
    (...args: Parameters<T>) => {
      // Check if the browser supports View Transitions API
      if (typeof document !== "undefined" && "startViewTransition" in document) {
        // Use the native View Transitions API
        (
          document as Document & { startViewTransition: (cb: () => void) => void }
        ).startViewTransition(() => {
          navigate(...args);
        });
      } else {
        // Fallback for unsupported browsers - navigate immediately
        navigate(...args);
      }
    },
    [navigate]
  );
}

/**
 * Programmatically start a view transition for any DOM update
 *
 * Useful for non-navigation transitions like:
 * - Switching between tabs
 * - Filtering/sorting lists
 * - Theme changes
 *
 * @example
 * ```tsx
 * import { startViewTransition } from "@green-goods/shared";
 *
 * function handleFilterChange(filter: string) {
 *   startViewTransition(() => {
 *     setActiveFilter(filter);
 *   });
 * }
 * ```
 *
 * @param callback - Function to run inside the view transition
 * @returns Promise that resolves when the transition is complete
 */
export async function startViewTransition(callback: () => void): Promise<void> {
  if (typeof document !== "undefined" && "startViewTransition" in document) {
    const transition = (
      document as Document & {
        startViewTransition: (cb: () => void) => { finished: Promise<void> };
      }
    ).startViewTransition(callback);
    await transition.finished;
  } else {
    // Fallback for unsupported browsers
    callback();
  }
}
