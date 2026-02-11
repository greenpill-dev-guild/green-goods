/**
 * Async Effect Hook
 *
 * Provides a safe wrapper for async operations in useEffect.
 * Automatically handles cleanup and prevents state updates after unmount.
 *
 * @module hooks/utils/useAsyncEffect
 */

import { useEffect, useRef, type DependencyList } from "react";
import { logger } from "../../modules/app/logger";

interface AsyncEffectCallbacks {
  /** Called when the component unmounts or dependencies change */
  onCleanup?: () => void;
  /** Called when the async operation is cancelled (component unmounted during execution) */
  onCancel?: () => void;
  /** Called when the async operation throws an error */
  onError?: (error: unknown) => void;
}

/**
 * Context passed to the async effect function.
 * Use `signal` to check if the effect was cancelled.
 */
interface AsyncEffectContext {
  /** AbortSignal that is aborted when the effect is cleaned up */
  signal: AbortSignal;
  /** Returns true if the component is still mounted */
  isMounted: () => boolean;
}

/**
 * Hook for running async operations in useEffect with proper cleanup.
 *
 * @param effect - Async function to execute. Receives a context with signal and isMounted.
 * @param deps - Dependency array (same as useEffect)
 * @param callbacks - Optional callbacks for cleanup, cancel, and error handling
 *
 * @example
 * ```tsx
 * // Basic usage with isMounted check
 * useAsyncEffect(
 *   async ({ isMounted }) => {
 *     const data = await fetchData();
 *     if (isMounted()) {
 *       setData(data);
 *     }
 *   },
 *   [fetchData]
 * );
 *
 * // With AbortSignal for cancellable fetch
 * useAsyncEffect(
 *   async ({ signal, isMounted }) => {
 *     const response = await fetch("/api/data", { signal });
 *     const data = await response.json();
 *     if (isMounted()) {
 *       setData(data);
 *     }
 *   },
 *   []
 * );
 *
 * // With error handling
 * useAsyncEffect(
 *   async ({ isMounted }) => {
 *     const data = await riskyOperation();
 *     if (isMounted()) {
 *       setData(data);
 *     }
 *   },
 *   [],
 *   {
 *     onError: (error) => {
 *       console.error("Operation failed:", error);
 *       trackError(error);
 *     },
 *   }
 * );
 * ```
 */
export function useAsyncEffect(
  effect: (context: AsyncEffectContext) => Promise<void>,
  deps: DependencyList,
  callbacks?: AsyncEffectCallbacks
): void {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const abortController = new AbortController();

    const context: AsyncEffectContext = {
      signal: abortController.signal,
      isMounted: () => isMountedRef.current && !abortController.signal.aborted,
    };

    // Execute the async effect
    effect(context).catch((error) => {
      // Don't report errors if we were aborted (component unmounted)
      if (abortController.signal.aborted) {
        callbacks?.onCancel?.();
        return;
      }

      // Call error handler if provided
      if (callbacks?.onError) {
        callbacks.onError(error);
      } else {
        // Re-throw to preserve default behavior if no handler
        logger.error("[useAsyncEffect] Unhandled error", { error });
      }
    });

    return () => {
      isMountedRef.current = false;
      abortController.abort();
      callbacks?.onCleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

interface AsyncSetupCallbacks {
  /** Called when the async setup throws an error */
  onError?: (error: unknown) => void;
}

/**
 * Hook for running an async setup function that returns a cleanup function.
 * Useful for async initialization that needs cleanup.
 *
 * @param setup - Async function that receives an AbortSignal and returns a cleanup function (or undefined)
 * @param deps - Dependency array
 * @param callbacks - Optional callbacks for error handling
 *
 * @example
 * ```tsx
 * // Async setup with cleanup and cancellation
 * useAsyncSetup(
 *   async (signal) => {
 *     const response = await fetch("/api/config", { signal });
 *     const config = await response.json();
 *
 *     const handler = () => console.log("Config changed");
 *     document.addEventListener("configchange", handler);
 *
 *     return () => {
 *       document.removeEventListener("configchange", handler);
 *     };
 *   },
 *   [],
 *   {
 *     onError: (error) => {
 *       console.error("Setup failed:", error);
 *       trackError(error);
 *     },
 *   }
 * );
 * ```
 */
export function useAsyncSetup(
  setup: (signal: AbortSignal) => Promise<(() => void) | void>,
  deps: DependencyList,
  callbacks?: AsyncSetupCallbacks
): void {
  const cleanupRef = useRef<(() => void) | void>(undefined);

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    // Run any previous cleanup before starting new setup
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = undefined;
    }

    setup(abortController.signal)
      .then((cleanup) => {
        if (isMounted) {
          cleanupRef.current = cleanup;
        } else {
          // Component unmounted before setup finished, run cleanup immediately
          cleanup?.();
        }
      })
      .catch((error) => {
        // Don't log errors if we aborted the operation
        if (!abortController.signal.aborted) {
          if (callbacks?.onError) {
            callbacks.onError(error);
          } else {
            logger.error("[useAsyncSetup] Setup failed", { error });
          }
        }
      });

    return () => {
      isMounted = false;
      abortController.abort();
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = undefined;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
