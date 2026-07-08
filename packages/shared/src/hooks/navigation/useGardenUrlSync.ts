import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import type { Garden } from "../../stores/useAdminStore";
import { useAdminGardenContext } from "../garden/useAdminGardenContext";

type UrlParamValue = string | null | undefined;

interface UpdateParamsOptions {
  replace: boolean;
  preventScrollReset?: boolean;
}

const REPLACE_URL_PARAMS_OPTIONS = { replace: true } satisfies UpdateParamsOptions;
const ROUTE_BACKED_ITEM_URL_OPTIONS = {
  replace: false,
  preventScrollReset: true,
} satisfies UpdateParamsOptions;

export interface GardenUrlSyncResult {
  gardenId: string | null;
  tab: string | null;
  item: string | null;
  setGarden: (garden: Garden | null) => void;
  setTab: (tab: UrlParamValue) => void;
  setFilter: (key: string, value: UrlParamValue) => void;
  openItem: (itemId: string) => void;
  closeItem: () => void;
}

/**
 * Shared admin canvas URL adapter.
 *
 * - Active garden identity is route-owned by `useAdminGardenContext`.
 * - Tab/filter updates use replace to avoid history pollution.
 * - Non-Hub item open/close uses push so browser back clears focused query state first.
 */
export function useGardenUrlSync(): GardenUrlSyncResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeGardenId, selectGarden, clearGarden } = useAdminGardenContext();

  const tab = searchParams.get("tab");
  const item = searchParams.get("item");

  const updateParams = useCallback(
    (updates: Record<string, UrlParamValue>, options: UpdateParamsOptions) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          if (value === undefined || value === null || value === "") {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        }
        return next;
      }, options);
    },
    [setSearchParams]
  );

  const setGarden = useCallback(
    (garden: Garden | null) => {
      if (garden) {
        selectGarden(garden);
        return;
      }
      clearGarden();
    },
    [clearGarden, selectGarden]
  );

  const setTab = useCallback(
    (nextTab: UrlParamValue) => {
      updateParams({ tab: nextTab }, REPLACE_URL_PARAMS_OPTIONS);
    },
    [updateParams]
  );

  const setFilter = useCallback(
    (key: string, value: UrlParamValue) => {
      updateParams({ [key]: value }, REPLACE_URL_PARAMS_OPTIONS);
    },
    [updateParams]
  );

  const openItem = useCallback(
    (itemId: string) => {
      updateParams({ item: itemId }, ROUTE_BACKED_ITEM_URL_OPTIONS);
    },
    [updateParams]
  );

  const closeItem = useCallback(() => {
    updateParams({ item: undefined }, ROUTE_BACKED_ITEM_URL_OPTIONS);
  }, [updateParams]);

  return {
    gardenId: activeGardenId,
    tab,
    item,
    setGarden,
    setTab,
    setFilter,
    openItem,
    closeItem,
  };
}
