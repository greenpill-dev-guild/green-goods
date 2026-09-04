import type { Address } from "../../types/domain";

export type PoolFundingState = "unavailable" | "insufficient" | "low" | "healthy" | "no-demand";

export type SettlementReadiness = "ready" | "unavailable";

export type PoolFundingUnavailableReason =
  | "missing_account"
  | "inactive_account"
  | "missing_route"
  | "inactive_route"
  | "route_mismatch"
  | "balance_unreadable"
  | "ledger_unavailable"
  | "ledger_stale"
  | "ledger_inconsistent"
  | "fee_policy_unavailable";

export type SettlementUnavailableReason =
  | PoolFundingUnavailableReason
  | "source_paused"
  | "executor_paused"
  | "token_paused"
  | "fee_quote_unavailable"
  | "receiver_paid_fee"
  | "fee_policy_breach"
  | "source_unreadable"
  | "executor_unreadable"
  | "token_unreadable"
  | "allowance_unreadable"
  | "period_unreadable"
  | "caps_unreadable"
  | "roles_allowance_exhausted"
  | "roles_allowance_insufficient"
  | "period_allowance_exhausted"
  | "period_allowance_insufficient"
  | "transfer_cap_exceeded"
  | "batch_cap_exceeded"
  | "batch_size_exceeded"
  | "insufficient_authorized_balance"
  | "acknowledgment_reserve_low"
  | "acknowledgment_reserve_unreadable";

export interface PoolFundingBalanceRead {
  value: bigint;
  blockNumber: bigint;
  blockTimestamp: number;
  readAt: number;
}

export interface PoolFundingFeePolicy {
  maxFeeBps: number;
  maxFeeAmount: bigint;
}

export interface PoolFundingFeeQuote {
  id: string;
  amount: bigint;
  fee: bigint | null;
  senderPays: boolean | null;
  recipient: Address | null;
}

export interface PoolFundingExecution {
  executionKey: `0x${string}`;
  status: string;
  createdAt: number;
  acknowledgmentSent: boolean;
}

export type PoolFundingDisbursementState =
  | "UNKNOWN"
  | "QUEUED"
  | "DISPATCHED"
  | "CONFIRMED"
  | "FAILED"
  | "CANCELLED";

export interface PoolFundingDisbursement {
  id: string;
  disbursementId: bigint;
  commitmentId: bigint | null;
  payoutPlanId: bigint | null;
  fundingId: bigint | null;
  batchId?: bigint | null;
  kind: string;
  source: Address;
  recipient: Address;
  amount: bigint;
  state: PoolFundingDisbursementState;
  executionKey: `0x${string}` | null;
}

export interface PoolFundingPayoutRow {
  id: string;
  amount: bigint;
  recipient: Address;
  disbursementId: bigint | null;
}

export interface PoolFundingPayoutPlan {
  id: string;
  payoutPlanId: bigint;
  commitmentId: bigint;
  finalized: boolean;
  rows: PoolFundingPayoutRow[];
}

export interface PoolFundingCommitment {
  id: string;
  commitmentId: bigint;
  state: string;
  considerationRail: string | null;
  considerationAmount: bigint | null;
  considerationPaid: boolean;
  consumedFundingId?: bigint | null;
}

export interface PoolFundingDeposit {
  id: string;
  fundingId: bigint;
  commitmentId: bigint | null;
  depositedAmount: bigint;
  state: string;
}

export interface PoolFundingObligationGroup {
  id: string;
  kind: "plan" | "funding" | "standalone" | "expected";
  commitmentId: bigint | null;
  netAmount: bigint;
  feeBuffer: bigint;
  inTransit: boolean;
}

export interface PoolFundingTransit {
  dispatched: bigint;
  executedAwaitingConfirmation: bigint;
  incoming: bigint;
}

export interface ZodiacAllowance {
  refill: bigint;
  maxRefill: bigint;
  period: bigint;
  balance: bigint;
  timestamp: bigint;
}

export interface PoolFundingLimits {
  rolesAllowanceRemaining: bigint | null;
  periodAllowanceRemaining: bigint | null;
  maxTransferAmount: bigint | null;
  maxBatchAmount: bigint | null;
  batchSizeLimit: number | null;
}

export interface PoolFundingReadinessInput {
  accountConfigured: boolean;
  accountActive: boolean;
  routeConfigured: boolean;
  routeActive: boolean;
  routeMatches: boolean;
  sourcePaused: boolean | null;
  executorPaused: boolean | null;
  tokenPaused: boolean | null;
}

export interface PoolFundingCalculationInput {
  safe: Address | null;
  routeAddresses?: {
    account: Address | null;
    indexed: Address | null;
    live: Address | null;
  };
  token: Address | null;
  balance: PoolFundingBalanceRead | null;
  ledgerReadAt: number | null;
  ledgerFresh: boolean;
  ledgerAvailable: boolean;
  feePolicy: PoolFundingFeePolicy | null;
  feeQuotes: PoolFundingFeeQuote[];
  commitments: PoolFundingCommitment[];
  payoutPlans: PoolFundingPayoutPlan[];
  fundings: PoolFundingDeposit[];
  disbursements: PoolFundingDisbursement[];
  executions: PoolFundingExecution[];
  readiness: PoolFundingReadinessInput;
  limits: PoolFundingLimits;
  nativeFeeBalance: bigint | null;
  acknowledgmentFeeReserveLow: boolean | null;
}

export interface PoolFundingSnapshot {
  safe: Address | null;
  routeAddresses: {
    account: Address | null;
    indexed: Address | null;
    live: Address | null;
  };
  token: Address | null;
  balance: PoolFundingBalanceRead | null;
  ledgerReadAt: number | null;
  committed: bigint | null;
  expected: bigint | null;
  authorizedFeeBuffer: bigint | null;
  expectedFeeBuffer: bigint | null;
  feeBuffer: bigint | null;
  quotedFees: bigint | null;
  feeQuotes: PoolFundingFeeQuote[];
  available: bigint | null;
  shortfall: bigint | null;
  suggestedTopUp: bigint | null;
  fundingState: PoolFundingState;
  fundingUnavailableReasons: PoolFundingUnavailableReason[];
  settlementReadiness: SettlementReadiness;
  settlementUnavailableReasons: SettlementUnavailableReason[];
  obligations: PoolFundingObligationGroup[];
  transit: PoolFundingTransit;
  /** Indexed settlement rows touching this Safe, retained for steward operations. */
  disbursements: PoolFundingDisbursement[];
  /** Indexed execution outcomes used to distinguish dispatch from acknowledgement pending. */
  executions: PoolFundingExecution[];
  limits: PoolFundingLimits;
  nativeFeeBalance: bigint | null;
}

export {
  calculateEffectiveZodiacAllowance,
  calculateKnownTransferFeeBuffer,
  calculateUnknownSplitFeeBuffer,
} from "./pool-funding-calculations";
export { selectPoolFundingSnapshot } from "./pool-funding-selector";
