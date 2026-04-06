import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export interface CockpitSearchParamsResult {
  searchParams: URLSearchParams;
  updateSearch: (updates: Record<string, string | undefined>, replace?: boolean) => void;
}

/**
 * Shared URL search-param updater for cockpit views.
 *
 * Provides a stable `updateSearch` callback that merges partial updates
 * into the current search params. Deletes keys whose value is `undefined`.
 * Defaults to `replace: true` to avoid history pollution from filter changes.
 */
export function useCockpitSearchParams(): CockpitSearchParamsResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const updateSearch = useCallback(
    (updates: Record<string, string | undefined>, replace = true) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(updates)) {
            if (!value) {
              next.delete(key);
            } else {
              next.set(key, value);
            }
          }
          return next;
        },
        { replace }
      );
    },
    [setSearchParams]
  );

  return { searchParams, updateSearch };
}
