import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { greenWillKeys } from "../../config/query-keys/greenwill";
import {
  getGreenWillBadgesByOwner,
  getGreenWillBadgeDefinitions,
} from "../../modules/data/greenwill";
import type {
  GreenWillBadgeDefinition,
  GreenWillBadgeOwnership,
  GreenWillBadgeView,
} from "../../types/greenwill";
import { normalizeAddress } from "../../utils/blockchain/address";

interface UseGreenWillBadgesOptions {
  chainId?: number;
  enabled?: boolean;
  /**
   * Badges a sent claim is waiting on, such as a Safe proposal still gathering
   * signatures. Nothing announces when it executes, so ownership is read again
   * every 30 seconds until each of them is owned.
   */
  awaitBadgeIds?: readonly string[];
}

/** How often ownership is read again while a claim awaits execution. */
const AWAITED_CLAIM_REFRESH_MS = 30_000;

export function useGreenWillBadges(owner?: string, options: UseGreenWillBadgesOptions = {}) {
  const chainId = options.chainId ?? DEFAULT_CHAIN_ID;
  const enabled = options.enabled ?? true;
  const normalizedOwner = owner ? normalizeAddress(owner) : "";
  const ownershipEnabled = enabled && normalizedOwner.length > 0;

  const definitionsQuery = useQuery({
    queryKey: greenWillKeys.definitions(chainId),
    queryFn: () => getGreenWillBadgeDefinitions(chainId),
    enabled,
    staleTime: STALE_TIME_MEDIUM,
  });

  const awaitBadgeIds = options.awaitBadgeIds ?? [];
  const ownershipQuery = useQuery({
    queryKey: greenWillKeys.ownership(normalizedOwner, chainId),
    queryFn: () => getGreenWillBadgesByOwner(normalizedOwner, chainId),
    enabled: ownershipEnabled,
    staleTime: STALE_TIME_MEDIUM,
    refetchInterval: (query) => {
      if (awaitBadgeIds.length === 0) return false;
      const owned = new Set(
        ((query.state.data as GreenWillBadgeOwnership[] | undefined) ?? []).map((ownership) =>
          ownership.badgeId.toLowerCase()
        )
      );
      return awaitBadgeIds.some((badgeId) => !owned.has(badgeId.toLowerCase()))
        ? AWAITED_CLAIM_REFRESH_MS
        : false;
    },
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
