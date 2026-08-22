import { useQuery } from "@tanstack/react-query";

import { queryKeys, STALE_TIME_MEDIUM } from "../../config/query-keys";
import {
  getCommitmentActivity,
  getCommitmentClaimRequests,
  getCommitmentCycleDetail,
  getCommitmentCycles,
  getCommitmentDetail,
  getCommitmentExchange,
  getCommitmentFunding,
  getCommitmentHypercertBundle,
  getCommitmentPoolDetail,
  getCommitmentPools,
  getCommitments,
  getCommitmentSeries,
  getCommitmentSeriesDetail,
  getCommitmentWorkAttributionsByWork,
  getNeedCommitments,
  getPoolMemberHistory,
} from "../../modules/commitment-pooling/data";
import {
  resolvePoolMemberHistoryDisclosure,
  selectPoolParticipationSummary,
  selectPromiseKeptRate,
} from "../../modules/commitment-pooling/disclosure";
import { isPoolSteward } from "../../modules/commitment-pooling/selectors";
import type { Address } from "../../types/domain";
import { useGardenRoles } from "../roles/useGardenRoles";
import { useCommitmentPoolingAvailability } from "./useCommitmentPoolingAvailability";

export function useCommitmentPools(input: { chainId: number; garden?: Address }) {
  const availability = useCommitmentPoolingAvailability(input);
  const query = useQuery({
    queryKey: queryKeys.commitmentPooling.pools(input.chainId, input.garden),
    queryFn: () => getCommitmentPools(input.chainId, input.garden),
    enabled: availability.status === "available",
    staleTime: STALE_TIME_MEDIUM,
  });
  return {
    ...query,
    pools: (query.data ?? []).map((pool) => ({
      ...pool,
      promiseKeptRate: selectPromiseKeptRate(pool),
    })),
    availability,
  };
}

export function useCommitmentPool(
  input: { chainId: number; poolId: bigint },
  /** A caller that may not know the id yet gates here; the key stays the same. */
  options: { enabled?: boolean } = {}
) {
  const availability = useCommitmentPoolingAvailability(input);
  const query = useQuery({
    queryKey: queryKeys.commitmentPooling.pool(input.chainId, input.poolId),
    queryFn: () => getCommitmentPoolDetail(input.chainId, input.poolId),
    enabled: availability.status === "available" && options.enabled !== false,
    staleTime: STALE_TIME_MEDIUM,
  });
  return { ...query, pool: query.data?.pool ?? null, detail: query.data ?? null, availability };
}

export function useCommitmentCycles(input: {
  chainId: number;
  poolId: bigint;
  cycleType?: string;
  state?: string;
}) {
  const availability = useCommitmentPoolingAvailability(input);
  const filters = { cycleType: input.cycleType, state: input.state };
  const query = useQuery({
    queryKey: queryKeys.commitmentPooling.cycles(input.chainId, input.poolId, filters),
    queryFn: () => getCommitmentCycles(input),
    enabled: availability.status === "available",
    staleTime: STALE_TIME_MEDIUM,
  });
  return { ...query, cycles: query.data ?? [], availability };
}

export function useCommitmentCycle(input: { chainId: number; cycleId: bigint }) {
  const availability = useCommitmentPoolingAvailability(input);
  const query = useQuery({
    queryKey: queryKeys.commitmentPooling.cycle(input.chainId, input.cycleId),
    queryFn: () => getCommitmentCycleDetail(input.chainId, input.cycleId),
    enabled: availability.status === "available",
    staleTime: STALE_TIME_MEDIUM,
  });
  return { ...query, cycle: query.data?.cycle ?? null, detail: query.data ?? null, availability };
}

export function useCommitments(
  input: {
    chainId: number;
    poolId?: bigint;
    cycleId?: bigint;
    seriesId?: bigint;
    account?: Address;
    state?: string;
  },
  /**
   * Callers that scope by a value which may not be known yet must gate here.
   * An absent `account` is not a narrower query, it is an unscoped one: the
   * filter is simply dropped and every commitment on the chain comes back.
   * `options` stays out of the query key so gating never fragments the cache.
   */
  options: { enabled?: boolean } = {}
) {
  const availability = useCommitmentPoolingAvailability(input);
  const query = useQuery({
    queryKey: queryKeys.commitmentPooling.commitments(input.chainId, input),
    queryFn: () => getCommitments(input),
    enabled: availability.status === "available" && options.enabled !== false,
    staleTime: STALE_TIME_MEDIUM,
  });
  return { ...query, commitments: query.data ?? [], availability };
}

export function useCommitment(
  input: { chainId: number; commitmentId: bigint },
  /** A caller that may not know the id yet gates here; the key stays the same. */
  options: { enabled?: boolean } = {}
) {
  const availability = useCommitmentPoolingAvailability(input);
  const query = useQuery({
    queryKey: queryKeys.commitmentPooling.commitment(input.chainId, input.commitmentId),
    queryFn: () => getCommitmentDetail(input.chainId, input.commitmentId),
    enabled: availability.status === "available" && options.enabled !== false,
    staleTime: STALE_TIME_MEDIUM,
  });
  return {
    ...query,
    commitment: query.data?.commitment ?? null,
    detail: query.data ?? null,
    availability,
  };
}

/**
 * Which commitment a work fulfils, read from the work's side. Keyed under the
 * chain's pooling prefix so the same invalidation that refreshes a commitment
 * refreshes this; the key is declared here because the registry is not this
 * lane's to extend.
 */
export function useCommitmentWorkAttributionsForWork(input: {
  chainId: number;
  workUID?: string | null;
}) {
  const availability = useCommitmentPoolingAvailability(input);
  const workUID = input.workUID?.toLowerCase() ?? null;
  const query = useQuery({
    queryKey: [
      ...queryKeys.commitmentPooling.all(input.chainId),
      "work-attributions",
      workUID,
    ] as const,
    queryFn: () => getCommitmentWorkAttributionsByWork(input.chainId, workUID as string),
    enabled: availability.status === "available" && Boolean(workUID),
    staleTime: STALE_TIME_MEDIUM,
  });
  return { ...query, attributions: query.data ?? [], availability };
}

export function useCommitmentClaimRequests(input: {
  chainId: number;
  commitmentId: bigint;
  state?: string;
}) {
  const availability = useCommitmentPoolingAvailability(input);
  const query = useQuery({
    queryKey: queryKeys.commitmentPooling.claims(input.chainId, input.commitmentId, input.state),
    queryFn: () => getCommitmentClaimRequests(input.chainId, input.commitmentId, input.state),
    enabled: availability.status === "available",
    staleTime: STALE_TIME_MEDIUM,
  });
  return { ...query, claimRequests: query.data ?? [], availability };
}

export function useCommitmentSeries(input: {
  chainId: number;
  poolId?: bigint;
  holder?: Address;
  state?: string;
}) {
  const availability = useCommitmentPoolingAvailability(input);
  const query = useQuery({
    queryKey: queryKeys.commitmentPooling.seriesList(input.chainId, input),
    queryFn: () => getCommitmentSeries(input),
    enabled: availability.status === "available",
    staleTime: STALE_TIME_MEDIUM,
  });
  return { ...query, series: query.data ?? [], availability };
}

export function useCommitmentSeriesDetail(input: { chainId: number; seriesId: bigint }) {
  const availability = useCommitmentPoolingAvailability(input);
  const query = useQuery({
    queryKey: queryKeys.commitmentPooling.series(input.chainId, input.seriesId),
    queryFn: () => getCommitmentSeriesDetail(input.chainId, input.seriesId),
    enabled: availability.status === "available",
    staleTime: STALE_TIME_MEDIUM,
  });
  return { ...query, series: query.data?.series ?? null, detail: query.data ?? null, availability };
}

export function useNeedCommitments(input: { chainId: number; needUID: string }) {
  const availability = useCommitmentPoolingAvailability(input);
  const query = useQuery({
    queryKey: queryKeys.commitmentPooling.need(input.chainId, input.needUID),
    queryFn: () => getNeedCommitments(input.chainId, input.needUID),
    enabled: availability.status === "available" && input.needUID.length > 0,
    staleTime: STALE_TIME_MEDIUM,
  });
  return { ...query, lineage: query.data ?? null, availability };
}

export function useCommitmentExchange(input: {
  chainId: number;
  poolId: bigint;
  commitmentIdA: bigint;
  commitmentIdB: bigint;
}) {
  const availability = useCommitmentPoolingAvailability(input);
  const query = useQuery({
    queryKey: queryKeys.commitmentPooling.exchange(
      input.chainId,
      input.poolId,
      input.commitmentIdA,
      input.commitmentIdB
    ),
    queryFn: () =>
      getCommitmentExchange(input.chainId, input.poolId, input.commitmentIdA, input.commitmentIdB),
    enabled: availability.status === "available",
    staleTime: STALE_TIME_MEDIUM,
  });
  return { ...query, exchange: query.data ?? null, availability };
}

export function useCommitmentHypercertBundle(input: { chainId: number; hypercertId: bigint }) {
  const availability = useCommitmentPoolingAvailability(input);
  const query = useQuery({
    queryKey: queryKeys.commitmentPooling.hypercertBundle(input.chainId, input.hypercertId),
    queryFn: () => getCommitmentHypercertBundle(input.chainId, input.hypercertId),
    enabled: availability.status === "available",
    staleTime: STALE_TIME_MEDIUM,
  });
  return { ...query, bundle: query.data ?? null, availability };
}

export function useCommitmentFunding(input: {
  chainId: number;
  commitmentId: bigint;
  funder?: Address;
}) {
  const availability = useCommitmentPoolingAvailability(input);
  const query = useQuery({
    queryKey: queryKeys.commitmentPooling.funding(input.chainId, input.commitmentId, input.funder),
    queryFn: () => getCommitmentFunding(input.chainId, input.commitmentId, input.funder),
    enabled: availability.status === "available",
    staleTime: STALE_TIME_MEDIUM,
  });
  return { ...query, funding: query.data ?? [], availability };
}

export function useCommitmentActivity(input: {
  chainId: number;
  poolId?: bigint;
  cycleId?: bigint;
  commitmentId?: bigint;
  limit?: number;
  offset?: number;
}) {
  const availability = useCommitmentPoolingAvailability(input);
  const query = useQuery({
    queryKey: queryKeys.commitmentPooling.activity(input.chainId, input),
    queryFn: () => getCommitmentActivity(input),
    enabled: availability.status === "available",
    staleTime: STALE_TIME_MEDIUM,
  });
  return { ...query, events: query.data ?? [], availability };
}

export function usePoolParticipationSummary(input: { chainId: number; poolId: bigint }) {
  const poolQuery = useCommitmentPool(input);
  return {
    ...poolQuery,
    summary: poolQuery.pool
      ? selectPoolParticipationSummary({
          commitmentsAccepted: poolQuery.pool.commitmentsAccepted,
          commitmentsFulfilled: poolQuery.pool.commitmentsFulfilled,
          commitmentsDue: poolQuery.pool.commitmentsDue,
          commitmentsCancelled: poolQuery.pool.commitmentsCancelled,
          commitmentsExpired: poolQuery.pool.commitmentsExpired,
        })
      : null,
  };
}

export function usePoolMemberHistory(input: {
  chainId: number;
  poolId: bigint;
  account: Address;
  viewer?: Address;
}) {
  const poolQuery = useCommitmentPool({ chainId: input.chainId, poolId: input.poolId });
  const self = input.viewer?.toLowerCase() === input.account.toLowerCase();
  const roleQuery = useGardenRoles(
    !self ? poolQuery.pool?.garden : undefined,
    !self ? input.viewer : undefined,
    input.chainId
  );
  const isCurrentSteward = isPoolSteward(roleQuery.roles);
  const canRead = Boolean(input.viewer && (self || isCurrentSteward));
  const query = useQuery({
    queryKey: queryKeys.commitmentPooling.memberHistory(
      input.chainId,
      input.poolId,
      input.account,
      input.viewer
    ),
    queryFn: () => getPoolMemberHistory(input.chainId, input.poolId, input.account),
    enabled: poolQuery.availability.status === "available" && canRead,
    staleTime: STALE_TIME_MEDIUM,
  });
  const disclosure = !input.viewer
    ? ({ status: "unauthenticated" } as const)
    : resolvePoolMemberHistoryDisclosure({
        viewer: input.viewer,
        account: input.account,
        history: query.data,
        isCurrentSteward,
      });
  return {
    ...query,
    disclosure,
    isLoading: poolQuery.isLoading || roleQuery.isLoading || query.isLoading,
    availability: poolQuery.availability,
  };
}
