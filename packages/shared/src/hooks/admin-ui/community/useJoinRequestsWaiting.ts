import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { gardenJoinRequestKeys } from "../../../config/query-keys/garden-join-requests";
import {
  GardenJoinRequestTransportError,
  gardenJoinRequestTransport,
} from "../../../modules/garden-join-requests";
import type {
  GardenJoinRequestCountGrant,
  GardenJoinRequestKind,
} from "../../../public-contracts/join-requests";
import { useGardenStateStore } from "../../../stores/useGardenStateStore";
import {
  joinRequestCountGrantScope,
  useJoinRequestCountGrantStore,
} from "../../../stores/useJoinRequestCountGrantStore";
import type { Address } from "../../../types/domain";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { useCurrentChain } from "../../blockchain/useChainConfig";

/**
 * How many join requests wait on a garden's stewards, for the Members tab's badge (DL-134). A badge
 * never asks for a signature, so this reads the service with the count grant the steward's last
 * signed check left in this browser, once on arrival and again as requests are answered. Without a
 * grant, or if that read fails before it has answered, it holds what each queue's last check found;
 * before any check it holds nothing. Those last checks live with the garden's workspace state
 * because the Community view remounts between some of its tabs; that state lasts the browser tab's
 * session and clears when a different account signs in.
 */
export function useJoinRequestsWaiting(gardenKey: string) {
  const chainId = useCurrentChain();
  const account = usePrimaryAddress();
  const queryClient = useQueryClient();
  const garden = gardenKey.toLowerCase();
  const scope = joinRequestCountGrantScope(chainId, account);
  const accountKey = account ?? "none";
  const token = useJoinRequestCountGrantStore((state) =>
    scope ? state.grantsByScope[scope]?.[garden]?.token : undefined
  );
  const grantGeneration = useJoinRequestCountGrantStore((state) => state.generation);
  const lastChecks = useGardenStateStore(
    (state) => state.getGardenWorkspaceState(gardenKey, "community").joinRequestsWaiting
  );

  const { data: counted } = useQuery({
    queryKey: gardenJoinRequestKeys.count(chainId, garden, accountKey),
    queryFn: async () => {
      try {
        return (await gardenJoinRequestTransport.count(garden as Address, token!)).waiting;
      } catch (error) {
        // The grant lapsed or the account lost the role, so only a new signed check can bring it
        // back. Any other failure says nothing about the grant, and keeps the last answer.
        if (
          error instanceof GardenJoinRequestTransportError &&
          (error.status === 401 || error.status === 403)
        ) {
          useJoinRequestCountGrantStore.getState().forgetGrant(scope!, garden, token!);
          return null;
        }
        throw error;
      }
    },
    enabled: Boolean(token),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const readCountAgain = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: gardenJoinRequestKeys.count(chainId, garden, accountKey),
      exact: true,
    });
  }, [queryClient, chainId, garden, accountKey]);

  const noteJoinRequestsRead = useCallback(
    (kind: GardenJoinRequestKind, waiting: number) => {
      const store = useGardenStateStore.getState();
      const { joinRequestsWaiting } = store.getGardenWorkspaceState(gardenKey, "community");
      store.setGardenWorkspaceState(gardenKey, "community", {
        joinRequestsWaiting: { ...joinRequestsWaiting, [kind]: waiting },
      });
      readCountAgain();
    },
    [gardenKey, readCountAgain]
  );

  const keepJoinRequestCountGrant = useCallback(
    (grant: GardenJoinRequestCountGrant) => {
      const store = useJoinRequestCountGrantStore.getState();
      // A queue read can outlive the session that started it; sign-out has the last word.
      if (!scope || store.generation !== grantGeneration) return;
      store.keepGrant(scope, garden, grant);
      readCountAgain();
    },
    [scope, garden, grantGeneration, readCountAgain]
  );

  return {
    joinRequestsWaiting:
      counted ?? (lastChecks?.garden_membership ?? 0) + (lastChecks?.steward_access ?? 0),
    noteJoinRequestsRead,
    keepJoinRequestCountGrant,
  };
}
