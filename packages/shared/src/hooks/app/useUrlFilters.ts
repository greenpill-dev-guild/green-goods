import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Manages filter state in URL search params so it survives navigation.
 * Drop-in replacement for useState-based filter patterns in list views.
 *
 * IMPORTANT: The `defaults` and `parsers` arguments MUST be stable references
 * (defined outside the component as module-level constants, or wrapped in useMemo)
 * to avoid infinite re-renders. Do NOT pass inline object literals.
 *
 * @example
 * ```tsx
 * // Module-level constant -- stable reference
 * const DEFAULTS = { scope: "all", sort: "default" } as const;
 *
 * function GardensView() {
 *   const { filters, setFilter, resetFilters } = useUrlFilters(DEFAULTS);
 *   // filters.scope, filters.sort read from URL (or defaults)
 *   // setFilter("scope", "mine") writes to URL
 *   // resetFilters() clears all filter params from URL
 * }
 * ```
 */
export function useUrlFilters<T extends Record<string, string | undefined>>(
  defaults: T,
  parsers?: Partial<Record<keyof T, (raw: string) => string | undefined>>
): {
  filters: T;
  setFilter: (key: keyof T, value: string | undefined) => void;
  resetFilters: () => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults) as Array<keyof T>) {
      const raw = searchParams.get(key as string);
      if (raw !== null) {
        const parser = parsers?.[key];
        const parsed = parser ? parser(raw) : raw;
        if (parsed !== undefined) {
          (result as Record<string, string | undefined>)[key as string] = parsed;
        }
      }
    }
    return result;
  }, [searchParams, defaults, parsers]);

  const setFilter = useCallback(
    (key: keyof T, value: string | undefined) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === undefined || value === "" || value === defaults[key]) {
            next.delete(key as string);
          } else {
            next.set(key as string, value);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams, defaults]
  );

  const resetFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const key of Object.keys(defaults)) {
          next.delete(key);
        }
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams, defaults]);

  return { filters, setFilter, resetFilters };
}
