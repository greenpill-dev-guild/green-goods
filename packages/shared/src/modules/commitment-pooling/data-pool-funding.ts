import type { PublicClient } from "viem";

import type { Address } from "../../types/domain";
import type { GraphQLReader } from "../data/graphql-client";
import { readPoolFundingChain } from "./data-pool-funding-chain";
import { getPoolFundingLedger, type PoolFundingLedger } from "./data-pool-funding-indexed";
import {
  type PoolFundingCalculationInput,
  type PoolFundingSnapshot,
  selectPoolFundingSnapshot,
} from "./pool-funding";

const LEDGER_MAX_AGE_SECONDS = 120;

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
    acknowledgmentFeeReserveLow: null,
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
    routeAddresses: { account: indexedSafe, indexed: indexedRouteSafe, live: liveSafe },
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
    acknowledgmentFeeReserveLow: direct.acknowledgmentFeeReserveLow,
  });
}
