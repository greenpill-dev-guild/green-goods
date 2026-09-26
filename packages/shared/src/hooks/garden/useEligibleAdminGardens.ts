import { useMemo } from "react";
import { getNetworkConfig } from "../../config/blockchain";
import { useGardens } from "../blockchain/useBaseLists";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useRole } from "../gardener/useRole";
import { getAdminGardenScopeKey, useAdminStore } from "../../stores/useAdminStore";
import type { Address, Garden } from "../../types/domain";
import { compareAddresses, isAddressInList, isZeroAddress } from "../../utils/blockchain/address";
import { useGardenRecord } from "./useGardenRecord";

export interface EligibleAdminGardensResult {
  eligibleGardens: Garden[];
  resolvedDefaultGarden: Garden | null;
  persistedGardenId: string | null;
  scopeKey: string | null;
  canCreateGarden: boolean;
  /**
   * True once the answer is stable: base-list query has fetched AND the
   * role query has resolved (so any stale-base-list cross-check has run) AND,
   * for a deployer whose list lacks the protocol garden, its own record's first
   * read has settled. IndexRoute uses this to keep the spinner up rather than
   * racing into the no-access shell.
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
   * True when `useRole` reports steward gardens that the base list does not
   * yet expose (cache lag, indexer drift, or an outage). Consumers can use
   * this to keep the user on the canvas instead of redirecting to no-access.
   */
  hasStaleBaseList: boolean;
}

function compareGardenNames(a: Garden, b: Garden) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/**
 * Project a partial steward-garden hint (from the role indexer query) into a
 * minimal Garden record so the canvas can navigate to the garden even when the
 * full base-list entry is missing. Downstream detail queries fetch full state
 * directly; consumers that read from this object see the user as a steward
 * on the garden, which is the truth that the role query proved.
 */
function stubGardenFromStewardHint(
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
    stewards: [address],
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
  const configuredRoot = getNetworkConfig(chainId).rootGarden?.address;
  // The local chain configures a zero-address root garden: there is none to find.
  const rootGardenAddress =
    configuredRoot && !isZeroAddress(configuredRoot) ? configuredRoot : null;

  // The base list holds a chain's newest 50 gardens and the protocol garden is
  // a chain's first, so past 50 a deployer's protocol garden is read by id
  // (PRD-988). Only a fetched, non-empty list can be missing it: an empty or
  // failed list is an outage, and must stay one, never a garden that cannot load.
  const needsProtocolGarden =
    role === "deployer" &&
    rootGardenAddress !== null &&
    isFetched &&
    !baseListError &&
    gardens.length > 0 &&
    !gardens.some((garden) => compareAddresses(garden.id, rootGardenAddress));
  const protocolGardenRecord = useGardenRecord(rootGardenAddress, {
    enabled: needsProtocolGarden,
  });
  const protocolGarden = needsProtocolGarden ? (protocolGardenRecord.data ?? null) : null;

  const { eligibleGardens, hasStaleBaseList } = useMemo(() => {
    if (!address) {
      return { eligibleGardens: [] as Garden[], hasStaleBaseList: false };
    }

    // The protocol garden's own record joins the list only once it has loaded.
    const listed = protocolGarden ? [...gardens, protocolGarden] : gardens;
    const fromBaseList = listed
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

    if (stewardGardens.length === 0) {
      return { eligibleGardens: fromBaseList, hasStaleBaseList: false };
    }

    // Cross-check: useRole proved the user has these steward gardens via the
    // indexer's address-filtered query. If any of them are missing from the
    // base list, that's cache lag or an outage — surface them anyway via
    // minimal stubs so the steward can still reach the canvas.
    const baseListIds = new Set(fromBaseList.map((g) => g.id.toLowerCase()));
    const missing = stewardGardens.filter((og) => !baseListIds.has(og.id.toLowerCase()));
    if (missing.length === 0) {
      return { eligibleGardens: fromBaseList, hasStaleBaseList: false };
    }

    const stubs = missing.map((og) => stubGardenFromStewardHint(og, chainId, address as Address));
    const merged = [...fromBaseList, ...stubs].sort(compareGardenNames);
    return { eligibleGardens: merged, hasStaleBaseList: true };
  }, [address, gardens, protocolGarden, stewardGardens, chainId, role, rootGardenAddress]);

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
    // Only the record's first read holds the answer back. A failed read's retry
    // must not: the content a settled answer mounts reads the record again, and
    // unsettling the answer would unmount it and start the loop over.
    isLoaded:
      isFetched && !roleLoading && !(needsProtocolGarden && !protocolGardenRecord.isFetched),
    // A base-list outage is always retryable. A role-gardens outage is
    // retryable for normal stewards, but should not block the deployer-only
    // create-garden path when no garden exists yet.
    isError: baseListError || (roleGardensError && role !== "deployer"),
    hasStaleBaseList,
  };
}
