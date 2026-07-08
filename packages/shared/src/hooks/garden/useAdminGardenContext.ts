import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAdminStore } from "../../stores/useAdminStore";
import type { Garden } from "../../types/domain";
import {
  ADMIN_GARDEN_ID_PARAM,
  ADMIN_GARDEN_LEGACY_SHARE_PARAM,
} from "../../utils/navigation/admin-routes";
import { compareAddresses } from "../../utils/blockchain/address";
import { useEligibleAdminGardens } from "./useEligibleAdminGardens";

export type AdminGardenContextStatus = "loading" | "ready" | "not-found" | "no-gardens" | "error";

export interface AdminGardenNavigationOptions {
  replace?: boolean;
  preventScrollReset?: boolean;
}

export interface AdminGardenContextResult {
  activeGarden: Garden | null;
  activeGardenId: string | null;
  requestedGardenId: string | null;
  eligibleGardens: Garden[];
  isLoaded: boolean;
  isError: boolean;
  hasExplicitGarden: boolean;
  status: AdminGardenContextStatus;
  selectGarden: (garden: Pick<Garden, "id">, options?: AdminGardenNavigationOptions) => void;
  clearGarden: (options?: AdminGardenNavigationOptions) => void;
}

function findGardenById(gardens: Garden[], gardenId: string | null): Garden | null {
  if (!gardenId) return null;
  return gardens.find((garden) => compareAddresses(garden.id, gardenId)) ?? null;
}

function findGardenByLegacyIdentity(gardens: Garden[], identity: string | null): Garden | null {
  if (!identity) return null;
  return (
    gardens.find(
      (garden) =>
        compareAddresses(garden.id, identity) || compareAddresses(garden.tokenAddress, identity)
    ) ?? null
  );
}

export function useAdminGardenContext(): AdminGardenContextResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const setPersistedGardenId = useAdminStore((state) => state.setPersistedGardenId);
  const { eligibleGardens, resolvedDefaultGarden, scopeKey, isLoaded, isError } =
    useEligibleAdminGardens();

  const routeGardenId = searchParams.get(ADMIN_GARDEN_ID_PARAM);
  const legacyGardenIdentity = searchParams.get(ADMIN_GARDEN_LEGACY_SHARE_PARAM);
  const hasExplicitGarden = routeGardenId !== null || legacyGardenIdentity !== null;
  const requestedGardenId = routeGardenId ?? legacyGardenIdentity;

  const routeGarden = useMemo(() => {
    if (routeGardenId) return findGardenById(eligibleGardens, routeGardenId);
    return findGardenByLegacyIdentity(eligibleGardens, legacyGardenIdentity);
  }, [eligibleGardens, legacyGardenIdentity, routeGardenId]);

  const activeGarden = routeGarden ?? (hasExplicitGarden ? null : resolvedDefaultGarden);
  const activeGardenId = activeGarden?.id ?? null;

  const status = useMemo<AdminGardenContextStatus>(() => {
    if (!isLoaded) return "loading";
    if (isError) return "error";
    if (eligibleGardens.length === 0) return "no-gardens";
    if (activeGarden) return "ready";
    return "not-found";
  }, [activeGarden, eligibleGardens.length, isError, isLoaded]);

  const writeGardenIdToUrl = useCallback(
    (gardenId: string | null, options: AdminGardenNavigationOptions = {}) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.delete(ADMIN_GARDEN_LEGACY_SHARE_PARAM);
          if (gardenId) {
            next.set(ADMIN_GARDEN_ID_PARAM, gardenId);
          } else {
            next.delete(ADMIN_GARDEN_ID_PARAM);
          }
          return next;
        },
        {
          replace: options.replace ?? false,
          preventScrollReset: options.preventScrollReset ?? true,
        }
      );
    },
    [setSearchParams]
  );

  useEffect(() => {
    if (!isLoaded || !activeGardenId) return;

    const hasCanonicalGardenId =
      routeGardenId !== null && compareAddresses(routeGardenId, activeGardenId);
    const needsLegacyCleanup = legacyGardenIdentity !== null;
    if (hasCanonicalGardenId && !needsLegacyCleanup) return;

    writeGardenIdToUrl(activeGardenId, { replace: true });
  }, [activeGardenId, isLoaded, legacyGardenIdentity, routeGardenId, writeGardenIdToUrl]);

  useEffect(() => {
    if (!scopeKey || !activeGardenId) return;
    setPersistedGardenId(scopeKey, activeGardenId);
  }, [activeGardenId, scopeKey, setPersistedGardenId]);

  const selectGarden = useCallback(
    (garden: Pick<Garden, "id">, options?: AdminGardenNavigationOptions) => {
      writeGardenIdToUrl(garden.id, { replace: false, ...options });
    },
    [writeGardenIdToUrl]
  );

  const clearGarden = useCallback(
    (options?: AdminGardenNavigationOptions) => {
      writeGardenIdToUrl(null, { replace: false, ...options });
    },
    [writeGardenIdToUrl]
  );

  return {
    activeGarden,
    activeGardenId,
    requestedGardenId,
    eligibleGardens,
    isLoaded,
    isError,
    hasExplicitGarden,
    status,
    selectGarden,
    clearGarden,
  };
}
