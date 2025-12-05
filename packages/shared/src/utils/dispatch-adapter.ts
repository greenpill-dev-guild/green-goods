/**
 * Dispatch Adapter Utilities
 *
 * Helper to create React.Dispatch<SetStateAction<T>> from Zustand setters.
 * Useful when you need to maintain React's dispatch API for consumers.
 */

import type React from "react";

/**
 * Create a React.Dispatch adapter from a getter and setter function.
 * This allows Zustand store setters to be used with React's dispatch pattern.
 *
 * @param getter - Function that returns current value
 * @param setter - Function to set new value
 * @returns React.Dispatch<React.SetStateAction<T>>
 *
 * @example
 * // In a provider using Zustand
 * const actionUID = useStore((s) => s.actionUID);
 * const _setActionUID = useStore((s) => s.setActionUID);
 *
 * // Create dispatch adapter
 * const setActionUID = createDispatchAdapter(
 *   () => actionUID,
 *   _setActionUID
 * );
 *
 * // Now works like useState setter:
 * setActionUID(5);                    // Direct value
 * setActionUID(prev => prev + 1);     // Functional update
 */
export function createDispatchAdapter<T>(
  getter: () => T,
  setter: (value: T) => void
): React.Dispatch<React.SetStateAction<T>> {
  return (updater: React.SetStateAction<T>) => {
    const next = typeof updater === "function" ? (updater as (prev: T) => T)(getter()) : updater;
    setter(next);
  };
}
