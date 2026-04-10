import { useMemo } from "react";
import { useGardens } from "../blockchain/useBaseLists";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useRole } from "../gardener/useRole";
import { getAdminGardenScopeKey, useAdminStore } from "../../stores/useAdminStore";
import type { Garden } from "../../types/domain";
import { isAddressInList } from "../../utils/blockchain/address";

export interface EligibleAdminGardensResult {
  eligibleGardens: Garden[];
  resolvedDefaultGarden: Garden | null;
  persistedGardenId: string | null;
  scopeKey: string | null;
  canCreateGarden: boolean;
  isLoaded: boolean;
}

function compareGardenNames(a: Garden, b: Garden) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function useEligibleAdminGardens(): EligibleAdminGardensResult {
  const address = usePrimaryAddress();
  const chainId = useCurrentChain();
  const { data: gardens = [], isFetched } = useGardens();
  const { role } = useRole();
  const lastGardenIdsByScope = useAdminStore((state) => state.lastGardenIdsByScope);

  const scopeKey = useMemo(() => getAdminGardenScopeKey(address, chainId), [address, chainId]);

  const eligibleGardens = useMemo(() => {
    if (!address) return [];

    return gardens
      .filter((garden) => {
        return (
          isAddressInList(address, garden.operators) ||
          isAddressInList(address, garden.owners) ||
          isAddressInList(address, garden.evaluators)
        );
      })
      .slice()
      .sort(compareGardenNames);
  }, [address, gardens]);

  const persistedGardenId = scopeKey ? (lastGardenIdsByScope[scopeKey] ?? null) : null;

  const resolvedDefaultGarden = useMemo(() => {
    if (eligibleGardens.length === 0) return null;

    const persistedGarden =
      (persistedGardenId
        ? (eligibleGardens.find((garden) => garden.id === persistedGardenId) ?? null)
        : null) ?? null;

    return persistedGarden ?? eligibleGardens[0] ?? null;
  }, [eligibleGardens, persistedGardenId]);

  return {
    eligibleGardens,
    resolvedDefaultGarden,
    persistedGardenId,
    scopeKey,
    canCreateGarden: role === "operator" || role === "deployer",
    isLoaded: isFetched,
  };
}
