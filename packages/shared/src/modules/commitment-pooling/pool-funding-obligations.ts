import type {
  PoolFundingCalculationInput,
  PoolFundingDisbursement,
  PoolFundingExecution,
  PoolFundingObligationGroup,
  PoolFundingTransit,
} from "./pool-funding";
import {
  calculateKnownTransferFeeBuffer,
  calculateUnknownSplitFeeBuffer,
  clampPoolFundingAtZero,
} from "./pool-funding-calculations";

const EXPECTED_STATES = new Set(["ACCEPTED", "READY_FOR_CONFIRMATION", "FULFILLED", "DISPUTED"]);
const OPEN_FUNDING_STATES = new Set(["DEPOSIT_RECORDED", "CONSUMED", "REFUND_QUEUED"]);

export interface PendingSettlementTransfer {
  id: string;
  netAmount: bigint;
  feeBuffer: bigint;
  batchId: bigint | null;
}

export interface PoolFundingObligationDerivation {
  groups: PoolFundingObligationGroup[];
  transit: PoolFundingTransit;
  pendingTransfers: PendingSettlementTransfer[];
  ledgerInconsistent: boolean;
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
  input: PoolFundingCalculationInput
): boolean {
  return Boolean(
    isSuccessfulExecution(execution) &&
      input.balance &&
      input.balance.blockTimestamp > (execution?.createdAt ?? Number.MAX_SAFE_INTEGER)
  );
}

export function derivePoolFundingObligations(
  input: PoolFundingCalculationInput
): PoolFundingObligationDerivation {
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
  const pendingTransfers: PendingSettlementTransfer[] = [];
  let ledgerInconsistent = false;
  let dispatched = 0n;
  let executedAwaitingConfirmation = 0n;
  let incoming = 0n;

  const outstandingFor = (row: PoolFundingDisbursement, trackTransit = true): bigint => {
    const execution = executionByDisbursement.get(row.disbursementId.toString()) ?? null;
    const reflected = isExecutionReflected(execution, input);
    if (row.state === "CONFIRMED" && !isSuccessfulExecution(execution)) ledgerInconsistent = true;
    if (row.state === "CANCELLED" || row.state === "CONFIRMED" || reflected) {
      if (trackTransit && reflected && row.state !== "CONFIRMED") {
        executedAwaitingConfirmation += row.amount;
      }
      return 0n;
    }
    if (trackTransit && row.state === "DISPATCHED") dispatched += row.amount;
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
      if (outstanding <= 0n) continue;
      const feeBuffer = input.feePolicy
        ? calculateKnownTransferFeeBuffer(outstanding, input.feePolicy)
        : 0n;
      planFeeBuffers.set(commitmentKey, (planFeeBuffers.get(commitmentKey) ?? 0n) + feeBuffer);
      pendingTransfers.push({
        id: child?.id ?? payout.id,
        netAmount: outstanding,
        feeBuffer,
        batchId: child?.batchId ?? null,
      });
    }
    planAmounts.set(commitmentKey, (planAmounts.get(commitmentKey) ?? 0n) + amount);
  }

  const consumedFundingByCommitment = new Map(
    input.commitments.flatMap((row) =>
      row.consumedFundingId === null || row.consumedFundingId === undefined
        ? []
        : [[row.commitmentId.toString(), row.consumedFundingId] as const]
    )
  );
  const reflectedFundingDebits = new Map<string, bigint>();
  for (const row of input.disbursements) {
    if (row.source.toLowerCase() !== input.safe?.toLowerCase()) continue;
    const fundingId =
      row.fundingId ??
      (row.commitmentId === null
        ? null
        : (consumedFundingByCommitment.get(row.commitmentId.toString()) ?? null));
    if (fundingId === null) continue;
    const execution = executionByDisbursement.get(row.disbursementId.toString()) ?? null;
    if (isExecutionReflected(execution, input)) {
      const key = fundingId.toString();
      reflectedFundingDebits.set(key, (reflectedFundingDebits.get(key) ?? 0n) + row.amount);
    }
  }

  const fundingAmounts = new Map<string, bigint>();
  const openFundingCommitments = new Set<string>();
  for (const funding of input.fundings) {
    if (!OPEN_FUNDING_STATES.has(funding.state)) continue;
    const amount = clampPoolFundingAtZero(
      funding.depositedAmount - (reflectedFundingDebits.get(funding.fundingId.toString()) ?? 0n)
    );
    const key = funding.commitmentId?.toString() ?? `funding:${funding.fundingId}`;
    if (funding.commitmentId !== null) openFundingCommitments.add(key);
    fundingAmounts.set(key, (fundingAmounts.get(key) ?? 0n) + amount);
  }

  for (const key of new Set([...planAmounts.keys(), ...fundingAmounts.keys()])) {
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
    const feeBuffer = input.feePolicy
      ? calculateKnownTransferFeeBuffer(amount, input.feePolicy)
      : 0n;
    groups.push({
      id: `disbursement:${row.disbursementId}`,
      kind: "standalone",
      commitmentId: null,
      netAmount: amount,
      feeBuffer,
      inTransit: row.state === "DISPATCHED",
    });
    pendingTransfers.push({
      id: row.id,
      netAmount: amount,
      feeBuffer,
      batchId: row.batchId ?? null,
    });
  }

  for (const commitment of input.commitments) {
    const key = commitment.commitmentId.toString();
    if (
      commitment.considerationRail !== "CELO_SETTLEMENT" ||
      commitment.considerationPaid ||
      !EXPECTED_STATES.has(commitment.state) ||
      finalizedCommitments.has(key) ||
      openFundingCommitments.has(key) ||
      !commitment.considerationAmount ||
      commitment.considerationAmount <= 0n
    ) {
      continue;
    }
    groups.push({
      id: `expected:${commitment.commitmentId}`,
      kind: "expected",
      commitmentId: commitment.commitmentId,
      netAmount: commitment.considerationAmount,
      feeBuffer: input.feePolicy
        ? calculateUnknownSplitFeeBuffer(commitment.considerationAmount, input.feePolicy)
        : 0n,
      inTransit: false,
    });
  }

  return {
    groups,
    transit: { dispatched, executedAwaitingConfirmation, incoming },
    pendingTransfers,
    ledgerInconsistent,
  };
}
