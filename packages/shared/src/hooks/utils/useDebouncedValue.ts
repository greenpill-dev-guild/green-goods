/**
 * Debounced Value Hook
 *
 * Returns a debounced version of a value that only updates after
 * the specified delay has elapsed since the last change.
 * Uses useTimeout internally for automatic cleanup on unmount.
 *
 * @module hooks/utils/useDebouncedValue
 */

import { useEffect, useState } from "react";
import { useTimeout } from "./useTimeout";

/**
 * Hook that returns a debounced version of the provided value.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300)
 * @returns The debounced value
 *
 * @example
 * ```tsx
 * const [input, setInput] = useState("");
 * const debouncedInput = useDebouncedValue(input, 300);
 *
 * // debouncedInput only updates 300ms after the last setInput call
 * useVaultPreview({ amount: parseUnits(debouncedInput, 18) });
 * ```
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  const { set, clear } = useTimeout();

  useEffect(() => {
    set(() => setDebounced(value), delay);
    return clear;
  }, [value, delay, set, clear]);

  return debounced;
}
