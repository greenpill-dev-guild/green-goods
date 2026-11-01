import { useCallback, useEffect, useRef } from "react";
import { useNavigate, useNavigationType, useSearchParams } from "react-router-dom";

export interface CanvasSearchParamsResult {
  searchParams: URLSearchParams;
  updateSearch: (updates: Record<string, string | undefined>, replace?: boolean) => void;
}

/**
 * Shared URL search-param updater for admin canvas views.
 *
 * Provides a stable `updateSearch` callback that merges partial updates
 * into the current search params. Deletes keys whose value is `undefined`.
 * Defaults to `replace: true` to avoid history pollution from filter changes.
 */
export function useCanvasSearchParams(): CanvasSearchParamsResult {
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

/**
 * Closes a dialog that a route item opened, leaving the tab underneath alone
 * (DL-140). After a press it goes back over the entry the press pushed, so
 * browser Back stays live. A direct link or a reload has no press beneath it, so
 * it drops the item in place. Once the item has left the URL there is nothing to
 * close. The check lives in a ref because a send's success closes the dialog with
 * a callback from the moment it was sent.
 */
export function useRouteItemClose(itemInUrl: boolean): () => void {
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const { updateSearch } = useCanvasSearchParams();
  const entry = useRef<"none" | "pushed" | "direct">("none");
  useEffect(() => {
    entry.current = !itemInUrl ? "none" : navigationType === "PUSH" ? "pushed" : "direct";
  }, [itemInUrl, navigationType]);

  return useCallback(() => {
    if (entry.current === "pushed") navigate(-1);
    else if (entry.current === "direct") updateSearch({ item: undefined });
  }, [navigate, updateSearch]);
}
