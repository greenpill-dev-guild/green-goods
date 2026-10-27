import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQuery, useQueryClient, type Query } from "@tanstack/react-query";
import { gardenJoinRequestKeys } from "../../config/query-keys/garden-join-requests";
import type {
  GardenJoinProofEnvelope,
  GardenJoinRequestSelfRecord,
  GardenJoinRequestKind,
} from "../../public-contracts/join-requests";
import {
  awaitingJoinRequestScope,
  useAwaitingJoinRequestsStore,
} from "../../stores/useAwaitingJoinRequestsStore";
import { useAuth } from "../auth/useAuth";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTimeout } from "../utils/useTimeout";

/** The longest delay a browser timer holds; a longer one fires at once. */
const MAX_TIMEOUT_MS = 2_147_483_647;

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
 * record, so both build it from here. Setting it also notes the device's own record of the
 * request (`useAwaitingJoinRequestsStore`), which holds no proof and outlives the session.
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
  // The device keeps which gardens the account asked to join, so Awaiting review outlives this
  // session (DL-123). The record follows the session's own answer, for a membership request with
  // a real garden and account; a steward-access ask is no join.
  function noteOnDevice(request: GardenJoinRequestSelfRecord | null) {
    if (kind !== "garden_membership" || garden === "none" || account === "none") return;
    const scope = awaitingJoinRequestScope(chainId, account);
    if (scope) {
      useAwaitingJoinRequestsStore.getState().noteRequest(scope, garden, request, Date.now());
    }
  }
  return {
    ...observed.data,
    scopeKey,
    barrierKey: query,
    beginOperation: () => ++privateSession.operation,
    isCurrentOperation: (operation: number) => privateSession.operation === operation,
    isCurrentScope,
    setRequest: (request: GardenJoinRequestSelfRecord | null) => {
      if (!isCurrentScope(scopeKey)) return;
      update({ request });
      noteOnDevice(request);
    },
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
 * steward, as this device knows it (DL-125): a request sent or checked in this session, or one
 * this device sent in an earlier one and still holds a record of (`useAwaitingJoinRequestsStore`).
 * The service shows a request only to the account's signature, so this reads the session's own
 * records and the device's and never asks for one; observing the session's keeps them while a
 * list shows them. An answer this session learned outranks the device's record. Ids come back
 * lowercased.
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
  const scope = awaitingJoinRequestScope(chainId, account);
  const kept = useAwaitingJoinRequestsStore((state) =>
    scope ? state.requestsByScope[scope] : undefined
  );
  // The clock moves when the soonest device record lapses, so a list on screen drops its mark.
  const [now, setNow] = useState(Date.now);
  const { set: setTimer, clear: clearTimer } = useTimeout();
  const awaitingIds: string[] = [];
  let nextLapse = Number.POSITIVE_INFINITY;
  for (let index = 0; index < gardenIds.length; index++) {
    const id = gardenIds[index].toLowerCase();
    const session = records[index]?.data;
    // This session's pending answer lapses on its own expiry; an answer already checked here
    // leaves the device's record out.
    const lapse =
      session?.request?.state === "pending"
        ? Date.parse(session.request.expiresAt)
        : session?.hasCheckedStatus
          ? 0
          : (kept?.[id]?.expiresAt ?? 0);
    // A pending answer whose expiry does not parse stays awaiting.
    if (Number.isNaN(lapse)) {
      awaitingIds.push(id);
    } else if (lapse > now) {
      awaitingIds.push(id);
      nextLapse = Math.min(nextLapse, lapse);
    }
  }
  useEffect(() => {
    if (!Number.isFinite(nextLapse)) return;
    // A request lapses a month out, past the timer limit: wait in steps, then read the clock.
    const delay = Math.min(Math.max(nextLapse - Date.now(), 0), MAX_TIMEOUT_MS);
    setTimer(() => setNow(Date.now()), delay);
    return clearTimer;
  }, [nextLapse, now, setTimer, clearTimer]);
  // One string per answer, so the set keeps its identity until a request changes.
  const awaiting = awaitingIds.join(",");
  return useMemo(() => new Set(awaiting ? awaiting.split(",") : []), [awaiting]);
}
