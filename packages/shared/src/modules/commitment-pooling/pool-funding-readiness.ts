import type {
  PoolFundingCalculationInput,
  PoolFundingUnavailableReason,
  SettlementUnavailableReason,
} from "./pool-funding";
import { calculateKnownTransferFeeBuffer } from "./pool-funding-calculations";
import type { PendingSettlementTransfer } from "./pool-funding-obligations";

export function deriveFundingUnavailableReasons(
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

interface PendingCommand {
  netAmount: bigint;
  grossAmount: bigint;
  count: number;
  isBatch: boolean;
}

function pendingCommands(
  input: PoolFundingCalculationInput,
  transfers: PendingSettlementTransfer[]
): PendingCommand[] {
  const quotes = new Map(input.feeQuotes.map((quote) => [quote.id, quote]));
  const commands = new Map<string, PendingCommand>();
  for (const transfer of transfers) {
    const quote = quotes.get(transfer.id);
    const senderFee = quote?.senderPays === true && quote.fee !== null ? quote.fee : 0n;
    const grossAmount =
      quote && quote.fee !== null && quote.senderPays !== null
        ? transfer.netAmount + senderFee
        : transfer.netAmount + transfer.feeBuffer;
    const key = transfer.batchId === null ? `transfer:${transfer.id}` : `batch:${transfer.batchId}`;
    const current = commands.get(key) ?? {
      netAmount: 0n,
      grossAmount: 0n,
      count: 0,
      isBatch: transfer.batchId !== null,
    };
    current.netAmount += transfer.netAmount;
    current.grossAmount += grossAmount;
    current.count += 1;
    commands.set(key, current);
  }
  return [...commands.values()];
}

export function deriveSettlementUnavailableReasons(
  input: PoolFundingCalculationInput,
  fundingReasons: PoolFundingUnavailableReason[],
  transfers: PendingSettlementTransfer[],
  authorizedDemand: bigint
): SettlementUnavailableReason[] {
  const reasons = [...fundingReasons] as SettlementUnavailableReason[];
  const routeReady =
    input.readiness.accountConfigured &&
    input.readiness.accountActive &&
    input.readiness.routeConfigured &&
    input.readiness.routeActive &&
    input.readiness.routeMatches;

  if (routeReady && input.readiness.sourcePaused) reasons.push("source_paused");
  if (routeReady && input.readiness.sourcePaused === null) reasons.push("source_unreadable");
  if (routeReady && input.readiness.executorPaused) reasons.push("executor_paused");
  if (routeReady && input.readiness.executorPaused === null) reasons.push("executor_unreadable");
  if (routeReady && input.readiness.tokenPaused) reasons.push("token_paused");
  if (routeReady && input.readiness.tokenPaused === null) reasons.push("token_unreadable");

  const quotes = new Map(input.feeQuotes.map((quote) => [quote.id, quote]));
  if (
    input.feeQuotes.some((quote) => quote.fee === null || quote.senderPays === null) ||
    transfers.some((transfer) => {
      const quote = quotes.get(transfer.id);
      return !quote || quote.fee === null || quote.senderPays === null;
    })
  ) {
    reasons.push("fee_quote_unavailable");
  }
  if (
    input.feeQuotes.some(
      (quote) => quote.fee !== null && quote.fee > 0n && quote.senderPays === false
    )
  ) {
    reasons.push("receiver_paid_fee");
  }
  if (
    input.feePolicy &&
    input.feeQuotes.some(
      (quote) =>
        quote.fee !== null &&
        quote.fee > calculateKnownTransferFeeBuffer(quote.amount, input.feePolicy!)
    )
  ) {
    reasons.push("fee_policy_breach");
  }

  const commands = pendingCommands(input, transfers);
  const rolesRemaining = input.limits.rolesAllowanceRemaining;
  if (rolesRemaining === 0n) reasons.push("roles_allowance_exhausted");
  else if (
    rolesRemaining !== null &&
    commands.some((command) => command.netAmount > rolesRemaining)
  ) {
    reasons.push("roles_allowance_insufficient");
  }
  if (routeReady && rolesRemaining === null) reasons.push("allowance_unreadable");

  const periodRemaining = input.limits.periodAllowanceRemaining;
  if (periodRemaining === 0n) reasons.push("period_allowance_exhausted");
  else if (
    periodRemaining !== null &&
    commands.some((command) => command.grossAmount > periodRemaining)
  ) {
    reasons.push("period_allowance_insufficient");
  }
  if (routeReady && periodRemaining === null) reasons.push("period_unreadable");
  if (
    routeReady &&
    (input.limits.maxTransferAmount === null ||
      input.limits.maxBatchAmount === null ||
      input.limits.batchSizeLimit === null)
  ) {
    reasons.push("caps_unreadable");
  }

  if (
    input.limits.maxTransferAmount !== null &&
    transfers.some((transfer) => {
      const quote = quotes.get(transfer.id);
      const fee = quote?.senderPays === true && quote.fee !== null ? quote.fee : transfer.feeBuffer;
      return transfer.netAmount + fee > input.limits.maxTransferAmount!;
    })
  ) {
    reasons.push("transfer_cap_exceeded");
  }
  if (
    input.limits.maxBatchAmount !== null &&
    commands.some(
      (command) => command.isBatch && command.grossAmount > input.limits.maxBatchAmount!
    )
  ) {
    reasons.push("batch_cap_exceeded");
  }
  if (
    input.limits.batchSizeLimit !== null &&
    commands.some((command) => command.isBatch && command.count > input.limits.batchSizeLimit!)
  ) {
    reasons.push("batch_size_exceeded");
  }

  if (
    routeReady &&
    fundingReasons.length === 0 &&
    input.balance !== null &&
    input.balance.value < authorizedDemand
  ) {
    reasons.push("insufficient_authorized_balance");
  }
  if (routeReady && input.acknowledgmentFeeReserveLow === true) {
    reasons.push("acknowledgment_reserve_low");
  }
  if (routeReady && input.acknowledgmentFeeReserveLow === null) {
    reasons.push("acknowledgment_reserve_unreadable");
  }

  return [...new Set(reasons)];
}
