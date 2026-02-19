/**
 * Before Unload While Pending Hook
 *
 * Registers a `beforeunload` event handler when a transaction is in-flight,
 * showing a browser-native confirmation dialog if the user tries to close
 * or navigate away. Automatically unregisters when the transaction completes.
 *
 * @module hooks/utils/useBeforeUnloadWhilePending
 */

import { useEffect } from "react";

/**
 * Shows a browser confirmation dialog when the user tries to close the tab
 * while `isPending` is true.
 *
 * @param isPending - Whether a transaction is currently in-flight
 *
 * @example
 * ```tsx
 * const mutation = useMutation({ ... });
 * useBeforeUnloadWhilePending(mutation.isPending);
 * ```
 */
export function useBeforeUnloadWhilePending(isPending: boolean): void {
  useEffect(() => {
    if (!isPending) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Setting returnValue is required for Chrome/Edge compatibility
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isPending]);
}
