import type { Address } from "../../types/domain";
import type { PoolMemberHistory, PoolMemberHistoryDisclosure } from "./types";

export function resolvePoolMemberHistoryDisclosure(input: {
  viewer?: Address | string;
  account: Address | string;
  history?: PoolMemberHistory | null;
  isCurrentSteward: boolean;
  /** Historical capability is deliberately non-authoritative. */
  wasSteward?: boolean;
}): PoolMemberHistoryDisclosure {
  if (!input.viewer) return { status: "unauthenticated" };
  const self = input.viewer.toLowerCase() === input.account.toLowerCase();
  if (!self && !input.isCurrentSteward) return { status: "hidden" };
  if (!input.history) return { status: "hidden" };
  return { status: "visible", history: input.history };
}

export function selectPoolParticipationSummary(input: {
  commitmentsAccepted: bigint;
  commitmentsFulfilled: bigint;
  commitmentsDue: bigint;
  commitmentsCancelled: bigint;
  commitmentsExpired: bigint;
}) {
  return {
    commitmentsAccepted: input.commitmentsAccepted,
    commitmentsFulfilled: input.commitmentsFulfilled,
    commitmentsCancelled: input.commitmentsCancelled,
    commitmentsExpired: input.commitmentsExpired,
    promiseKeptRate: selectPromiseKeptRate(input),
  } as const;
}

export function selectPromiseKeptRate(input: {
  commitmentsFulfilled: bigint;
  commitmentsDue: bigint;
}): { fulfilled: bigint; due: bigint } | null {
  return input.commitmentsDue === 0n
    ? null
    : { fulfilled: input.commitmentsFulfilled, due: input.commitmentsDue };
}

export type PublicPromiseKeptRateSelection =
  | { kind: "rate"; rate: { fulfilled: bigint; due: bigint } }
  | { kind: "counts-only"; counts: { fulfilled: bigint; due: bigint } };

export const PUBLIC_PROMISE_KEPT_MIN_DUE = 5n;
export const PUBLIC_PROMISE_KEPT_MIN_DISTINCT_PROVIDERS = 3n;

export function selectPublicPromiseKeptRate(input: {
  commitmentsFulfilled: bigint;
  commitmentsDue: bigint;
  distinctProviderCount: bigint;
}): PublicPromiseKeptRateSelection {
  const counts = {
    fulfilled: input.commitmentsFulfilled,
    due: input.commitmentsDue,
  };
  return input.commitmentsDue >= PUBLIC_PROMISE_KEPT_MIN_DUE &&
    input.distinctProviderCount >= PUBLIC_PROMISE_KEPT_MIN_DISTINCT_PROVIDERS
    ? { kind: "rate", rate: counts }
    : { kind: "counts-only", counts };
}
