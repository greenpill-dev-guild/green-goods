import { logger } from "../app/logger";
import { greenGoodsIndexer } from "../data/graphql-client";
import { integer, type RawRow } from "./data-core";

interface PublicImpactPoolAggregate {
  openPoolIds: string[];
  openPoolCount: bigint;
  commitmentsFulfilled: bigint;
  commitmentsDue: bigint;
}

export interface PublicCommitmentImpactUnavailableSources {
  commitmentPools: boolean;
  distinctProviders: boolean;
  confirmedSettlement: boolean;
}

export interface PublicCommitmentImpactRecord {
  openPoolCount: bigint | null;
  commitmentsFulfilled: bigint | null;
  commitmentsDue: bigint | null;
  distinctProviderCount: bigint | null;
  confirmedDisbursementTotal: bigint | null;
  partialData: boolean;
  unavailableSources: PublicCommitmentImpactUnavailableSources;
}

async function getOpenPoolAggregate(chainId: number): Promise<PublicImpactPoolAggregate> {
  const query = `query PublicCommitmentImpactPools($chainId: Int!) {
    CommitmentPool(where: { chainId: { _eq: $chainId }, registrationSeen: { _eq: true }, state: { _eq: OPEN } }) { poolId }
    CommitmentPool_aggregate(where: { chainId: { _eq: $chainId }, registrationSeen: { _eq: true }, state: { _eq: OPEN } }) {
      aggregate { count sum { commitmentsFulfilled commitmentsDue } }
    }
  }`;
  const result = await greenGoodsIndexer.query<{
    CommitmentPool?: RawRow[];
    CommitmentPool_aggregate?: { aggregate?: RawRow | null };
  }>(query, { chainId }, "getPublicCommitmentImpactPools");
  if (result.error) throw result.error;
  const aggregate = result.data?.CommitmentPool_aggregate?.aggregate;
  if (!aggregate) throw new Error("Commitment pool aggregate is unavailable");
  const sum = (aggregate.sum ?? {}) as RawRow;
  return {
    openPoolIds: (result.data?.CommitmentPool ?? []).map((row) => integer(row.poolId).toString()),
    openPoolCount: integer(aggregate.count),
    commitmentsFulfilled: integer(sum.commitmentsFulfilled),
    commitmentsDue: integer(sum.commitmentsDue),
  };
}

async function getOpenPoolDistinctProviderCount(
  chainId: number,
  openPoolIds: readonly string[]
): Promise<bigint> {
  if (openPoolIds.length === 0) return 0n;
  const query = `query PublicCommitmentImpactProviders($chainId: Int!, $poolIds: [numeric!]!) {
    CommitmentProviderExposure_aggregate(where: { chainId: { _eq: $chainId }, poolId: { _in: $poolIds } }) {
      aggregate { count(columns: [provider], distinct: true) }
    }
  }`;
  const result = await greenGoodsIndexer.query<{
    CommitmentProviderExposure_aggregate?: { aggregate?: RawRow | null };
  }>(query, { chainId, poolIds: [...openPoolIds] }, "getPublicCommitmentImpactProviders");
  if (result.error) throw result.error;
  const aggregate = result.data?.CommitmentProviderExposure_aggregate?.aggregate;
  if (!aggregate) throw new Error("Distinct provider aggregate is unavailable");
  return integer(aggregate.count);
}

async function getConfirmedSettlementAggregate(chainId: number): Promise<bigint> {
  const query = `query PublicCommitmentImpactSettlement($chainId: Int!) {
    Disbursement_aggregate(where: { chainId: { _eq: $chainId }, state: { _eq: CONFIRMED } }) {
      aggregate { sum { amount } }
    }
  }`;
  const result = await greenGoodsIndexer.query<{
    Disbursement_aggregate?: { aggregate?: RawRow | null };
  }>(query, { chainId }, "getPublicCommitmentImpactSettlement");
  if (result.error) throw result.error;
  const aggregate = result.data?.Disbursement_aggregate?.aggregate;
  if (!aggregate) throw new Error("Confirmed settlement aggregate is unavailable");
  return integer(((aggregate.sum ?? {}) as RawRow).amount);
}

function warnUnavailable(source: string, error: unknown): void {
  logger.warn("[getPublicCommitmentImpact] Envio aggregate read failed", { source, error });
}

export async function getPublicCommitmentImpact(
  chainId: number
): Promise<PublicCommitmentImpactRecord> {
  const [poolsResult, settlementResult] = await Promise.allSettled([
    getOpenPoolAggregate(chainId),
    getConfirmedSettlementAggregate(chainId),
  ]);
  if (poolsResult.status === "rejected") warnUnavailable("commitmentPools", poolsResult.reason);
  if (settlementResult.status === "rejected") {
    warnUnavailable("confirmedSettlement", settlementResult.reason);
  }

  const providersResult =
    poolsResult.status === "fulfilled"
      ? await Promise.allSettled([
          getOpenPoolDistinctProviderCount(chainId, poolsResult.value.openPoolIds),
        ]).then(([result]) => result)
      : null;
  if (providersResult?.status === "rejected") {
    warnUnavailable("distinctProviders", providersResult.reason);
  }

  const unavailableSources: PublicCommitmentImpactUnavailableSources = {
    commitmentPools: poolsResult.status === "rejected",
    distinctProviders: providersResult === null || providersResult.status === "rejected",
    confirmedSettlement: settlementResult.status === "rejected",
  };
  const poolAggregate = poolsResult.status === "fulfilled" ? poolsResult.value : null;
  return {
    openPoolCount: poolAggregate?.openPoolCount ?? null,
    commitmentsFulfilled: poolAggregate?.commitmentsFulfilled ?? null,
    commitmentsDue: poolAggregate?.commitmentsDue ?? null,
    distinctProviderCount: providersResult?.status === "fulfilled" ? providersResult.value : null,
    confirmedDisbursementTotal:
      settlementResult.status === "fulfilled" ? settlementResult.value : null,
    partialData: Object.values(unavailableSources).some(Boolean),
    unavailableSources,
  };
}
