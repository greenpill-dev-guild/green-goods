import type { PublicClient } from "viem";

import type { Address } from "../../types/domain";
import { greenGoodsIndexer, type GraphQLReader } from "../data/graphql-client";
import { address, integer, number, optionalInteger, type RawRow } from "./data-core";
import { readPoolFundingChain } from "./data-pool-funding-chain";
import {
  mapSettlementAccount,
  mapSettlementConfiguration,
  mapSettlementGardenRoute,
} from "./data-settlement-mappers";
import type {
  SettlementAccountRecord,
  SettlementConfigurationRecord,
  SettlementGardenRouteRecord,
} from "./types-settlement";
import {
  selectPoolFundingSnapshot,
  type PoolFundingCalculationInput,
  type PoolFundingCommitment,
  type PoolFundingDeposit,
  type PoolFundingDisbursement,
  type PoolFundingExecution,
  type PoolFundingPayoutPlan,
  type PoolFundingSnapshot,
} from "./pool-funding";

const PAGE_SIZE = 200;
const LEDGER_MAX_AGE_SECONDS = 120;

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

interface FundingPage {
  Commitment: RawRow[];
  CommitmentPayoutPlan: RawRow[];
  CommitmentFunding: RawRow[];
  Disbursement: RawRow[];
  SettlementExecution: RawRow[];
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === "number")
    return value > 1_000_000_000_000 ? Math.floor(value / 1_000) : value;
  if (typeof value !== "string" || value.length === 0) return null;
  if (/^\d+$/.test(value)) return parseTimestamp(Number(value));
  const milliseconds = Date.parse(value);
  return Number.isNaN(milliseconds) ? null : Math.floor(milliseconds / 1_000);
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

async function queryFundingPages(
  reader: GraphQLReader,
  sourceChainId: number,
  garden: Address,
  safe: Address
): Promise<FundingPage> {
  const collected: FundingPage = {
    Commitment: [],
    CommitmentPayoutPlan: [],
    CommitmentFunding: [],
    Disbursement: [],
    SettlementExecution: [],
  };
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const query = `query PoolFundingPage($sourceChainId: Int!, $garden: String!, $safe: String!, $limit: Int!, $offset: Int!) {
      Commitment(where: { chainId: { _eq: $sourceChainId }, payerGarden: { _eq: $garden } }, order_by: { id: asc }, limit: $limit, offset: $offset) {
        id commitmentId state considerationRail considerationAmount considerationPaid consumedFundingId
      }
      CommitmentPayoutPlan(where: { chainId: { _eq: $sourceChainId }, payerGarden: { _eq: $garden } }, order_by: { id: asc }, limit: $limit, offset: $offset) {
        id payoutPlanId commitmentId finalized declaredAmount gardenRetainedAmount contributorPayoutTotal
        beneficiaryRecipient beneficiaryAmount beneficiaryDisbursementId payablePayoutCount contributorPayoutEntityIds
      }
      CommitmentFunding(where: { chainId: { _eq: $sourceChainId }, garden: { _eq: $garden } }, order_by: { id: asc }, limit: $limit, offset: $offset) {
        id fundingId commitmentId depositedAmount state
      }
      Disbursement(where: { chainId: { _eq: $sourceChainId }, _or: [{ source: { _eq: $safe } }, { recipient: { _eq: $safe } }] }, order_by: { id: asc }, limit: $limit, offset: $offset) {
        id disbursementId commitmentId payoutPlanId fundingId batchId kind source recipient amount state executionKey
      }
      SettlementExecution(where: { sourceChainId: { _eq: $sourceChainId }, executorGarden: { _eq: $garden } }, order_by: { id: asc }, limit: $limit, offset: $offset) {
        id executionKey status createdAt acknowledgmentSent
      }
    }`;
    const result = await reader.query<FundingPage>(
      query,
      {
        sourceChainId,
        garden: garden.toLowerCase(),
        safe: safe.toLowerCase(),
        limit: PAGE_SIZE,
        offset,
      },
      "getPoolFundingLedgerPage"
    );
    if (result.error) throw result.error;
    const page = result.data;
    for (const key of Object.keys(collected) as Array<keyof FundingPage>) {
      collected[key].push(...(page[key] ?? []));
    }
    if (
      (Object.keys(collected) as Array<keyof FundingPage>).every(
        (key) => (page[key]?.length ?? 0) < PAGE_SIZE
      )
    )
      break;
  }
  return collected;
}

async function queryPayoutRows(reader: GraphQLReader, ids: string[]): Promise<RawRow[]> {
  if (ids.length === 0) return [];
  const rows: RawRow[] = [];
  for (let start = 0; start < ids.length; start += PAGE_SIZE) {
    const query = `query PoolFundingPayoutRows($ids: [String!]!, $limit: Int!, $offset: Int!) {
      ContributorPayout(where: { payoutPlanEntityId: { _in: $ids } }, order_by: { id: asc }, limit: $limit, offset: $offset) {
        id payoutPlanId commitmentId recipient amount disbursementId
      }
    }`;
    const batch = ids.slice(start, start + PAGE_SIZE);
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const result = await reader.query<{ ContributorPayout: RawRow[] }>(
        query,
        { ids: batch, limit: PAGE_SIZE, offset },
        "getPoolFundingPayoutRows"
      );
      if (result.error) throw result.error;
      rows.push(...(result.data.ContributorPayout ?? []));
      if ((result.data.ContributorPayout?.length ?? 0) < PAGE_SIZE) break;
    }
  }
  return rows;
}

async function getPoolFundingLedger(
  sourceChainId: number,
  garden: Address,
  reader: GraphQLReader = greenGoodsIndexer,
  now = Math.floor(Date.now() / 1_000)
): Promise<PoolFundingLedger> {
  const normalizedGarden = garden.toLowerCase();
  const headerQuery = `query PoolFundingHeader($sourceChainId: Int!, $accountId: String!, $garden: String!) {
    SettlementAccount(where: { id: { _eq: $accountId } }, limit: 1) {
      id chainId garden gardenId accountChainId account active recoveryOwners rolesModifier roleKey allowanceKey permissionsConfigHash recoveryConfigHash recoveryThreshold updatedAt
    }
    SettlementGardenRoute(where: { sourceChainId: { _eq: $sourceChainId }, garden: { _eq: $garden } }, limit: 1) {
      id chainId sourceChainId garden gardenId settlementAccountId safe rolesModifier roleKey allowanceKey permissionsConfigHash active configuredAt updatedAt
    }
    SettlementConfiguration(where: { chainId: { _eq: $sourceChainId }, role: { _eq: "SOURCE" } }, limit: 1) {
      id chainId role gardenerDeliveryEnabled protocolGarden gDollarToken hatsModule commitmentPoolingModule localContract localRouter localChainSelector remoteChainSelector remoteEvmChainId destinationGasLimit activePeer previousPeer previousPeerExpiresAt protocolVersion dispatcher batchSizeLimit maxTransferAmount maxBatchAmount maxFeeBps maxFeeAmount periodDuration maxPeriodAmount feeReserveMinimum nativeFeeBalance feeReserveLow peerConfigured paused updatedAt
    }
  }`;
  // The account id is sourceChainId-garden, but querying by the explicit fields keeps
  // this read compatible with both current and replayed data.
  const metadataQuery = `query PoolFundingFreshness($sourceChainId: Int!) {
    chain_metadata(where: { chain_id: { _eq: $sourceChainId } }, limit: 1) {
      chain_id block_timestamp
    }
  }`;
  const [header, metadata] = await Promise.all([
    reader.query<{
      SettlementAccount: RawRow[];
      SettlementGardenRoute: RawRow[];
      SettlementConfiguration: RawRow[];
    }>(
      headerQuery,
      {
        sourceChainId,
        accountId: `${sourceChainId}-${normalizedGarden}`,
        garden: normalizedGarden,
      },
      "getPoolFundingHeader"
    ),
    reader.query<{ chain_metadata: RawRow[] }>(
      metadataQuery,
      { sourceChainId },
      "getPoolFundingFreshness"
    ),
  ]);
  if (header.error) throw header.error;
  const account = header.data.SettlementAccount?.[0]
    ? mapSettlementAccount(header.data.SettlementAccount[0])
    : null;
  const route = header.data.SettlementGardenRoute?.[0]
    ? mapSettlementGardenRoute(header.data.SettlementGardenRoute[0])
    : null;
  const sourceConfiguration = header.data.SettlementConfiguration?.[0]
    ? mapSettlementConfiguration(header.data.SettlementConfiguration[0])
    : null;
  const caughtUpAt = metadata.error
    ? null
    : parseTimestamp(metadata.data.chain_metadata?.[0]?.block_timestamp);
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
      caughtUpAt,
      readAt: now,
      coherent: true,
    };
  }

  const executorQuery = `query PoolFundingExecutorConfiguration($chainId: Int!) {
    SettlementConfiguration(where: { chainId: { _eq: $chainId }, role: { _eq: "EXECUTOR" } }, limit: 1) {
      id chainId role gardenerDeliveryEnabled protocolGarden gDollarToken hatsModule commitmentPoolingModule localContract localRouter localChainSelector remoteChainSelector remoteEvmChainId destinationGasLimit activePeer previousPeer previousPeerExpiresAt protocolVersion dispatcher batchSizeLimit maxTransferAmount maxBatchAmount maxFeeBps maxFeeAmount periodDuration maxPeriodAmount feeReserveMinimum nativeFeeBalance feeReserveLow peerConfigured paused updatedAt
    }
  }`;
  const [executorResult, pageResult] = await Promise.all([
    reader.query<{ SettlementConfiguration: RawRow[] }>(
      executorQuery,
      { chainId: sourceConfiguration.remoteEvmChainId },
      "getPoolFundingExecutorConfiguration"
    ),
    queryFundingPages(reader, sourceChainId, garden, route.safe)
      .then((page) => ({ page, error: null }))
      .catch((error: unknown) => ({ page: null, error })),
  ]);
  const executorConfiguration =
    !executorResult.error && executorResult.data.SettlementConfiguration?.[0]
      ? mapSettlementConfiguration(executorResult.data.SettlementConfiguration[0])
      : null;
  const page = pageResult.page ?? {
    Commitment: [],
    CommitmentPayoutPlan: [],
    CommitmentFunding: [],
    Disbursement: [],
    SettlementExecution: [],
  };
  let coherent = pageResult.error === null && !executorResult.error;
  let payoutRows: RawRow[] = [];
  try {
    payoutRows = await queryPayoutRows(
      reader,
      page.CommitmentPayoutPlan.map((row) => String(row.id))
    );
  } catch {
    coherent = false;
  }
  const payoutRowsByPlan = new Map<string, RawRow[]>();
  for (const row of payoutRows) {
    const key = integer(row.payoutPlanId).toString();
    payoutRowsByPlan.set(key, [...(payoutRowsByPlan.get(key) ?? []), row]);
  }
  const payoutPlans = page.CommitmentPayoutPlan.map((row): PoolFundingPayoutPlan => {
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
      if (
        contributorTotal !== integer(row.contributorPayoutTotal) ||
        integer(row.declaredAmount) !==
          integer(row.gardenRetainedAmount) + contributorTotal + beneficiaryAmount ||
        rows.length !== number(row.payablePayoutCount)
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
    payoutPlans,
    fundings: page.CommitmentFunding.map((row) => ({
      id: String(row.id),
      fundingId: integer(row.fundingId),
      commitmentId: optionalInteger(row.commitmentId),
      depositedAmount: integer(row.depositedAmount),
      state: String(row.state),
    })),
    disbursements: page.Disbursement.flatMap((row) => {
      const mapped = normalizeDisbursement(row);
      if (!mapped) {
        coherent = false;
        return [];
      }
      return [mapped];
    }),
    executions: page.SettlementExecution.flatMap((row) =>
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

function unavailableInput(): PoolFundingCalculationInput {
  return {
    safe: null,
    token: null,
    balance: null,
    ledgerReadAt: null,
    ledgerFresh: false,
    ledgerAvailable: false,
    feePolicy: null,
    feeQuotes: [],
    commitments: [],
    payoutPlans: [],
    fundings: [],
    disbursements: [],
    executions: [],
    readiness: {
      accountConfigured: false,
      accountActive: false,
      routeConfigured: false,
      routeActive: false,
      routeMatches: false,
      sourcePaused: null,
      executorPaused: null,
      tokenPaused: null,
    },
    limits: {
      rolesAllowanceRemaining: null,
      periodAllowanceRemaining: null,
      maxTransferAmount: null,
      maxBatchAmount: null,
      batchSizeLimit: null,
    },
    nativeFeeBalance: null,
  };
}

export async function getPoolFundingSnapshot(
  sourceChainId: number,
  garden: Address,
  options: {
    reader?: GraphQLReader;
    createClient?: (chainId: number) => PublicClient;
    now?: number;
  } = {}
): Promise<PoolFundingSnapshot> {
  const now = options.now ?? Math.floor(Date.now() / 1_000);
  let ledger: PoolFundingLedger;
  try {
    ledger = await getPoolFundingLedger(sourceChainId, garden, options.reader, now);
  } catch {
    return selectPoolFundingSnapshot(unavailableInput());
  }
  const direct = await readPoolFundingChain(ledger, garden, options.createClient, now);
  const indexedSafe = ledger.account?.account ?? null;
  const indexedRouteSafe = ledger.route?.safe ?? null;
  const liveSafe = direct.liveRoute?.safe ?? null;
  const routeMatches = Boolean(
    indexedSafe &&
      indexedRouteSafe &&
      liveSafe &&
      indexedSafe.toLowerCase() === indexedRouteSafe.toLowerCase() &&
      indexedSafe.toLowerCase() === liveSafe.toLowerCase()
  );
  const caughtUpAt = ledger.caughtUpAt;
  return selectPoolFundingSnapshot({
    safe: routeMatches ? indexedSafe : null,
    routeAddresses: {
      account: indexedSafe,
      indexed: indexedRouteSafe,
      live: liveSafe,
    },
    token: ledger.executorConfiguration?.gDollarToken ?? null,
    balance: routeMatches ? direct.balance : null,
    ledgerReadAt: ledger.readAt,
    ledgerFresh: caughtUpAt !== null && now - caughtUpAt <= LEDGER_MAX_AGE_SECONDS,
    ledgerAvailable: ledger.coherent && caughtUpAt !== null,
    feePolicy: direct.feePolicy,
    feeQuotes: direct.feeQuotes,
    commitments: ledger.commitments,
    payoutPlans: ledger.payoutPlans,
    fundings: ledger.fundings,
    disbursements: ledger.disbursements,
    executions: ledger.executions,
    readiness: {
      accountConfigured: ledger.account !== null,
      accountActive: ledger.account?.active ?? false,
      routeConfigured: ledger.route !== null && direct.liveRoute !== null,
      routeActive: Boolean(ledger.route?.active && direct.liveRoute?.active),
      routeMatches,
      sourcePaused: direct.sourcePaused,
      executorPaused: direct.executorPaused,
      tokenPaused: direct.tokenPaused,
    },
    limits: {
      rolesAllowanceRemaining: direct.rolesAllowanceRemaining,
      periodAllowanceRemaining: direct.periodAllowanceRemaining,
      maxTransferAmount: direct.maxTransferAmount,
      maxBatchAmount: direct.maxBatchAmount,
      batchSizeLimit: direct.batchSizeLimit,
    },
    nativeFeeBalance: direct.nativeFeeBalance,
  });
}
