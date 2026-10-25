import { useLayoutEffect, useMemo, useRef } from "react";
import { useQueries, useQuery, useQueryClient, type Query } from "@tanstack/react-query";
import { gardenJoinRequestKeys } from "../../config/query-keys/garden-join-requests";
import type {
  GardenJoinProofEnvelope,
  GardenJoinRequestSelfRecord,
  GardenJoinRequestKind,
} from "../../public-contracts/join-requests";
import { useAuth } from "../auth/useAuth";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useCurrentChain } from "../blockchain/useChainConfig";

type Status = {
  request: GardenJoinRequestSelfRecord | null;
  hasCheckedStatus: boolean;
  outcomeUnknown: boolean;
};
const EMPTY: Status = { request: null, hasCheckedStatus: false, outcomeUnknown: false };
// Authorization never enters query data, browser persistence, URLs or telemetry.
const sessions = new WeakMap<Query, { proof?: GardenJoinProofEnvelope; operation: number }>();

/**
 * This session's record of one account's request to join one garden: in memory only, outside
 * the persisted namespace, and removed with the account's other private queries at sign-out.
 * The join dialog's session and the lists that mark a garden awaiting review observe the same
 * record, so both build it from here.
 */
function joinRequestStatusQuery(
  chainId: number,
  garden: string,
  account: string,
  authMode: string,
  kind: GardenJoinRequestKind = "garden_membership"
) {
  return {
    queryKey: gardenJoinRequestKeys.self(chainId, garden, account, authMode, kind),
    queryFn: async (): Promise<Status> => EMPTY,
    enabled: false,
    initialData: EMPTY,
    gcTime: 5 * 60_000,
  };
}

export function useGardenJoinRequestSession(
  chainId: number,
  garden: string,
  account: string,
  authMode: string,
  kind: GardenJoinRequestKind = "garden_membership"
) {
  const client = useQueryClient();
  const key = gardenJoinRequestKeys.self(chainId, garden, account, authMode, kind);
  const identity = key.join(":");
  const owner = `${chainId}:${account.toLowerCase()}:${authMode}`;
  const previousOwner = useRef({ owner, chainId, account: account.toLowerCase(), authMode });
  useLayoutEffect(() => {
    const previous = previousOwner.current;
    if (previous.owner !== owner) {
      client.removeQueries({
        predicate: ({ queryKey }) =>
          queryKey[0] === "garden-join-requests" &&
          queryKey[2] === previous.chainId &&
          queryKey[4] === previous.account &&
          queryKey[5] === previous.authMode,
      });
      previousOwner.current = { owner, chainId, account: account.toLowerCase(), authMode };
    }
  }, [client, owner, chainId, account, authMode]);
  const generation = useRef({ identity, value: 0 });
  if (generation.current.identity !== identity) {
    generation.current = { identity, value: generation.current.value + 1 };
  }
  const scopeKey = `${identity}:${generation.current.value}`;
  const latestScope = useRef(scopeKey);
  latestScope.current = scopeKey;
  const observed = useQuery(joinRequestStatusQuery(chainId, garden, account, authMode, kind));
  const query = client.getQueryCache().build<unknown>(client, { queryKey: key });
  const privateSession = sessions.get(query) ?? { operation: 0 };
  sessions.set(query, privateSession);
  function isCurrentScope(scope: string) {
    return (
      latestScope.current === scope &&
      client.getQueryCache().find({ queryKey: key, exact: true }) === query
    );
  }
  function update(patch: Partial<Status>) {
    if (!isCurrentScope(scopeKey)) return;
    client.setQueryData<Status>(key, (current) => ({ ...(current ?? EMPTY), ...patch }));
  }
  return {
    ...observed.data,
    scopeKey,
    barrierKey: query,
    beginOperation: () => ++privateSession.operation,
    isCurrentOperation: (operation: number) => privateSession.operation === operation,
    isCurrentScope,
    setRequest: (request: GardenJoinRequestSelfRecord | null) => update({ request }),
    setHasCheckedStatus: (hasCheckedStatus: boolean) => update({ hasCheckedStatus }),
    setOutcomeUnknown: (outcomeUnknown: boolean) => update({ outcomeUnknown }),
    readAuthorization() {
      if (!isCurrentScope(scopeKey)) return undefined;
      const proof = privateSession.proof;
      if (proof && proof.expiresAt > Math.floor(Date.now() / 1000)) return proof;
      delete privateSession.proof;
      return undefined;
    },
    retainAuthorization(proof: GardenJoinProofEnvelope) {
      if (isCurrentScope(scopeKey)) privateSession.proof = proof;
    },
    forgetAuthorization: () => {
      delete privateSession.proof;
    },
  };
}

/**
 * The gardens among `gardenIds` where the signed-in account's request to join waits for a
 * steward, as this device knows it: a request sent or checked in this session (DL-125). The
 * service shows a request only to the account's signature, so this reads the session's own
 * records and never asks for one; observing them keeps them while a list shows them. Ids come
 * back lowercased.
 */
export function useAwaitingJoinRequests(gardenIds: readonly string[]): ReadonlySet<string> {
  const chainId = useCurrentChain();
  const account = usePrimaryAddress();
  const { authMode } = useAuth();
  const records = useQueries({
    queries: account
      ? gardenIds.map((gardenId) =>
          joinRequestStatusQuery(chainId, gardenId, account, authMode ?? "none")
        )
      : [],
  });
  // One string per answer, so the set keeps its identity until a request changes.
  const awaiting = records
    .flatMap((record, index) =>
      record.data?.request?.state === "pending" ? [gardenIds[index].toLowerCase()] : []
    )
    .join(",");
  return useMemo(() => new Set(awaiting ? awaiting.split(",") : []), [awaiting]);
}
