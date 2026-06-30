import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useEligibleAdminGardens } from "../garden/useEligibleAdminGardens";
import { useAdminStore, type Garden } from "../../stores/useAdminStore";
import { compareAddresses } from "../../utils/blockchain/address";
import { ADMIN_GARDEN_SHARE_PARAM } from "../../utils/navigation/admin-routes";

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
 * Keeps canvas URL params and the admin selected garden aligned.
 *
 * - URL -> store: reads `?gardenAddress=<address>`.
 * - Store -> URL: does not mirror garden selection during normal browsing.
 * - Tab/filter updates use replace to avoid history pollution.
 * - Non-Hub item open/close uses push so browser back clears focused query state first.
 */
export function useGardenUrlSync(): GardenUrlSyncResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedGarden = useAdminStore((s) => s.selectedGarden);
  const selectedGardenId = selectedGarden?.id ?? null;
  const setSelectedGarden = useAdminStore((s) => s.setSelectedGarden);
  const setPersistedGardenId = useAdminStore((s) => s.setPersistedGardenId);
  const { eligibleGardens, resolvedDefaultGarden, scopeKey, isLoaded } = useEligibleAdminGardens();
  const pendingGardenAddressRef = useRef<string | null | undefined>(undefined);

  const requestedGardenAddress = searchParams.get(ADMIN_GARDEN_SHARE_PARAM);
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

  const matchingSelectedGarden =
    selectedGardenId === null
      ? null
      : (eligibleGardens.find((garden) => compareAddresses(garden.id, selectedGardenId)) ?? null);

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

    const pendingGardenAddress = pendingGardenAddressRef.current;
    if (pendingGardenAddress !== undefined) {
      const urlMatchesPending =
        pendingGardenAddress === null
          ? requestedGardenAddress === null
          : compareAddresses(requestedGardenAddress, pendingGardenAddress);

      if (!urlMatchesPending) return;
      pendingGardenAddressRef.current = undefined;
    }

    const nextGarden = matchingUrlGarden ?? matchingSelectedGarden ?? resolvedDefaultGarden ?? null;
    if (nextGarden?.id !== selectedGardenId) {
      setSelectedGarden(nextGarden);
    }
  }, [
    isLoaded,
    matchingSelectedGarden,
    matchingUrlGarden,
    requestedGardenAddress,
    resolvedDefaultGarden,
    selectedGardenId,
    setSelectedGarden,
  ]);

  useEffect(() => {
    if (!scopeKey) return;
    setPersistedGardenId(scopeKey, selectedGardenId);
  }, [scopeKey, selectedGardenId, setPersistedGardenId]);

  const setGarden = useCallback(
    (garden: Garden | null) => {
      const nextGardenAddress = garden ? (garden.tokenAddress ?? garden.id) : null;
      pendingGardenAddressRef.current = nextGardenAddress;
      updateParams({ [ADMIN_GARDEN_SHARE_PARAM]: nextGardenAddress }, REPLACE_URL_PARAMS_OPTIONS);
      setSelectedGarden(garden);
    },
    [setSelectedGarden, updateParams]
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
    gardenId: selectedGardenId ?? matchingUrlGarden?.id ?? null,
    tab,
    item,
    setGarden,
    setTab,
    setFilter,
    openItem,
    closeItem,
  };
}
