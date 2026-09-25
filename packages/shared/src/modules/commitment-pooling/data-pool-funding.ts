import type { PublicClient } from "viem";

import { createPublicClientForChain } from "../../config/pimlico";
import type { Address } from "../../types/domain";
import type { GraphQLReader } from "../data/graphql-client";
import { readPoolFundingChain } from "./data-pool-funding-chain";
import {
  LEDGER_MAX_AGE_SECONDS,
  ledgerAgeSeconds,
  readProcessedBlockTimestamps,
} from "./data-pool-funding-freshness";
import { getPoolFundingLedger, type PoolFundingLedger } from "./data-pool-funding-indexed";
import { type PoolFundingSnapshot, selectPoolFundingSnapshot } from "./pool-funding";

/** One client per chain for the whole snapshot, however many reads share it. */
function memoizeClients(
  createClient: (chainId: number) => PublicClient
): (chainId: number) => PublicClient {
  const clients = new Map<number, PublicClient>();
  return (chainId) => {
    const existing = clients.get(chainId);
    if (existing) return existing;
    const client = createClient(chainId);
    clients.set(chainId, client);
    return client;
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
  const ledger: PoolFundingLedger = await getPoolFundingLedger(
    sourceChainId,
    garden,
    options.reader,
    now
  );
  const client = memoizeClients(
    options.createClient ?? (createPublicClientForChain as (chainId: number) => PublicClient)
  );
  const [direct, processedTimestamps] = await Promise.all([
    readPoolFundingChain(ledger, garden, client, now),
    ledger.processedBlocks
      ? readProcessedBlockTimestamps(ledger.processedBlocks, client)
      : Promise.resolve(null),
  ]);
  // The ledger is current when every chain it spans was processed within
  // the last two minutes, read from the processed blocks themselves.
  const ledgerAge = processedTimestamps ? ledgerAgeSeconds(processedTimestamps, now) : null;
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
  return selectPoolFundingSnapshot({
    safe: routeMatches ? indexedSafe : null,
    routeAddresses: { account: indexedSafe, indexed: indexedRouteSafe, live: liveSafe },
    token: ledger.executorConfiguration?.gDollarToken ?? null,
    balance: routeMatches ? direct.balance : null,
    ledgerReadAt: ledger.readAt,
    ledgerFresh: ledgerAge !== null && ledgerAge <= LEDGER_MAX_AGE_SECONDS,
    ledgerAvailable:
      ledger.coherent &&
      ledger.processedBlocks !== null &&
      processedTimestamps !== null &&
      processedTimestamps.every((timestamp) => timestamp !== null),
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
    acknowledgmentFeeReserveLow: direct.acknowledgmentFeeReserveLow,
  });
}
