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
  | "roles_allowance_exhausted"
  | "period_allowance_exhausted"
  | "transfer_cap_exceeded"
  | "batch_cap_exceeded";

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
  timestamp: bigint;
  balance: bigint;
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
  limits: PoolFundingLimits;
  nativeFeeBalance: bigint | null;
}

const EXPECTED_STATES = new Set(["ACCEPTED", "READY_FOR_CONFIRMATION", "FULFILLED", "DISPUTED"]);
const OPEN_FUNDING_STATES = new Set(["DEPOSIT_RECORDED", "CONSUMED", "REFUND_QUEUED"]);

function clampAtZero(value: bigint): bigint {
  return value > 0n ? value : 0n;
}

export function calculateKnownTransferFeeBuffer(
  amount: bigint,
  policy: PoolFundingFeePolicy
): bigint {
  const byBps = (amount * BigInt(policy.maxFeeBps)) / 10_000n;
  return byBps < policy.maxFeeAmount ? byBps : policy.maxFeeAmount;
}

export function calculateUnknownSplitFeeBuffer(
  amount: bigint,
  policy: PoolFundingFeePolicy
): bigint {
  return (amount * BigInt(policy.maxFeeBps)) / 10_000n;
}

export function calculateEffectiveZodiacAllowance(allowance: ZodiacAllowance, now: bigint): bigint {
  if (allowance.period === 0n || now < allowance.timestamp + allowance.period) {
    return allowance.balance;
  }
  const intervals = (now - allowance.timestamp) / allowance.period;
  const refilled = allowance.balance + allowance.refill * intervals;
  return refilled < allowance.maxRefill ? refilled : allowance.maxRefill;
}

function findExecution(
  disbursement: PoolFundingDisbursement,
  executions: PoolFundingExecution[]
): PoolFundingExecution | null {
  if (!disbursement.executionKey) return null;
  return (
    executions.find(
      (row) => row.executionKey.toLowerCase() === disbursement.executionKey?.toLowerCase()
    ) ?? null
  );
}

function isSuccessfulExecution(execution: PoolFundingExecution | null): boolean {
  return execution?.status.toUpperCase() === "SUCCESS";
}

function isExecutionReflected(
  execution: PoolFundingExecution | null,
  balance: PoolFundingBalanceRead | null
): boolean {
  return Boolean(
    isSuccessfulExecution(execution) &&
      balance &&
      balance.blockTimestamp > (execution?.createdAt ?? Number.MAX_SAFE_INTEGER)
  );
}

function financialUnavailableReasons(
  input: PoolFundingCalculationInput
): PoolFundingUnavailableReason[] {
  const reasons: PoolFundingUnavailableReason[] = [];
  if (!input.readiness.accountConfigured) return ["missing_account"];
  if (!input.readiness.accountActive) return ["inactive_account"];
  if (!input.readiness.routeConfigured) return ["missing_route"];
  if (!input.readiness.routeActive) reasons.push("inactive_route");
  if (!input.readiness.routeMatches) reasons.push("route_mismatch");
  if (input.readiness.routeActive && input.readiness.routeMatches) {
    if (!input.balance) reasons.push("balance_unreadable");
    if (!input.ledgerAvailable) reasons.push("ledger_unavailable");
    else if (!input.ledgerFresh) reasons.push("ledger_stale");
    if (!input.feePolicy) reasons.push("fee_policy_unavailable");
  }
  return reasons;
}

export function selectPoolFundingSnapshot(input: PoolFundingCalculationInput): PoolFundingSnapshot {
  const fundingUnavailableReasons = financialUnavailableReasons(input);
  const executionByDisbursement = new Map(
    input.disbursements.map((row) => [
      row.disbursementId.toString(),
      findExecution(row, input.executions),
    ])
  );
  const disbursementById = new Map(
    input.disbursements.map((row) => [row.disbursementId.toString(), row])
  );
  const groups: PoolFundingObligationGroup[] = [];
  let ledgerInconsistent = false;
  let dispatched = 0n;
  let executedAwaitingConfirmation = 0n;
  let incoming = 0n;

  const outstandingFor = (row: PoolFundingDisbursement, trackOutgoingTransit = true): bigint => {
    const execution = executionByDisbursement.get(row.disbursementId.toString()) ?? null;
    const reflected = isExecutionReflected(execution, input.balance);
    if (row.state === "CONFIRMED" && !isSuccessfulExecution(execution)) ledgerInconsistent = true;
    if (row.state === "CANCELLED" || row.state === "CONFIRMED" || reflected) {
      if (trackOutgoingTransit && reflected && row.state !== "CONFIRMED") {
        executedAwaitingConfirmation += row.amount;
      }
      return 0n;
    }
    if (trackOutgoingTransit && row.state === "DISPATCHED") dispatched += row.amount;
    return row.amount;
  };

  const finalizedCommitments = new Set<string>();
  const planAmounts = new Map<string, bigint>();
  const planFeeBuffers = new Map<string, bigint>();
  const planTransit = new Set<string>();
  for (const plan of input.payoutPlans) {
    if (!plan.finalized) continue;
    const commitmentKey = plan.commitmentId.toString();
    finalizedCommitments.add(commitmentKey);
    let amount = 0n;
    for (const payout of plan.rows) {
      const child = payout.disbursementId
        ? disbursementById.get(payout.disbursementId.toString())
        : null;
      const outstanding = child ? outstandingFor(child) : payout.amount;
      amount += outstanding;
      if (child?.state === "DISPATCHED" && outstanding > 0n) planTransit.add(commitmentKey);
      if (outstanding > 0n && input.feePolicy) {
        planFeeBuffers.set(
          commitmentKey,
          (planFeeBuffers.get(commitmentKey) ?? 0n) +
            calculateKnownTransferFeeBuffer(outstanding, input.feePolicy)
        );
      }
    }
    planAmounts.set(commitmentKey, (planAmounts.get(commitmentKey) ?? 0n) + amount);
  }

  const reflectedFundingDebits = new Map<string, bigint>();
  const consumedFundingByCommitment = new Map(
    input.commitments.flatMap((row) =>
      row.consumedFundingId === null || row.consumedFundingId === undefined
        ? []
        : [[row.commitmentId.toString(), row.consumedFundingId] as const]
    )
  );
  for (const row of input.disbursements) {
    if (row.source.toLowerCase() !== input.safe?.toLowerCase()) continue;
    const fundingId =
      row.fundingId ??
      (row.commitmentId === null
        ? null
        : (consumedFundingByCommitment.get(row.commitmentId.toString()) ?? null));
    if (fundingId === null) continue;
    const execution = executionByDisbursement.get(row.disbursementId.toString()) ?? null;
    if (isExecutionReflected(execution, input.balance)) {
      const key = fundingId.toString();
      reflectedFundingDebits.set(key, (reflectedFundingDebits.get(key) ?? 0n) + row.amount);
    }
  }

  const fundingAmounts = new Map<string, bigint>();
  for (const funding of input.fundings) {
    if (!OPEN_FUNDING_STATES.has(funding.state)) continue;
    const amount = clampAtZero(
      funding.depositedAmount - (reflectedFundingDebits.get(funding.fundingId.toString()) ?? 0n)
    );
    const key = funding.commitmentId?.toString() ?? `funding:${funding.fundingId}`;
    fundingAmounts.set(key, (fundingAmounts.get(key) ?? 0n) + amount);
  }

  const commitmentKeys = new Set([...planAmounts.keys(), ...fundingAmounts.keys()]);
  for (const key of commitmentKeys) {
    const planAmount = planAmounts.get(key) ?? 0n;
    const fundingAmount = fundingAmounts.get(key) ?? 0n;
    const amount = planAmount > fundingAmount ? planAmount : fundingAmount;
    if (amount === 0n) continue;
    groups.push({
      id: `commitment:${key}`,
      kind: planAmount >= fundingAmount && planAmount > 0n ? "plan" : "funding",
      commitmentId: key.startsWith("funding:") ? null : BigInt(key),
      netAmount: amount,
      feeBuffer: input.feePolicy
        ? planAmount >= fundingAmount && planAmount > 0n
          ? (planFeeBuffers.get(key) ?? 0n)
          : calculateUnknownSplitFeeBuffer(amount, input.feePolicy)
        : 0n,
      inTransit: planTransit.has(key),
    });
  }

  for (const row of input.disbursements) {
    const sourceMatches = row.source.toLowerCase() === input.safe?.toLowerCase();
    const recipientMatches = row.recipient.toLowerCase() === input.safe?.toLowerCase();
    if (recipientMatches && !sourceMatches && row.kind === "FUNDING") {
      incoming += outstandingFor(row, false);
      continue;
    }
    if (
      !sourceMatches ||
      row.payoutPlanId !== null ||
      row.commitmentId !== null ||
      row.fundingId !== null
    ) {
      continue;
    }
    const amount = outstandingFor(row);
    if (amount === 0n) continue;
    groups.push({
      id: `disbursement:${row.disbursementId}`,
      kind: "standalone",
      commitmentId: null,
      netAmount: amount,
      feeBuffer: input.feePolicy ? calculateKnownTransferFeeBuffer(amount, input.feePolicy) : 0n,
      inTransit: row.state === "DISPATCHED",
    });
  }

  for (const commitment of input.commitments) {
    if (
      commitment.considerationRail !== "CELO_SETTLEMENT" ||
      commitment.considerationPaid ||
      !EXPECTED_STATES.has(commitment.state) ||
      finalizedCommitments.has(commitment.commitmentId.toString()) ||
      !commitment.considerationAmount ||
      commitment.considerationAmount <= 0n
    ) {
      continue;
    }
    const feeBuffer = input.feePolicy
      ? calculateUnknownSplitFeeBuffer(commitment.considerationAmount, input.feePolicy)
      : 0n;
    groups.push({
      id: `expected:${commitment.commitmentId}`,
      kind: "expected",
      commitmentId: commitment.commitmentId,
      netAmount: commitment.considerationAmount,
      feeBuffer,
      inTransit: false,
    });
  }

  if (ledgerInconsistent) fundingUnavailableReasons.push("ledger_inconsistent");

  const committedGroups = groups.filter((row) => row.kind !== "expected");
  const expectedGroups = groups.filter((row) => row.kind === "expected");
  const committed = committedGroups.reduce((sum, row) => sum + row.netAmount, 0n);
  const expected = expectedGroups.reduce((sum, row) => sum + row.netAmount, 0n);
  const authorizedFeeBuffer = committedGroups.reduce((sum, row) => sum + row.feeBuffer, 0n);
  const expectedFeeBuffer = expectedGroups.reduce((sum, row) => sum + row.feeBuffer, 0n);
  const feeBuffer = authorizedFeeBuffer + expectedFeeBuffer;
  const quotedFees = input.feeQuotes.every((quote) => quote.fee !== null)
    ? input.feeQuotes.reduce((sum, quote) => sum + (quote.fee ?? 0n), 0n)
    : null;

  const settlementReasons = [...fundingUnavailableReasons] as SettlementUnavailableReason[];
  const routeReady =
    input.readiness.accountConfigured &&
    input.readiness.accountActive &&
    input.readiness.routeConfigured &&
    input.readiness.routeActive &&
    input.readiness.routeMatches;
  if (routeReady && input.readiness.sourcePaused) settlementReasons.push("source_paused");
  if (routeReady && input.readiness.sourcePaused === null)
    settlementReasons.push("source_unreadable");
  if (routeReady && input.readiness.executorPaused) settlementReasons.push("executor_paused");
  if (routeReady && input.readiness.executorPaused === null)
    settlementReasons.push("executor_unreadable");
  if (routeReady && input.readiness.tokenPaused) settlementReasons.push("token_paused");
  if (routeReady && input.readiness.tokenPaused === null)
    settlementReasons.push("token_unreadable");
  if (input.feeQuotes.some((quote) => quote.fee === null || quote.senderPays === null)) {
    settlementReasons.push("fee_quote_unavailable");
  }
  if (input.feeQuotes.some((quote) => quote.senderPays === false)) {
    settlementReasons.push("receiver_paid_fee");
  }
  if (
    input.feePolicy &&
    input.feeQuotes.some(
      (quote) =>
        quote.fee !== null &&
        quote.fee > calculateKnownTransferFeeBuffer(quote.amount, input.feePolicy!)
    )
  ) {
    settlementReasons.push("fee_policy_breach");
  }
  if (
    input.limits.rolesAllowanceRemaining !== null &&
    input.limits.rolesAllowanceRemaining === 0n
  ) {
    settlementReasons.push("roles_allowance_exhausted");
  }
  if (routeReady && input.limits.rolesAllowanceRemaining === null) {
    settlementReasons.push("allowance_unreadable");
  }
  if (
    input.limits.periodAllowanceRemaining !== null &&
    input.limits.periodAllowanceRemaining === 0n
  ) {
    settlementReasons.push("period_allowance_exhausted");
  }
  if (routeReady && input.limits.periodAllowanceRemaining === null) {
    settlementReasons.push("period_unreadable");
  }
  if (
    input.limits.maxTransferAmount !== null &&
    groups.some(
      (group) =>
        group.kind !== "expected" &&
        group.netAmount + group.feeBuffer > input.limits.maxTransferAmount!
    )
  ) {
    settlementReasons.push("transfer_cap_exceeded");
  }
  if (input.limits.maxBatchAmount !== null) {
    const batches = new Map<string, bigint>();
    for (const row of input.disbursements) {
      if (row.batchId === null || row.batchId === undefined) continue;
      if (row.source.toLowerCase() !== input.safe?.toLowerCase()) continue;
      const execution = executionByDisbursement.get(row.disbursementId.toString()) ?? null;
      if (
        row.state === "CANCELLED" ||
        row.state === "CONFIRMED" ||
        isExecutionReflected(execution, input.balance)
      ) {
        continue;
      }
      const gross =
        row.amount +
        (input.feePolicy ? calculateKnownTransferFeeBuffer(row.amount, input.feePolicy) : 0n);
      const key = row.batchId.toString();
      batches.set(key, (batches.get(key) ?? 0n) + gross);
    }
    if ([...batches.values()].some((amount) => amount > input.limits.maxBatchAmount!)) {
      settlementReasons.push("batch_cap_exceeded");
    }
  }

  const canDerive = fundingUnavailableReasons.length === 0 && input.balance !== null;
  const demand = committed + expected + feeBuffer;
  const authorizedDemand = committed + authorizedFeeBuffer;
  const available = canDerive ? clampAtZero(input.balance!.value - demand) : null;
  const shortfall = canDerive ? clampAtZero(authorizedDemand - input.balance!.value) : null;
  const suggestedTopUp = canDerive ? clampAtZero(demand - input.balance!.value) : null;
  let fundingState: PoolFundingState = "unavailable";
  if (canDerive) {
    if (demand === 0n) fundingState = "no-demand";
    else if (input.balance!.value < authorizedDemand) fundingState = "insufficient";
    else if (input.balance!.value < demand) fundingState = "low";
    else fundingState = "healthy";
  }

  return {
    safe: input.safe,
    routeAddresses: input.routeAddresses ?? {
      account: input.safe,
      indexed: input.safe,
      live: input.safe,
    },
    token: input.token,
    balance: input.balance,
    ledgerReadAt: input.ledgerReadAt,
    committed: canDerive ? committed : null,
    expected: canDerive ? expected : null,
    authorizedFeeBuffer: canDerive ? authorizedFeeBuffer : null,
    expectedFeeBuffer: canDerive ? expectedFeeBuffer : null,
    feeBuffer: canDerive ? feeBuffer : null,
    quotedFees,
    feeQuotes: input.feeQuotes,
    available,
    shortfall,
    suggestedTopUp,
    fundingState,
    fundingUnavailableReasons: [...new Set(fundingUnavailableReasons)],
    settlementReadiness: settlementReasons.length === 0 ? "ready" : "unavailable",
    settlementUnavailableReasons: [...new Set(settlementReasons)],
    obligations: groups,
    transit: { dispatched, executedAwaitingConfirmation, incoming },
    limits: input.limits,
    nativeFeeBalance: input.nativeFeeBalance,
  };
}
