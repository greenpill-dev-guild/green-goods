import { valueFundingReceiptsUsdCents } from "./funding-valuation";
import { logger } from "../app/logger";
import { greenGoodsIndexer } from "../data/graphql-client";
import { integer, type RawRow } from "./data-core";

import type {
  PublicCommitmentImpactRecord,
  PublicCommitmentImpactUnavailableSources,
} from "../../public-contracts/commitment-impact";
export type {
  PublicCommitmentImpactRecord,
  PublicCommitmentImpactUnavailableSources,
} from "../../public-contracts/commitment-impact";

interface PublicImpactPoolAggregate {
  commitmentsMade: bigint;
  commitmentsFulfilled: bigint;
}

const FUNDING_PAGE_SIZE = 100;
const FUNDING_RECEIPT_LIMIT = 1000;

async function getPoolAggregate(chainId: number): Promise<PublicImpactPoolAggregate> {
  const query = `query PublicCommitmentImpactPools($chainId: Int!) {
    CommitmentPool_aggregate(where: { chainId: { _eq: $chainId }, registrationSeen: { _eq: true } }) {
      aggregate { sum { commitmentsOffered commitmentsRequested commitmentsFulfilled } }
    }
  }`;
  const result = await greenGoodsIndexer.query<{
    CommitmentPool_aggregate?: { aggregate?: RawRow | null };
  }>(query, { chainId }, "getPublicCommitmentImpactPools");
  if (result.error) throw result.error;
  const aggregate = result.data?.CommitmentPool_aggregate?.aggregate;
  if (!aggregate) throw new Error("Commitment pool aggregate is unavailable");
  const sum = (aggregate.sum ?? {}) as RawRow;
  return {
    commitmentsMade: integer(sum.commitmentsOffered) + integer(sum.commitmentsRequested),
    commitmentsFulfilled: integer(sum.commitmentsFulfilled),
  };
}

/**
 * Funding received is G$ that reached a Garden: protocol → Garden funding and
 * payer-Garden → beneficiary-Garden payouts, and only once the Celo → Arbitrum
 * acknowledgment set the row to `CONFIRMED`. Contributor consideration, loan
 * principal, and refunds go to people, not Gardens, so they never join the
 * figure however confirmed they are.
 */
async function getConfirmedSettlementAggregate(chainId: number): Promise<{
  total: bigint;
  usdCents: bigint | null;
}> {
  const deadline = AbortSignal.timeout(30000);
  const filter = `chainId: { _eq: $chainId }, state: { _eq: CONFIRMED },
    kind: { _in: [FUNDING, GARDEN_BENEFICIARY] }`;
  const query = `query PublicCommitmentImpactSettlement($chainId: Int!) {
    Disbursement_aggregate(where: { ${filter} }) {
      aggregate { sum { amount } }
    }
  }`;
  const result = await greenGoodsIndexer.query<{
    Disbursement_aggregate?: { aggregate?: RawRow | null };
  }>(query, { chainId }, "getPublicCommitmentImpactSettlement");
  if (result.error) throw result.error;
  const aggregate = result.data?.Disbursement_aggregate?.aggregate;
  if (!aggregate) throw new Error("Confirmed settlement aggregate is unavailable");
  const total = integer(((aggregate.sum ?? {}) as RawRow).amount);
  if (total === 0n) return { total, usdCents: 0n };
  try {
    const receipts: { amount: bigint; token: string; receivedAt: number }[] = [];
    let after = "";
    while (true) {
      deadline.throwIfAborted();
      const page = await greenGoodsIndexer.query<{ Disbursement?: RawRow[] }>(
        `query PublicCommitmentFundingReceipts($chainId: Int!, $after: String!) {
          Disbursement(where: { ${filter}, id: { _gt: $after } }, order_by: { id: asc }, limit: ${FUNDING_PAGE_SIZE}) {
            id amount token executionKey
          }
        }`,
        { chainId, after },
        "getPublicCommitmentFundingReceipts"
      );
      if (page.error) throw page.error;
      if (!page.data?.Disbursement) throw new Error("Funding receipts are unavailable");
      const rows = page.data.Disbursement;
      if (receipts.length + rows.length > FUNDING_RECEIPT_LIMIT) {
        throw new Error("Funding history exceeds the public valuation limit");
      }
      if (rows.length === 0) break;
      const executionKeys = [
        ...new Set(
          rows.map((row) => {
            if (
              typeof row.executionKey !== "string" ||
              !/^0x[0-9a-f]{64}$/i.test(row.executionKey)
            ) {
              throw new Error("Funding receipt has no execution key");
            }
            return row.executionKey.toLowerCase();
          })
        ),
      ];
      deadline.throwIfAborted();
      const executions = await greenGoodsIndexer.query<{ SettlementExecution?: RawRow[] }>(
        `query PublicCommitmentFundingExecutions($chainId: Int!, $executionKeys: [String!]!) {
          SettlementExecution(where: {
            chainId: { _eq: 42220 }, sourceChainId: { _eq: $chainId },
            status: { _eq: SUCCESS }, executionKey: { _in: $executionKeys }
          }, limit: ${FUNDING_PAGE_SIZE}) { executionKey txHash createdAt }
        }`,
        { chainId, executionKeys },
        "getPublicCommitmentFundingExecutions"
      );
      if (executions.error) throw executions.error;
      if (!executions.data?.SettlementExecution)
        throw new Error("Funding executions are unavailable");
      const receivedAtByKey = new Map<string, number>();
      for (const execution of executions.data.SettlementExecution) {
        if (
          typeof execution.executionKey !== "string" ||
          typeof execution.txHash !== "string" ||
          !/^0x[0-9a-f]{64}$/i.test(execution.txHash) ||
          typeof execution.createdAt !== "number" ||
          !Number.isSafeInteger(execution.createdAt) ||
          execution.createdAt <= 0
        )
          throw new Error("Funding execution is incomplete");
        const key = execution.executionKey.toLowerCase();
        if (receivedAtByKey.has(key)) throw new Error("Funding execution is ambiguous");
        receivedAtByKey.set(key, execution.createdAt);
      }
      for (const row of rows) {
        if (typeof row.id !== "string" || row.id <= after || typeof row.token !== "string") {
          throw new Error("Funding receipt is incomplete");
        }
        const receivedAt = receivedAtByKey.get(String(row.executionKey).toLowerCase());
        if (receivedAt === undefined) throw new Error("Confirmed funding execution is missing");
        after = row.id;
        receipts.push({ amount: integer(row.amount), token: row.token, receivedAt });
      }
      if (rows.length < FUNDING_PAGE_SIZE) break;
    }
    if (receipts.reduce((sum, receipt) => sum + receipt.amount, 0n) !== total) {
      throw new Error("Funding receipt history does not match its aggregate");
    }
    return { total, usdCents: await valueFundingReceiptsUsdCents(receipts, undefined, deadline) };
  } catch (error) {
    warnUnavailable("fundingValuation", error);
    return { total, usdCents: null };
  }
}

function warnUnavailable(source: string, error: unknown): void {
  logger.warn("[getPublicCommitmentImpact] Public impact source is unavailable", { source, error });
}

export async function getPublicCommitmentImpact(
  chainId: number
): Promise<PublicCommitmentImpactRecord> {
  const [poolsResult, settlementResult] = await Promise.allSettled([
    getPoolAggregate(chainId),
    getConfirmedSettlementAggregate(chainId),
  ]);
  if (poolsResult.status === "rejected") warnUnavailable("commitmentPools", poolsResult.reason);
  if (settlementResult.status === "rejected") {
    warnUnavailable("confirmedSettlement", settlementResult.reason);
  }

  const unavailableSources: PublicCommitmentImpactUnavailableSources = {
    commitmentPools: poolsResult.status === "rejected",
    confirmedSettlement: settlementResult.status === "rejected",
    fundingValuation:
      settlementResult.status === "rejected" || settlementResult.value.usdCents === null,
  };
  const poolAggregate = poolsResult.status === "fulfilled" ? poolsResult.value : null;
  return {
    commitmentsMade: poolAggregate?.commitmentsMade ?? null,
    commitmentsFulfilled: poolAggregate?.commitmentsFulfilled ?? null,
    confirmedDisbursementTotal:
      settlementResult.status === "fulfilled" ? settlementResult.value.total : null,
    confirmedDisbursementUsdCents:
      settlementResult.status === "fulfilled" ? settlementResult.value.usdCents : null,
    partialData: Object.values(unavailableSources).some(Boolean),
    unavailableSources,
  };
}
