import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useEligibleAdminGardens } from "../garden/useEligibleAdminGardens";
import { useAdminStore } from "../../stores/useAdminStore";
import { compareAddresses } from "../../utils/blockchain/address";
import { ADMIN_GARDEN_SHARE_PARAM } from "../../utils/admin-routes";

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
 * Keeps canvas URL params and the admin selected garden aligned.
 *
 * - URL -> store: reads `?gardenAddress=<address>`.
 * - Store -> URL: does not mirror garden selection during normal browsing.
 * - Tab/filter updates use replace to avoid history pollution.
 * - Item open/close uses push so browser back closes the side sheet first.
 */
export function useGardenUrlSync(): GardenUrlSyncResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedGarden = useAdminStore((s) => s.selectedGarden);
  const selectedGardenId = selectedGarden?.id ?? null;
  const setSelectedGarden = useAdminStore((s) => s.setSelectedGarden);
  const setPersistedGardenId = useAdminStore((s) => s.setPersistedGardenId);
  const { eligibleGardens, resolvedDefaultGarden, scopeKey, isLoaded } = useEligibleAdminGardens();

  const requestedGardenAddress = searchParams.get(ADMIN_GARDEN_SHARE_PARAM);
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

  const matchingSelectedGarden =
    selectedGardenId === null
      ? null
      : (eligibleGardens.find((garden) => garden.id === selectedGardenId) ?? null);

  const matchingUrlGarden =
    requestedGardenAddress !== null
      ? (eligibleGardens.find(
          (garden) =>
            compareAddresses(garden.tokenAddress, requestedGardenAddress) ||
            compareAddresses(garden.id, requestedGardenAddress)
        ) ?? null)
      : null;

  // URL -> store sync with default resolution.
  useEffect(() => {
    if (!isLoaded) return;

    const nextGarden = matchingUrlGarden ?? matchingSelectedGarden ?? resolvedDefaultGarden ?? null;
    if (nextGarden?.id !== selectedGardenId) {
      setSelectedGarden(nextGarden);
    }
  }, [
    isLoaded,
    matchingSelectedGarden,
    matchingUrlGarden,
    resolvedDefaultGarden,
    selectedGardenId,
    setSelectedGarden,
  ]);

  useEffect(() => {
    if (!scopeKey) return;
    setPersistedGardenId(scopeKey, selectedGardenId);
  }, [scopeKey, selectedGardenId, setPersistedGardenId]);

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
    gardenId: selectedGardenId ?? matchingUrlGarden?.id ?? null,
    tab,
    item,
    setTab,
    setFilter,
    openItem,
    closeItem,
  };
}
