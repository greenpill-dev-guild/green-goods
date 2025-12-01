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

/**
 * Create multiple dispatch adapters from a Zustand store slice.
 *
 * @param store - Object with getter properties and setter methods
 * @param keys - Array of property names to create adapters for
 * @returns Object with dispatch adapters for each key
 *
 * @example
 * const dispatchers = createDispatchAdapters(
 *   {
 *     actionUID: useStore((s) => s.actionUID),
 *     setActionUID: useStore((s) => s.setActionUID),
 *     gardenAddress: useStore((s) => s.gardenAddress),
 *     setGardenAddress: useStore((s) => s.setGardenAddress),
 *   },
 *   ['actionUID', 'gardenAddress']
 * );
 *
 * // Returns { setActionUID: Dispatch, setGardenAddress: Dispatch }
 */
export function createDispatchAdapters<T extends Record<string, unknown>, K extends string>(
  store: T,
  keys: K[]
): { [P in K as `set${Capitalize<P>}`]: React.Dispatch<React.SetStateAction<T[P]>> } {
  const result: Record<string, unknown> = {};

  for (const key of keys) {
    const setterKey = `set${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof T;
    const getter = () => store[key as keyof T];
    const setter = store[setterKey] as (value: unknown) => void;

    if (typeof setter === "function") {
      result[setterKey as string] = createDispatchAdapter(getter, setter);
    }
  }

  return result as {
    [P in K as `set${Capitalize<P>}`]: React.Dispatch<React.SetStateAction<T[P]>>;
  };
}
