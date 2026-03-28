import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useGardens } from "../blockchain/useBaseLists";
import { useAdminStore } from "../../stores/useAdminStore";

type UrlParamValue = string | null | undefined;

export interface GardenUrlSyncResult {
  gardenId: string | null;
  tab: string | null;
  item: string | null;
  setTab: (tab: UrlParamValue) => void;
  setFilter: (key: string, value: UrlParamValue) => void;
  openItem: (itemId: string) => void;
  closeItem: () => void;
}

/**
 * Keeps cockpit URL params and admin selected garden in sync.
 *
 * - URL -> store: reads `?garden=<id>` and updates selectedGarden.
 * - Store -> URL: writes selectedGarden changes back to `?garden=`.
 * - Tab/filter updates use replace to avoid history pollution.
 * - Item open/close uses push so browser back closes the side sheet first.
 */
export function useGardenUrlSync(): GardenUrlSyncResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedGardenId = useAdminStore((s) => s.selectedGarden?.id ?? null);
  const setSelectedGarden = useAdminStore((s) => s.setSelectedGarden);
  const { data: gardens, isFetched: hasFetchedGardens } = useGardens();

  const gardenId = searchParams.get("garden");
  const tab = searchParams.get("tab");
  const item = searchParams.get("item");

  const updateParams = useCallback(
    (updates: Record<string, UrlParamValue>, replace: boolean) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(updates)) {
            if (value === undefined || value === null || value === "") {
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

  // URL -> store sync (including initial mount once gardens are available)
  useEffect(() => {
    if (gardenId === null) {
      if (selectedGardenId !== null) {
        setSelectedGarden(null);
      }
      return;
    }

    if (!hasFetchedGardens) return;

    const matchedGarden = (gardens ?? []).find((garden) => garden.id === gardenId) ?? null;
    const matchedGardenId = matchedGarden?.id ?? null;

    if (matchedGardenId !== selectedGardenId) {
      setSelectedGarden(matchedGarden);
    }
  }, [gardenId, gardens, hasFetchedGardens, selectedGardenId, setSelectedGarden]);

  // Store -> URL sync
  useEffect(() => {
    // Avoid dropping an existing URL garden param before base gardens are fetched.
    if (gardenId !== null && selectedGardenId === null && !hasFetchedGardens) return;
    if (gardenId === selectedGardenId) return;

    updateParams({ garden: selectedGardenId }, true);
  }, [gardenId, hasFetchedGardens, selectedGardenId, updateParams]);

  const setTab = useCallback(
    (nextTab: UrlParamValue) => {
      updateParams({ tab: nextTab }, true);
    },
    [updateParams]
  );

  const setFilter = useCallback(
    (key: string, value: UrlParamValue) => {
      updateParams({ [key]: value }, true);
    },
    [updateParams]
  );

  const openItem = useCallback(
    (itemId: string) => {
      updateParams({ item: itemId }, false);
    },
    [updateParams]
  );

  const closeItem = useCallback(() => {
    updateParams({ item: undefined }, false);
  }, [updateParams]);

  return {
    gardenId,
    tab,
    item,
    setTab,
    setFilter,
    openItem,
    closeItem,
  };
}
