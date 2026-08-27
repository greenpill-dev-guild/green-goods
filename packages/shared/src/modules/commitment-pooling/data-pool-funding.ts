import type { PublicClient } from "viem";

import { createPublicClientForChain } from "../../config/pimlico";
import type { Address } from "../../types/domain";
import { ERC20_BALANCE_ABI } from "../../utils/blockchain/abis/erc20";
import { greenGoodsIndexer, type GraphQLReader } from "../data/graphql-client";
import { address, integer, number, optionalInteger, type RawRow } from "./data-core";
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
  calculateEffectiveZodiacAllowance,
  selectPoolFundingSnapshot,
  type PoolFundingBalanceRead,
  type PoolFundingCalculationInput,
  type PoolFundingCommitment,
  type PoolFundingDeposit,
  type PoolFundingDisbursement,
  type PoolFundingExecution,
  type PoolFundingFeeQuote,
  type PoolFundingPayoutPlan,
  type PoolFundingSnapshot,
  type ZodiacAllowance,
} from "./pool-funding";

const PAGE_SIZE = 200;
const LEDGER_MAX_AGE_SECONDS = 120;

const BOOLEAN_PAUSED_ABI = [
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const GOOD_DOLLAR_ABI = [
  ...ERC20_BALANCE_ABI,
  ...BOOLEAN_PAUSED_ABI,
  {
    type: "function",
    name: "getFees",
    stateMutability: "view",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "sender", type: "address" },
      { name: "recipient", type: "address" },
    ],
    outputs: [
      { name: "fee", type: "uint256" },
      { name: "senderPays", type: "bool" },
    ],
  },
] as const;

const EXECUTOR_ABI = [
  ...BOOLEAN_PAUSED_ABI,
  {
    type: "function",
    name: "gardenRouteOf",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "safe", type: "address" },
          { name: "rolesModifier", type: "address" },
          { name: "roleKey", type: "bytes32" },
          { name: "allowanceKey", type: "bytes32" },
          { name: "permissionsConfigHash", type: "bytes32" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "gardenPeriodSpend",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "periodStartedAt", type: "uint64" },
          { name: "amount", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "maxTransferAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "maxBatchAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "maxBatchSize",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    type: "function",
    name: "maxFeeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    type: "function",
    name: "maxFeeAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "periodDuration",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "maxPeriodAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "nativeFeeBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const ROLES_ALLOWANCE_ABI = [
  {
    type: "function",
    name: "allowances",
    stateMutability: "view",
    inputs: [{ name: "key", type: "bytes32" }],
    outputs: [
      { name: "refill", type: "uint128" },
      { name: "maxRefill", type: "uint128" },
      { name: "period", type: "uint64" },
      { name: "timestamp", type: "uint64" },
      { name: "balance", type: "uint128" },
    ],
  },
] as const;

interface PoolFundingLedger {
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

interface DirectReadResult {
  balance: PoolFundingBalanceRead | null;
  sourcePaused: boolean | null;
  executorPaused: boolean | null;
  tokenPaused: boolean | null;
  liveRoute: {
    safe: Address;
    rolesModifier: Address;
    allowanceKey: `0x${string}`;
    active: boolean;
  } | null;
  feePolicy: { maxFeeBps: number; maxFeeAmount: bigint } | null;
  feeQuotes: PoolFundingFeeQuote[];
  rolesAllowanceRemaining: bigint | null;
  periodAllowanceRemaining: bigint | null;
  maxTransferAmount: bigint | null;
  maxBatchAmount: bigint | null;
  batchSizeLimit: number | null;
  nativeFeeBalance: bigint | null;
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

export async function getPoolFundingLedger(
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

function routeTuple(value: unknown): DirectReadResult["liveRoute"] {
  if (!value || (typeof value !== "object" && !Array.isArray(value))) return null;
  const tuple = value as {
    safe?: unknown;
    rolesModifier?: unknown;
    allowanceKey?: unknown;
    active?: unknown;
    0?: unknown;
    1?: unknown;
    3?: unknown;
    5?: unknown;
  };
  const safe = address(tuple.safe ?? tuple[0]);
  const rolesModifier = address(tuple.rolesModifier ?? tuple[1]);
  const allowanceKey = tuple.allowanceKey ?? tuple[3];
  if (!safe || !rolesModifier || typeof allowanceKey !== "string") return null;
  return {
    safe,
    rolesModifier,
    allowanceKey: allowanceKey.toLowerCase() as `0x${string}`,
    active: (tuple.active ?? tuple[5]) === true,
  };
}

function allowanceTuple(value: unknown): ZodiacAllowance | null {
  if (!value || (!Array.isArray(value) && typeof value !== "object")) return null;
  const row = value as {
    0?: unknown;
    1?: unknown;
    2?: unknown;
    3?: unknown;
    4?: unknown;
    refill?: unknown;
    maxRefill?: unknown;
    period?: unknown;
    timestamp?: unknown;
    balance?: unknown;
  };
  return {
    refill: integer(row.refill ?? row[0]),
    maxRefill: integer(row.maxRefill ?? row[1]),
    period: integer(row.period ?? row[2]),
    timestamp: integer(row.timestamp ?? row[3]),
    balance: integer(row.balance ?? row[4]),
  };
}

function periodSpendTuple(value: unknown): { periodStartedAt: bigint; amount: bigint } | null {
  if (!value || (!Array.isArray(value) && typeof value !== "object")) return null;
  const row = value as { 0?: unknown; 1?: unknown; periodStartedAt?: unknown; amount?: unknown };
  return {
    periodStartedAt: integer(row.periodStartedAt ?? row[0]),
    amount: integer(row.amount ?? row[1]),
  };
}

async function settledRead<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch {
    return null;
  }
}

export async function readPoolFundingChain(
  ledger: PoolFundingLedger,
  garden: Address,
  createClient: (chainId: number) => PublicClient = createPublicClientForChain as (
    chainId: number
  ) => PublicClient,
  now = Math.floor(Date.now() / 1_000)
): Promise<DirectReadResult> {
  const source = ledger.sourceConfiguration;
  const executor = ledger.executorConfiguration;
  const safe = ledger.route?.safe ?? ledger.account?.account ?? null;
  if (!source || !executor || !safe) {
    return {
      balance: null,
      sourcePaused: null,
      executorPaused: null,
      tokenPaused: null,
      liveRoute: null,
      feePolicy: null,
      feeQuotes: [],
      rolesAllowanceRemaining: null,
      periodAllowanceRemaining: null,
      maxTransferAmount: null,
      maxBatchAmount: null,
      batchSizeLimit: null,
      nativeFeeBalance: null,
    };
  }
  const sourceClient = createClient(source.chainId);
  const celoClient = createClient(executor.chainId);
  const blockNumber = await settledRead(celoClient.getBlockNumber());
  const block =
    blockNumber === null ? null : await settledRead(celoClient.getBlock({ blockNumber }));
  const [
    balanceValue,
    sourcePaused,
    executorPaused,
    tokenPaused,
    routeValue,
    feeBps,
    feeAmount,
    maxTransfer,
    maxBatch,
    maxBatchSize,
    periodDuration,
    maxPeriod,
    periodSpendValue,
    nativeFeeBalance,
  ] = await Promise.all([
    blockNumber === null
      ? Promise.resolve(null)
      : settledRead(
          celoClient.readContract({
            address: executor.gDollarToken,
            abi: GOOD_DOLLAR_ABI,
            functionName: "balanceOf",
            args: [safe],
            blockNumber,
          })
        ),
    settledRead(
      sourceClient.readContract({
        address: source.localContract,
        abi: BOOLEAN_PAUSED_ABI,
        functionName: "paused",
      })
    ),
    settledRead(
      celoClient.readContract({
        address: executor.localContract,
        abi: EXECUTOR_ABI,
        functionName: "paused",
      })
    ),
    settledRead(
      celoClient.readContract({
        address: executor.gDollarToken,
        abi: GOOD_DOLLAR_ABI,
        functionName: "paused",
      })
    ),
    settledRead(
      celoClient.readContract({
        address: executor.localContract,
        abi: EXECUTOR_ABI,
        functionName: "gardenRouteOf",
        args: [garden],
      })
    ),
    settledRead(
      celoClient.readContract({
        address: executor.localContract,
        abi: EXECUTOR_ABI,
        functionName: "maxFeeBps",
      })
    ),
    settledRead(
      celoClient.readContract({
        address: executor.localContract,
        abi: EXECUTOR_ABI,
        functionName: "maxFeeAmount",
      })
    ),
    settledRead(
      celoClient.readContract({
        address: executor.localContract,
        abi: EXECUTOR_ABI,
        functionName: "maxTransferAmount",
      })
    ),
    settledRead(
      celoClient.readContract({
        address: executor.localContract,
        abi: EXECUTOR_ABI,
        functionName: "maxBatchAmount",
      })
    ),
    settledRead(
      celoClient.readContract({
        address: executor.localContract,
        abi: EXECUTOR_ABI,
        functionName: "maxBatchSize",
      })
    ),
    settledRead(
      celoClient.readContract({
        address: executor.localContract,
        abi: EXECUTOR_ABI,
        functionName: "periodDuration",
      })
    ),
    settledRead(
      celoClient.readContract({
        address: executor.localContract,
        abi: EXECUTOR_ABI,
        functionName: "maxPeriodAmount",
      })
    ),
    settledRead(
      celoClient.readContract({
        address: executor.localContract,
        abi: EXECUTOR_ABI,
        functionName: "gardenPeriodSpend",
        args: [garden],
      })
    ),
    settledRead(
      celoClient.readContract({
        address: executor.localContract,
        abi: EXECUTOR_ABI,
        functionName: "nativeFeeBalance",
      })
    ),
  ]);
  const liveRoute = routeTuple(routeValue);
  const allowanceValue = liveRoute
    ? await settledRead(
        celoClient.readContract({
          address: liveRoute.rolesModifier,
          abi: ROLES_ALLOWANCE_ABI,
          functionName: "allowances",
          args: [liveRoute.allowanceKey],
        })
      )
    : null;
  const allowance = allowanceTuple(allowanceValue);
  const spend = periodSpendTuple(periodSpendValue);
  const maxPeriodAmount = typeof maxPeriod === "bigint" ? maxPeriod : null;
  const duration = typeof periodDuration === "bigint" ? periodDuration : null;
  const spendExpired = Boolean(
    spend && duration !== null && BigInt(now) >= spend.periodStartedAt + duration
  );
  const periodAllowanceRemaining =
    maxPeriodAmount === null || !spend
      ? null
      : spendExpired
        ? maxPeriodAmount
        : maxPeriodAmount > spend.amount
          ? maxPeriodAmount - spend.amount
          : 0n;
  const feePolicy =
    (typeof feeBps === "number" || typeof feeBps === "bigint") && typeof feeAmount === "bigint"
      ? { maxFeeBps: Number(feeBps), maxFeeAmount: feeAmount }
      : null;

  const openDisbursementIds = new Set(
    ledger.disbursements
      .filter(
        (row) =>
          row.source.toLowerCase() === safe.toLowerCase() &&
          row.state !== "CONFIRMED" &&
          row.state !== "CANCELLED"
      )
      .map((row) => row.disbursementId.toString())
  );
  const knownTransfers = [
    ...ledger.disbursements
      .filter((row) => openDisbursementIds.has(row.disbursementId.toString()))
      .map((row) => ({ id: row.id, amount: row.amount, recipient: row.recipient })),
    ...ledger.payoutPlans
      .filter((plan) => plan.finalized)
      .flatMap((plan) => plan.rows)
      .filter((row) => row.disbursementId === null)
      .map((row) => ({ id: row.id, amount: row.amount, recipient: row.recipient })),
  ];
  const feeQuotes = await Promise.all(
    knownTransfers.map(async (row): Promise<PoolFundingFeeQuote> => {
      const value = await settledRead(
        celoClient.readContract({
          address: executor.gDollarToken,
          abi: GOOD_DOLLAR_ABI,
          functionName: "getFees",
          args: [row.amount, safe, row.recipient],
        })
      );
      const tuple = value as readonly [bigint, boolean] | null;
      return {
        id: row.id,
        amount: row.amount,
        fee: tuple ? tuple[0] : null,
        senderPays: tuple ? tuple[1] : null,
        recipient: row.recipient,
      };
    })
  );

  return {
    balance:
      typeof balanceValue === "bigint" && blockNumber !== null && block
        ? {
            value: balanceValue,
            blockNumber,
            blockTimestamp: Number(block.timestamp),
            readAt: now,
          }
        : null,
    sourcePaused: typeof sourcePaused === "boolean" ? sourcePaused : null,
    executorPaused: typeof executorPaused === "boolean" ? executorPaused : null,
    tokenPaused: typeof tokenPaused === "boolean" ? tokenPaused : null,
    liveRoute,
    feePolicy,
    feeQuotes,
    rolesAllowanceRemaining: allowance
      ? calculateEffectiveZodiacAllowance(allowance, BigInt(now))
      : null,
    periodAllowanceRemaining,
    maxTransferAmount: typeof maxTransfer === "bigint" ? maxTransfer : null,
    maxBatchAmount: typeof maxBatch === "bigint" ? maxBatch : null,
    batchSizeLimit:
      typeof maxBatchSize === "number" || typeof maxBatchSize === "bigint"
        ? Number(maxBatchSize)
        : null,
    nativeFeeBalance: typeof nativeFeeBalance === "bigint" ? nativeFeeBalance : null,
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
