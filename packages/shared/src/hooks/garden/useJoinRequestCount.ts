/**
 * useJoinRequestCount Hook
 *
 * How many join requests wait in one garden, read with the count grant the account's last signed
 * queue read left in this browser (`useJoinRequestCountGrantStore`), so no read here ever asks for
 * a signature. Without a grant nothing is read. A grant the service refuses, because it lapsed or
 * the account lost its role, is forgotten, since only a new signed check can bring it back; any
 * other failure says nothing about the grant and keeps it.
 *
 * The admin's Members tab badge (DL-134, `useJoinRequestsWaiting`) counts both queues, as that
 * tab lists both. Home's Needs Your Attention row and bell (PRD-1381) count requests to join
 * alone (`kind`), since the installed app's Gardeners sheet lists only those; an older service
 * ignores the kind and answers with the total. The queues that read signed hand over the grant
 * each read returns, and ask for the counts again once they answer a request
 * (`useJoinRequestCountUpdates`). Each count is read once on arrival and again on those updates,
 * never on a timer or on focus.
 *
 * @module hooks/garden/useJoinRequestCount
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { gardenJoinRequestKeys } from "../../config/query-keys/garden-join-requests";
import {
  GardenJoinRequestTransportError,
  gardenJoinRequestTransport,
} from "../../modules/garden-join-requests";
import type {
  GardenJoinRequestCountGrant,
  GardenJoinRequestKind,
} from "../../public-contracts/join-requests";
import {
  joinRequestCountGrantScope,
  useJoinRequestCountGrantStore,
} from "../../stores/useJoinRequestCountGrantStore";
import type { Address } from "../../types/domain";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useCurrentChain } from "../blockchain/useChainConfig";

export interface JoinRequestCount {
  /** How many requests wait in the queue read; undefined without a grant and until it answers. */
  waiting: number | undefined;
  /** The grant's read has not answered yet. */
  isLoading: boolean;
  /** The grant's read failed and kept the grant, so requests may wait unseen. */
  isError: boolean;
  /** Read the count again; without a grant there is nothing to read. */
  refetch: () => void;
}

/** Whose count it is: the garden, lowercased, and the chain and account its grant belongs to. */
function useCountSubject(gardenId: string) {
  const chainId = useCurrentChain();
  const account = usePrimaryAddress();
  return {
    chainId,
    garden: gardenId.toLowerCase(),
    accountKey: account ?? "none",
    grantScope: joinRequestCountGrantScope(chainId, account),
  };
}

/**
 * The garden's waiting total, or one queue's (`kind`), read with this browser's grant.
 * `enabled: false` reads nothing.
 */
export function useJoinRequestCount(
  gardenId: string,
  options: { enabled?: boolean; kind?: GardenJoinRequestKind } = {}
): JoinRequestCount {
  const { chainId, garden, accountKey, grantScope } = useCountSubject(gardenId);
  const { kind } = options;
  const token = useJoinRequestCountGrantStore((state) =>
    grantScope ? state.grantsByScope[grantScope]?.[garden]?.token : undefined
  );
  const canRead = Boolean(token) && options.enabled !== false;

  const read = useQuery({
    queryKey: gardenJoinRequestKeys.count(chainId, garden, accountKey, kind),
    queryFn: async () => {
      try {
        return (await gardenJoinRequestTransport.count(garden as Address, token!, { kind }))
          .waiting;
      } catch (error) {
        // The grant lapsed or the account lost the role, so only a new signed check can bring it
        // back. Any other failure says nothing about the grant, and keeps the last answer.
        if (
          error instanceof GardenJoinRequestTransportError &&
          (error.status === 401 || error.status === 403)
        ) {
          useJoinRequestCountGrantStore.getState().forgetGrant(grantScope!, garden, token!);
          return null;
        }
        throw error;
      }
    },
    enabled: canRead,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // A refetch runs even when a query is disabled, so it waits for a grant to read with.
  const { refetch } = read;
  const readAgain = useCallback(() => {
    if (canRead) void refetch();
  }, [canRead, refetch]);

  // A disabled read still hands back what it answered before; without a grant it says nothing.
  return {
    waiting: canRead ? (read.data ?? undefined) : undefined,
    isLoading: canRead && read.isLoading,
    isError: canRead && read.isError,
    refetch: readAgain,
  };
}

/**
 * What a signed queue read does for the count: keep the grant it returned, so the count can be
 * read on arrival without a signature, and ask for the garden's counts again, the total and each
 * queue's, once a request is answered.
 */
export function useJoinRequestCountUpdates(gardenId: string) {
  const queryClient = useQueryClient();
  const { chainId, garden, accountKey, grantScope } = useCountSubject(gardenId);
  const grantGeneration = useJoinRequestCountGrantStore((state) => state.generation);

  const readCountAgain = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: gardenJoinRequestKeys.counts(chainId, garden, accountKey),
    });
  }, [queryClient, chainId, garden, accountKey]);

  const keepCountGrant = useCallback(
    (grant: GardenJoinRequestCountGrant) => {
      const store = useJoinRequestCountGrantStore.getState();
      // A queue read can outlive the session that started it; sign-out has the last word.
      if (!grantScope || store.generation !== grantGeneration) return;
      store.keepGrant(grantScope, garden, grant);
      readCountAgain();
    },
    [grantScope, garden, grantGeneration, readCountAgain]
  );

  return { keepCountGrant, readCountAgain };
}
