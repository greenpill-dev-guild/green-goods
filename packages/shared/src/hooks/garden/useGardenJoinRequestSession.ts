import { useLayoutEffect, useRef } from "react";
import { useQuery, useQueryClient, type Query } from "@tanstack/react-query";
import { gardenJoinRequestKeys } from "../../config/query-keys/garden-join-requests";
import type {
  GardenJoinProofEnvelope,
  GardenJoinRequestSelfRecord,
} from "../../public-contracts/join-requests";

type Status = {
  request: GardenJoinRequestSelfRecord | null;
  hasCheckedStatus: boolean;
  outcomeUnknown: boolean;
};
const EMPTY: Status = { request: null, hasCheckedStatus: false, outcomeUnknown: false };
// Authorization never enters query data, browser persistence, URLs or telemetry.
const sessions = new WeakMap<Query, { proof?: GardenJoinProofEnvelope; operation: number }>();

export function useGardenJoinRequestSession(
  chainId: number,
  garden: string,
  account: string,
  authMode: string
) {
  const client = useQueryClient();
  const key = gardenJoinRequestKeys.self(chainId, garden, account, authMode);
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
  const observed = useQuery({
    queryKey: key,
    queryFn: async () => EMPTY,
    enabled: false,
    initialData: EMPTY,
    gcTime: 5 * 60_000,
  });
  const query = client.getQueryCache().find({ queryKey: key, exact: true })!;
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
