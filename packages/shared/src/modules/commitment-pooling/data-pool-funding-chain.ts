import type { PublicClient } from "viem";

import { createPublicClientForChain } from "../../config/pimlico";
import type { Address } from "../../types/domain";
import {
  allowanceTuple,
  BOOLEAN_PAUSED_ABI,
  EXECUTOR_ABI,
  GOOD_DOLLAR_ABI,
  type PoolFundingLiveRoute,
  periodSpendTuple,
  ROLES_ALLOWANCE_ABI,
  routeTuple,
  settledRead,
} from "./data-pool-funding-chain-support";
import type { PoolFundingLedger } from "./data-pool-funding-indexed";
import { type PoolFundingBalanceRead, type PoolFundingFeeQuote } from "./pool-funding";
import { calculateEffectiveZodiacAllowance } from "./pool-funding-calculations";

const FEE_QUOTE_CONCURRENCY = 8;

interface DirectReadResult {
  balance: PoolFundingBalanceRead | null;
  sourcePaused: boolean | null;
  executorPaused: boolean | null;
  tokenPaused: boolean | null;
  liveRoute: PoolFundingLiveRoute | null;
  feePolicy: { maxFeeBps: number; maxFeeAmount: bigint } | null;
  feeQuotes: PoolFundingFeeQuote[];
  rolesAllowanceRemaining: bigint | null;
  periodAllowanceRemaining: bigint | null;
  maxTransferAmount: bigint | null;
  maxBatchAmount: bigint | null;
  batchSizeLimit: number | null;
  nativeFeeBalance: bigint | null;
  acknowledgmentFeeReserveLow: boolean | null;
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
      acknowledgmentFeeReserveLow: null,
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
    acknowledgmentFeeReserveLow,
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
    settledRead(
      celoClient.readContract({
        address: executor.localContract,
        abi: EXECUTOR_ABI,
        functionName: "isAcknowledgmentFeeReserveLow",
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
  const chainTimestamp = block ? BigInt(block.timestamp) : null;
  const maxPeriodAmount = typeof maxPeriod === "bigint" ? maxPeriod : null;
  const duration = typeof periodDuration === "bigint" ? periodDuration : null;
  const spendExpired = Boolean(
    spend &&
      duration !== null &&
      chainTimestamp !== null &&
      chainTimestamp >= spend.periodStartedAt + duration
  );
  const periodAllowanceRemaining =
    maxPeriodAmount === null || !spend || chainTimestamp === null
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
  const indexedDisbursementIds = new Set(
    ledger.disbursements.map((row) => row.disbursementId.toString())
  );
  const knownTransfers = [
    ...ledger.disbursements
      .filter((row) => openDisbursementIds.has(row.disbursementId.toString()))
      .map((row) => ({ id: row.id, amount: row.amount, recipient: row.recipient })),
    ...ledger.payoutPlans
      .filter((plan) => plan.finalized)
      .flatMap((plan) => plan.rows)
      .filter(
        (row) =>
          row.disbursementId === null || !indexedDisbursementIds.has(row.disbursementId.toString())
      )
      .map((row) => ({ id: row.id, amount: row.amount, recipient: row.recipient })),
  ];
  const feeQuotes: PoolFundingFeeQuote[] = [];
  for (let start = 0; start < knownTransfers.length; start += FEE_QUOTE_CONCURRENCY) {
    const batch = await Promise.all(
      knownTransfers
        .slice(start, start + FEE_QUOTE_CONCURRENCY)
        .map(async (row): Promise<PoolFundingFeeQuote> => {
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
    feeQuotes.push(...batch);
  }

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
    rolesAllowanceRemaining:
      allowance && chainTimestamp !== null
        ? calculateEffectiveZodiacAllowance(allowance, chainTimestamp)
        : null,
    periodAllowanceRemaining,
    maxTransferAmount: typeof maxTransfer === "bigint" ? maxTransfer : null,
    maxBatchAmount: typeof maxBatch === "bigint" ? maxBatch : null,
    batchSizeLimit:
      typeof maxBatchSize === "number" || typeof maxBatchSize === "bigint"
        ? Number(maxBatchSize)
        : null,
    nativeFeeBalance: typeof nativeFeeBalance === "bigint" ? nativeFeeBalance : null,
    acknowledgmentFeeReserveLow:
      typeof acknowledgmentFeeReserveLow === "boolean" ? acknowledgmentFeeReserveLow : null,
  };
}
