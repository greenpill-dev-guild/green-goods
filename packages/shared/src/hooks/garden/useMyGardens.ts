import { useQueries } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { listMyGardens, type MyGarden } from "../../modules/garden/membership";
import {
  addPendingJoin,
  forgetListedPendingJoins,
  isOwnJoinEntry,
  pendingJoinGardenIds,
} from "../../modules/garden/pending-joins";
import {
  awaitingJoinRequestScope,
  useAwaitingJoinRequestsStore,
} from "../../stores/useAwaitingJoinRequestsStore";
import type { Address, Garden } from "../../types/domain";
import { useGardens } from "../blockchain/useBaseLists";
import { hasRoleQuery } from "../roles/useHasRole";
import { usePendingJoinsVersion } from "./useJoinGarden";

export interface MyGardens {
  /** The account's gardens in the list's order (newest first), each with its roles. */
  gardens: MyGarden<Garden>[];
  /** This chain's list has been read or restored, so `gardens` is an answer, even when empty. */
  isLoaded: boolean;
  /** The latest read failed. With `isLoaded`, `gardens` comes from the last good list. */
  isError: boolean;
  /** `gardens` comes from a list past its freshness or kept after a failed refresh. */
  isStale: boolean;
  /** The gardens list is being read, the first time or again. */
  isFetching: boolean;
  /** Read the gardens list again, after a failure. */
  refetch: () => void;
}

const NO_GARDENS: MyGarden<Garden>[] = [];
const NO_REQUESTED: Garden[] = [];

/**
 * The account's gardens: every garden in the chain's list whose record lists the account as
 * owner, steward, evaluator or gardener, plus a join this device holds that the record does not
 * show yet: an open join it sent, or its request a steward welcomed (`modules/garden/membership`).
 * Unknown, failed and empty stay apart, and another chain's list, kept on screen while this
 * chain's loads, is never read as an answer.
 */
export function useMyGardens(
  account: string | null | undefined,
  chainId: number = DEFAULT_CHAIN_ID
): MyGardens {
  const query = useGardens(chainId);
  const pendingJoinsVersion = usePendingJoinsVersion();
  const isLoaded = query.data !== undefined && !query.isPlaceholderData;
  const list = isLoaded ? query.data : undefined;
  const scope = awaitingJoinRequestScope(chainId, account);
  const awaiting = useAwaitingJoinRequestsStore((state) =>
    scope ? state.requestsByScope[scope] : undefined
  );

  // `requested`: the listed gardens this device asked to join that the account's own do not
  // include yet.
  const { gardens, requested } = useMemo(() => {
    if (!list || !account) return { gardens: NO_GARDENS, requested: NO_REQUESTED };
    const pendingJoins = pendingJoinGardenIds(account);
    const mine = listMyGardens(list, account, (gardenId) =>
      pendingJoins.has(gardenId.toLowerCase())
    );
    if (!awaiting) return { gardens: mine, requested: NO_REQUESTED };
    const mineIds = new Set(mine.map(({ garden }) => garden.id.toLowerCase()));
    const asked = list.filter(({ id }) => {
      const gardenId = id.toLowerCase();
      return gardenId in awaiting && !mineIds.has(gardenId);
    });
    return { gardens: mine, requested: asked.length > 0 ? asked : NO_REQUESTED };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version counter is a deliberate cache-buster, not a read dependency
  }, [list, account, awaiting, pendingJoinsVersion]);

  // A steward's welcome is on chain at once and in the roster only once the indexer catches up,
  // and the request's own answer needs a signature to read. So the chain says, with no signature,
  // whether the account now holds the gardener role where this device asked to join. Only a fresh
  // yes counts: an older one, such as a yes the device kept from an earlier session, may predate
  // a departure or a removal. A yes answers the request and stands in until a read of the roster
  // lists the account.
  const roleReads = useQueries({
    queries: account
      ? requested.map(({ id }) =>
          hasRoleQuery(id as Address, account as Address, "gardener", chainId)
        )
      : [],
  });
  const welcomed = requested
    .filter((_, index) => roleReads[index]?.data === true && !roleReads[index]?.isStale)
    .map(({ id }) => id)
    .join(",");
  useEffect(() => {
    if (!account || !welcomed) return;
    const gardenIds = welcomed.split(",");
    for (const gardenId of gardenIds) addPendingJoin(gardenId, account);
    if (scope) useAwaitingJoinRequestsStore.getState().forgetRequests(scope, gardenIds);
  }, [account, scope, welcomed]);

  // Once a read of the roster lists the account, its open join has done its job, and a request to
  // join there has been answered. The join's own optimistic entry is not a read: the next read can
  // drop it while the indexer catches up, and the pending join has to stand in then.
  useEffect(() => {
    if (!account) return;
    const listed = gardens
      .filter(
        ({ garden, membership }) => membership.roles.length > 0 && !isOwnJoinEntry(garden, account)
      )
      .map(({ garden }) => garden.id);
    if (listed.length === 0) return;
    forgetListedPendingJoins(account, listed);
    if (scope) useAwaitingJoinRequestsStore.getState().forgetRequests(scope, listed);
  }, [account, scope, gardens]);

  const { refetch: refetchGardens } = query;
  const refetch = useCallback(() => {
    void refetchGardens();
  }, [refetchGardens]);

  return {
    gardens,
    isLoaded,
    isError: query.isError,
    isStale: isLoaded && (query.isStale || query.isError),
    isFetching: query.isFetching,
    refetch,
  };
}
