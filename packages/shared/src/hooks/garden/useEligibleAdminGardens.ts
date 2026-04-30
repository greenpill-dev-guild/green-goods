import { useMemo } from "react";
import { useGardens } from "../blockchain/useBaseLists";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useRole } from "../gardener/useRole";
import { getAdminGardenScopeKey, useAdminStore } from "../../stores/useAdminStore";
import type { Address, Garden } from "../../types/domain";
import { isAddressInList } from "../../utils/blockchain/address";

export interface EligibleAdminGardensResult {
  eligibleGardens: Garden[];
  resolvedDefaultGarden: Garden | null;
  persistedGardenId: string | null;
  scopeKey: string | null;
  canCreateGarden: boolean;
  /**
   * True once the answer is stable: base-list query has fetched AND the
   * role query has resolved (so any stale-base-list cross-check has run).
   * IndexRoute uses this to keep the spinner up rather than racing into the
   * no-access shell.
   */
  isLoaded: boolean;
  /**
   * True if the indexer base-list query errored. `getGardens()` swallows
   * indexer failures and returns []; without this flag, an outage looks
   * identical to a legitimate no-garden state.
   */
  isError: boolean;
  /**
   * True when `useRole` reports operator gardens that the base list does not
   * yet expose (cache lag, indexer drift, or an outage). Consumers can use
   * this to keep the user on the canvas instead of redirecting to no-access.
   */
  hasStaleBaseList: boolean;
}

function compareGardenNames(a: Garden, b: Garden) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/**
 * Project a partial operator-garden hint (from the role indexer query) into a
 * minimal Garden record so the canvas can navigate to the garden even when the
 * full base-list entry is missing. Downstream detail queries fetch full state
 * directly; consumers that read from this object see the user as an operator
 * on the garden, which is the truth that the role query proved.
 */
function stubGardenFromOperatorHint(
  hint: { id: string; name: string },
  chainId: number,
  address: Address
): Garden {
  const id = hint.id as Address;
  return {
    id,
    chainId,
    tokenAddress: id,
    tokenID: 0n,
    name: hint.name || "Garden",
    description: "",
    location: "",
    bannerImage: "",
    gardeners: [],
    operators: [address],
    evaluators: [],
    owners: [],
    funders: [],
    communities: [],
    openJoining: false,
    domainMask: 0,
    assessments: [],
    works: [],
    createdAt: 0,
  };
}

export function useEligibleAdminGardens(): EligibleAdminGardensResult {
  const address = usePrimaryAddress();
  const chainId = useCurrentChain();
  const { data: gardens = [], isFetched, isError } = useGardens();
  const { role, operatorGardens, loading: roleLoading } = useRole();
  const lastGardenIdsByScope = useAdminStore((state) => state.lastGardenIdsByScope);

  const scopeKey = useMemo(() => getAdminGardenScopeKey(address, chainId), [address, chainId]);

  const { eligibleGardens, hasStaleBaseList } = useMemo(() => {
    if (!address) {
      return { eligibleGardens: [] as Garden[], hasStaleBaseList: false };
    }

    const fromBaseList = gardens
      .filter((garden) => {
        return (
          isAddressInList(address, garden.operators) ||
          isAddressInList(address, garden.owners) ||
          isAddressInList(address, garden.evaluators)
        );
      })
      .slice()
      .sort(compareGardenNames);

    if (operatorGardens.length === 0) {
      return { eligibleGardens: fromBaseList, hasStaleBaseList: false };
    }

    // Cross-check: useRole proved the user has these operator gardens via the
    // indexer's address-filtered query. If any of them are missing from the
    // base list, that's cache lag or an outage — surface them anyway via
    // minimal stubs so the operator can still reach the canvas.
    const baseListIds = new Set(fromBaseList.map((g) => g.id.toLowerCase()));
    const missing = operatorGardens.filter((og) => !baseListIds.has(og.id.toLowerCase()));
    if (missing.length === 0) {
      return { eligibleGardens: fromBaseList, hasStaleBaseList: false };
    }

    const stubs = missing.map((og) => stubGardenFromOperatorHint(og, chainId, address as Address));
    const merged = [...fromBaseList, ...stubs].sort(compareGardenNames);
    return { eligibleGardens: merged, hasStaleBaseList: true };
  }, [address, gardens, operatorGardens, chainId]);

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
    // The /garden/create route is RequireRole(["deployer"]); operators clicking
    // a Create CTA would land on the unauthorized page. Match the gate exactly.
    canCreateGarden: role === "deployer",
    isLoaded: isFetched && !roleLoading,
    isError,
    hasStaleBaseList,
  };
}
