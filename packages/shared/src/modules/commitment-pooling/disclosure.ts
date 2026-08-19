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
