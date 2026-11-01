import { useCallback, useEffect, useMemo } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { listMyGardens, type MyGarden } from "../../modules/garden/membership";
import {
  forgetListedPendingJoins,
  isOwnJoinEntry,
  pendingJoinGardenIds,
} from "../../modules/garden/pending-joins";
import {
  awaitingJoinRequestScope,
  useAwaitingJoinRequestsStore,
} from "../../stores/useAwaitingJoinRequestsStore";
import type { Garden } from "../../types/domain";
import { useGardens } from "../blockchain/useBaseLists";
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
  /** Read the gardens list again, after a failure. */
  refetch: () => void;
}

const NO_GARDENS: MyGarden<Garden>[] = [];

/**
 * The account's gardens: every garden in the chain's list whose record lists the account as
 * owner, steward, evaluator or gardener, plus a fresh open join this device sent that the record
 * does not show yet (`modules/garden/membership`). Unknown, failed and empty stay apart, and
 * another chain's list, kept on screen while this chain's loads, is never read as an answer.
 */
export function useMyGardens(
  account: string | null | undefined,
  chainId: number = DEFAULT_CHAIN_ID
): MyGardens {
  const query = useGardens(chainId);
  const pendingJoinsVersion = usePendingJoinsVersion();
  const isLoaded = query.data !== undefined && !query.isPlaceholderData;
  const list = isLoaded ? query.data : undefined;

  const gardens = useMemo(() => {
    if (!list || !account) return NO_GARDENS;
    const pendingJoins = pendingJoinGardenIds(account);
    return listMyGardens(list, account, (gardenId) => pendingJoins.has(gardenId.toLowerCase()));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version counter is a deliberate cache-buster, not a read dependency
  }, [list, account, pendingJoinsVersion]);

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
    const scope = awaitingJoinRequestScope(chainId, account);
    if (scope) useAwaitingJoinRequestsStore.getState().forgetRequests(scope, listed);
  }, [account, chainId, gardens]);

  const { refetch: refetchGardens } = query;
  const refetch = useCallback(() => {
    void refetchGardens();
  }, [refetchGardens]);

  return {
    gardens,
    isLoaded,
    isError: query.isError,
    isStale: isLoaded && (query.isStale || query.isError),
    refetch,
  };
}
