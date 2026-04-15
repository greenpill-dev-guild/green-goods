import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { queryKeys, STALE_TIME_MEDIUM } from "../../config/query-keys";
import { getGreenWillBadgesByOwner, getGreenWillBadgeDefinitions } from "../../modules/data/greenwill";
import type {
  GreenWillBadgeDefinition,
  GreenWillBadgeOwnership,
  GreenWillBadgeView,
} from "../../types/greenwill";
import { normalizeAddress } from "../../utils/blockchain/address";

interface UseGreenWillBadgesOptions {
  chainId?: number;
  enabled?: boolean;
}

export function useGreenWillBadges(owner?: string, options: UseGreenWillBadgesOptions = {}) {
  const chainId = options.chainId ?? DEFAULT_CHAIN_ID;
  const enabled = options.enabled ?? true;
  const normalizedOwner = owner ? normalizeAddress(owner) : "";
  const ownershipEnabled = enabled && normalizedOwner.length > 0;

  const definitionsQuery = useQuery({
    queryKey: queryKeys.greenWill.definitions(chainId),
    queryFn: () => getGreenWillBadgeDefinitions(chainId),
    enabled,
    staleTime: STALE_TIME_MEDIUM,
  });

  const ownershipQuery = useQuery({
    queryKey: queryKeys.greenWill.ownership(normalizedOwner, chainId),
    queryFn: () => getGreenWillBadgesByOwner(normalizedOwner, chainId),
    enabled: ownershipEnabled,
    staleTime: STALE_TIME_MEDIUM,
  });

  const badgeDefinitions = definitionsQuery.data as GreenWillBadgeDefinition[] | undefined;
  const ownerships = ownershipQuery.data as GreenWillBadgeOwnership[] | undefined;

  const badges = useMemo<GreenWillBadgeView[]>(() => {
    const definitionList = badgeDefinitions ?? [];
    const ownershipList = ownerships ?? [];
    const ownershipByBadgeId = new Map(
      ownershipList.map((ownership) => [ownership.badgeId.toLowerCase(), ownership])
    );

    return definitionList.map((definition) => {
      const ownership = ownershipByBadgeId.get(definition.badgeId.toLowerCase()) ?? null;
      const owned = ownership !== null;

      return {
        ...definition,
        owned,
        claimableNow: definition.active && definition.claimable && !owned,
        ownership,
      };
    });
  }, [badgeDefinitions, ownerships]);

  return {
    badgeDefinitions: badgeDefinitions ?? [],
    ownerships: ownerships ?? [],
    badges,
    earnedBadges: badges.filter((badge) => badge.owned),
    claimableBadges: badges.filter((badge) => badge.claimableNow),
    isError: definitionsQuery.isError || ownershipQuery.isError,
    isPending: definitionsQuery.isPending || (ownershipEnabled && ownershipQuery.isPending),
    isLoading: definitionsQuery.isLoading || (ownershipEnabled && ownershipQuery.isLoading),
    isSuccess: definitionsQuery.isSuccess && (!ownershipEnabled || ownershipQuery.isSuccess),
    error: definitionsQuery.error ?? ownershipQuery.error ?? null,
    refetch: async () =>
      Promise.all([
        definitionsQuery.refetch(),
        ownershipEnabled ? ownershipQuery.refetch() : Promise.resolve(undefined),
      ]),
  };
}
