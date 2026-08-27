import type { Address } from "../../types/domain";
import { type GraphQLReader, greenGoodsIndexer } from "../data/graphql-client";
import { address, integer, number, optionalInteger, type RawRow } from "./data-core";
import {
  type FundingPage,
  queryCaughtUpAt,
  queryExecutions,
  queryExecutorConfiguration,
  queryFundingPages,
  queryPayoutRows,
  queryPoolFundingHeader,
} from "./data-pool-funding-indexed-queries";
import {
  mapSettlementAccount,
  mapSettlementConfiguration,
  mapSettlementGardenRoute,
} from "./data-settlement-mappers";
import type {
  PoolFundingCommitment,
  PoolFundingDeposit,
  PoolFundingDisbursement,
  PoolFundingExecution,
  PoolFundingPayoutPlan,
} from "./pool-funding";
import type {
  SettlementAccountRecord,
  SettlementConfigurationRecord,
  SettlementGardenRouteRecord,
} from "./types-settlement";

export interface PoolFundingLedger {
  account: SettlementAccountRecord | null;
  route: SettlementGardenRouteRecord | null;
  sourceConfiguration: SettlementConfigurationRecord | null;
  executorConfiguration: SettlementConfigurationRecord | null;
  commitments: PoolFundingCommitment[];
  payoutPlans: PoolFundingPayoutPlan[];
  fundings: PoolFundingDeposit[];
  disbursements: PoolFundingDisbursement[];
  executions: PoolFundingExecution[];
  caughtUpAt: number | null;
  readAt: number;
  coherent: boolean;
}

function normalizeDisbursement(row: RawRow): PoolFundingDisbursement | null {
  const source = address(row.source);
  const recipient = address(row.recipient);
  if (!source || !recipient) return null;
  return {
    id: String(row.id),
    disbursementId: integer(row.disbursementId),
    commitmentId: optionalInteger(row.commitmentId),
    payoutPlanId: optionalInteger(row.payoutPlanId),
    fundingId: optionalInteger(row.fundingId),
    batchId: optionalInteger(row.batchId),
    kind: String(row.kind),
    source,
    recipient,
    amount: integer(row.amount),
    state: String(row.state) as PoolFundingDisbursement["state"],
    executionKey:
      typeof row.executionKey === "string"
        ? (row.executionKey.toLowerCase() as `0x${string}`)
        : null,
  };
}

function mapPayoutPlans(
  planRows: RawRow[],
  payoutRows: RawRow[]
): { payoutPlans: PoolFundingPayoutPlan[]; coherent: boolean } {
  const payoutRowsByPlan = new Map<string, RawRow[]>();
  for (const row of payoutRows) {
    const key = integer(row.payoutPlanId).toString();
    payoutRowsByPlan.set(key, [...(payoutRowsByPlan.get(key) ?? []), row]);
  }
  let coherent = true;
  const payoutPlans = planRows.map((row): PoolFundingPayoutPlan => {
    const planId = integer(row.payoutPlanId);
    const contributorRows = payoutRowsByPlan.get(planId.toString()) ?? [];
    const rows = contributorRows.flatMap((payout) => {
      const recipient = address(payout.recipient);
      if (!recipient) {
        coherent = false;
        return [];
      }
      return [
        {
          id: String(payout.id),
          amount: integer(payout.amount),
          recipient,
          disbursementId: optionalInteger(payout.disbursementId),
        },
      ];
    });
    const beneficiaryAmount = integer(row.beneficiaryAmount);
    const beneficiary = address(row.beneficiaryRecipient);
    if (beneficiaryAmount > 0n && beneficiary) {
      rows.push({
        id: `${String(row.id)}:beneficiary`,
        amount: beneficiaryAmount,
        recipient: beneficiary,
        disbursementId: optionalInteger(row.beneficiaryDisbursementId),
      });
    } else if (beneficiaryAmount > 0n) {
      coherent = false;
    }
    if (row.finalized === true) {
      const contributorTotal = contributorRows.reduce(
        (sum, payout) => sum + integer(payout.amount),
        0n
      );
      const payableRows =
        contributorRows.filter((payout) => integer(payout.amount) > 0n).length +
        (beneficiaryAmount > 0n ? 1 : 0);
      if (
        contributorTotal !== integer(row.contributorPayoutTotal) ||
        integer(row.declaredAmount) !==
          integer(row.gardenRetainedAmount) + contributorTotal + beneficiaryAmount ||
        payableRows !== number(row.payablePayoutCount)
      ) {
        coherent = false;
      }
    }
    return {
      id: String(row.id),
      payoutPlanId: planId,
      commitmentId: integer(row.commitmentId),
      finalized: row.finalized === true,
      rows,
    };
  });
  return { payoutPlans, coherent };
}

function emptyPage(): FundingPage {
  return { Commitment: [], CommitmentPayoutPlan: [], CommitmentFunding: [], Disbursement: [] };
}

export async function getPoolFundingLedger(
  sourceChainId: number,
  garden: Address,
  reader: GraphQLReader = greenGoodsIndexer,
  now = Math.floor(Date.now() / 1_000)
): Promise<PoolFundingLedger> {
  const header = await queryPoolFundingHeader(reader, sourceChainId, garden);
  const account = header.SettlementAccount?.[0]
    ? mapSettlementAccount(header.SettlementAccount[0])
    : null;
  const route = header.SettlementGardenRoute?.[0]
    ? mapSettlementGardenRoute(header.SettlementGardenRoute[0])
    : null;
  const sourceConfiguration = header.SettlementConfiguration?.[0]
    ? mapSettlementConfiguration(header.SettlementConfiguration[0])
    : null;
  if (!account || !route || !sourceConfiguration?.remoteEvmChainId) {
    return {
      account,
      route,
      sourceConfiguration,
      executorConfiguration: null,
      commitments: [],
      payoutPlans: [],
      fundings: [],
      disbursements: [],
      executions: [],
      caughtUpAt: await queryCaughtUpAt(reader, [sourceChainId]),
      readAt: now,
      coherent: true,
    };
  }

  const executorChainId = sourceConfiguration.remoteEvmChainId;
  const [executorResult, pageResult, caughtUpAt] = await Promise.all([
    queryExecutorConfiguration(reader, executorChainId)
      .then((row) => ({ row, error: null }))
      .catch((error: unknown) => ({ row: null, error })),
    queryFundingPages(reader, sourceChainId, garden, route.safe)
      .then((page) => ({ page, error: null }))
      .catch((error: unknown) => ({ page: null, error })),
    queryCaughtUpAt(reader, [sourceChainId, executorChainId]),
  ]);
  const executorConfiguration = executorResult.row
    ? mapSettlementConfiguration(executorResult.row)
    : null;
  const page = pageResult.page ?? emptyPage();
  let coherent = pageResult.error === null && executorResult.error === null;
  const disbursements = page.Disbursement.flatMap((row) => {
    const mapped = normalizeDisbursement(row);
    if (!mapped) {
      coherent = false;
      return [];
    }
    return [mapped];
  });
  const executionKeys = disbursements.flatMap((row) =>
    row.executionKey === null ? [] : [row.executionKey]
  );
  const [payoutResult, executionResult] = await Promise.all([
    queryPayoutRows(
      reader,
      page.CommitmentPayoutPlan.map((row) => String(row.id))
    )
      .then((rows) => ({ rows, error: null }))
      .catch((error: unknown) => ({ rows: [], error })),
    queryExecutions(reader, executorChainId, executionKeys)
      .then((rows) => ({ rows, error: null }))
      .catch((error: unknown) => ({ rows: [], error })),
  ]);
  coherent &&= payoutResult.error === null && executionResult.error === null;
  const mappedPlans = mapPayoutPlans(page.CommitmentPayoutPlan, payoutResult.rows);
  coherent &&= mappedPlans.coherent;

  return {
    account,
    route,
    sourceConfiguration,
    executorConfiguration,
    commitments: page.Commitment.map((row) => ({
      id: String(row.id),
      commitmentId: integer(row.commitmentId),
      state: String(row.state),
      considerationRail: row.considerationRail ? String(row.considerationRail) : null,
      considerationAmount: optionalInteger(row.considerationAmount),
      considerationPaid: row.considerationPaid === true,
      consumedFundingId: optionalInteger(row.consumedFundingId),
    })),
    payoutPlans: mappedPlans.payoutPlans,
    fundings: page.CommitmentFunding.map((row) => ({
      id: String(row.id),
      fundingId: integer(row.fundingId),
      commitmentId: optionalInteger(row.commitmentId),
      depositedAmount: integer(row.depositedAmount),
      state: String(row.state),
    })),
    disbursements,
    executions: executionResult.rows.flatMap((row) =>
      typeof row.executionKey === "string"
        ? [
            {
              executionKey: row.executionKey.toLowerCase() as `0x${string}`,
              status: String(row.status),
              createdAt: number(row.createdAt),
              acknowledgmentSent: row.acknowledgmentSent === true,
            },
          ]
        : []
    ),
    caughtUpAt,
    readAt: now,
    coherent,
  };
}
