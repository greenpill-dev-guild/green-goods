import { useMemo } from "react";
import { getNetworkConfig } from "../../config/blockchain";
import { useGardens } from "../blockchain/useBaseLists";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useRole } from "../gardener/useRole";
import { getAdminGardenScopeKey, useAdminStore } from "../../stores/useAdminStore";
import type { Address, Garden } from "../../types/domain";
import { compareAddresses, isAddressInList } from "../../utils/blockchain/address";

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
   * True if the indexer errored for EITHER the base garden list or the
   * address-filtered steward-gardens query (`useRole`). Both swallow the
   * failure into []; without this flag an outage is indistinguishable from a
   * legitimate no-garden state, so the admin would show "no access" instead of
   * a retry.
   */
  isError: boolean;
  /**
   * True when an eligible garden is missing from the base list and was
   * recovered as a stub: a steward garden `useRole` proved (cache lag, indexer
   * drift, or an outage), or a deployer's protocol garden past the list's
   * newest 50. Consumers can use this to keep the user on the canvas instead
   * of redirecting to no-access.
   */
  hasStaleBaseList: boolean;
}

function compareGardenNames(a: Garden, b: Garden) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/**
 * Project a garden the base list is missing into a minimal Garden record so
 * the canvas can navigate to it. Downstream detail queries fetch full state
 * directly. The record lists the user as a steward only when the role query
 * proved it.
 */
function stubGarden(
  hint: { id: string; name: string },
  chainId: number,
  stewards: Address[]
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
    stewards,
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
  const { data: gardens = [], isFetched, isError: baseListError } = useGardens();
  const { role, stewardGardens, loading: roleLoading, gardensError: roleGardensError } = useRole();
  const lastGardenIdsByScope = useAdminStore((state) => state.lastGardenIdsByScope);

  const scopeKey = useMemo(() => getAdminGardenScopeKey(address, chainId), [address, chainId]);
  const rootGardenAddress = getNetworkConfig(chainId).rootGarden?.address ?? null;

  const { eligibleGardens, hasStaleBaseList } = useMemo(() => {
    if (!address) {
      return { eligibleGardens: [] as Garden[], hasStaleBaseList: false };
    }

    const fromBaseList = gardens
      .filter((garden) => {
        return (
          isAddressInList(address, garden.stewards) ||
          isAddressInList(address, garden.owners) ||
          isAddressInList(address, garden.evaluators) ||
          // Deployers run the protocol garden's campaign cookie jars (DL-046)
          // whether or not they hold a role in it; its writes stay gated by
          // garden permissions.
          (role === "deployer" &&
            rootGardenAddress !== null &&
            compareAddresses(garden.id, rootGardenAddress))
        );
      })
      .slice()
      .sort(compareGardenNames);

    // Surface eligible gardens the base list is missing as minimal stubs so the
    // user can still reach the canvas: steward gardens useRole proved through
    // the indexer's address-filtered query (cache lag or an outage), and a
    // deployer's protocol garden, which is a chain's first garden and so falls
    // outside the base list's newest 50 once a chain has more.
    const listedIds = new Set(fromBaseList.map((g) => g.id.toLowerCase()));
    const stubs: Garden[] = [];
    const addStub = (hint: { id: string; name: string }, stewards: Address[]) => {
      if (listedIds.has(hint.id.toLowerCase())) return;
      listedIds.add(hint.id.toLowerCase());
      stubs.push(stubGarden(hint, chainId, stewards));
    };
    for (const hint of stewardGardens) addStub(hint, [address as Address]);
    if (role === "deployer" && rootGardenAddress !== null) {
      addStub({ id: rootGardenAddress, name: "" }, []);
    }
    if (stubs.length === 0) {
      return { eligibleGardens: fromBaseList, hasStaleBaseList: false };
    }

    const merged = [...fromBaseList, ...stubs].sort(compareGardenNames);
    return { eligibleGardens: merged, hasStaleBaseList: true };
  }, [address, gardens, stewardGardens, chainId, role, rootGardenAddress]);

  const persistedGardenId = scopeKey ? lastGardenIdsByScope[scopeKey] : null;

  const resolvedDefaultGarden = useMemo(() => {
    if (eligibleGardens.length === 0) return null;

    const persistedGarden = persistedGardenId
      ? (eligibleGardens.find((garden) => compareAddresses(garden.id, persistedGardenId)) ?? null)
      : null;

    return persistedGarden ?? eligibleGardens[0] ?? null;
  }, [eligibleGardens, persistedGardenId]);

  return {
    eligibleGardens,
    resolvedDefaultGarden,
    persistedGardenId,
    scopeKey,
    // The /garden/create route is RequireRole(["deployer"]); stewards clicking
    // a Create CTA would land on the unauthorized page. Match the gate exactly.
    canCreateGarden: role === "deployer",
    isLoaded: isFetched && !roleLoading,
    // A base-list outage is always retryable. A role-gardens outage is
    // retryable for normal stewards, but should not block the deployer-only
    // create-garden path when no garden exists yet.
    isError: baseListError || (roleGardensError && role !== "deployer"),
    hasStaleBaseList,
  };
}
