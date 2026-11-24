import type {
  PoolFundingCalculationInput,
  PoolFundingDisbursement,
  PoolFundingSnapshot,
  PoolFundingTransferBlock,
  PoolFundingTransferLimit,
  PoolFundingTransferRefusal,
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

interface TransferFundingRead {
  snapshot: Pick<PoolFundingSnapshot, "balance" | "limits"> | null;
  isError: boolean;
  hasStaleBalance: boolean;
}

/**
 * Whether every limit a new transfer out of this Safe is checked against came
 * back from the current read. The Arbitrum queue takes any amount and Celo only
 * refuses after the CCIP fee is spent, so a send waits for a whole read: no
 * snapshot, one kept from before a failed refresh, a stale balance standing in
 * for one that could not be read, or any limit left unread all say no.
 */
export function selectTransferLimitsRead(funding: TransferFundingRead): boolean {
  if (!funding.snapshot || funding.isError || funding.hasStaleBalance) return false;
  const { balance, limits } = funding.snapshot;
  return (
    Boolean(balance) &&
    limits.maxTransferAmount !== null &&
    limits.periodAllowanceRemaining !== null &&
    limits.rolesAllowanceRemaining !== null
  );
}

/** Why a transfer of `amount` out of this Safe can't go yet; null when a whole read says it fits. */
export function selectTransferBlock(
  funding: TransferFundingRead,
  amount: bigint
): PoolFundingTransferBlock | null {
  return selectTransferLimitsRead(funding)
    ? selectExceededTransferLimit(funding, amount)
    : "limits_unread";
}

/**
 * What Celo refuses every transfer out of this Safe for, whatever its amount. The
 * Safe's settlement readiness derives each one from the read.
 */
const SAFE_WIDE_REFUSALS = [
  "inactive_route",
  "executor_paused",
  "token_paused",
] as const satisfies readonly PoolFundingTransferRefusal[];

/** What the read couldn't show about the route, which holds every transfer just the same. */
const SAFE_WIDE_UNREAD = [
  "executor_unreadable",
  "token_unreadable",
] as const satisfies readonly PoolFundingTransferRefusal[];

/**
 * Why a queued transfer can't be dispatched or resent yet. A send spends the CCIP
 * fee before Celo can refuse it, so it needs a whole read showing that Celo would
 * take it: an active route, an executor and a token that aren't paused, and the
 * read's own quote for the transfer. Celo debits the amount plus any sender-paid
 * G$ fee, and refuses a fee the receiver would pay or one over its fee policy. No
 * quote, or one Celo would refuse, leaves nothing to show the transfer fits.
 *
 * A resend of a command Celo has already recorded is the exception. Celo takes it
 * down its duplicate-message branch, which skips the transfer preflight and debits
 * nothing, and sends again only an acknowledgment it still owes. A paused executor
 * is all that refuses that message, so nothing else holds it. Only a dispatched
 * transfer resends its recorded command: a queued or failed one's command was an
 * earlier attempt's, and its next send carries a new one Celo hasn't seen.
 *
 * A dispatched transfer's command goes to the executor it was recorded for. During a
 * route change's grace window that can be the previous executor, so a resend is held
 * on that executor's pause flag, read for its command, and not on the current one's.
 * The caller's own read of the transfer can be ahead of the funding index: one the
 * index still lists as dispatched may already be requeued, and its dispatch goes to
 * the current executor. Until the two reads agree it is a resend, it waits. The same
 * holds when the index is an attempt behind, whatever state it still shows for the
 * earlier attempt: a transfer requeued, and maybe dispatched again, from outside the
 * panel carries the next attempt's command. Until the index reaches the caller's
 * attempt, the send waits. A batch member is the exception: the index gives it the
 * batch's attempt, not its own, and it is never resent on its own. Membership comes
 * from the caller's read, since a requeue takes a transfer out of its batch on chain
 * while the index keeps the old batch id.
 */
export function selectQueuedTransferBlock(
  funding: Omit<TransferFundingRead, "snapshot"> & {
    snapshot: Pick<
      PoolFundingSnapshot,
      | "balance"
      | "limits"
      | "disbursements"
      | "executions"
      | "executorPaused"
      | "commandExecutors"
      | "feeQuotes"
      | "feePolicy"
      | "settlementUnavailableReasons"
    > | null;
  },
  transfer: {
    disbursementId: bigint;
    amount: bigint;
    state?: string;
    attempt?: number | null;
    batchId?: bigint | null;
  }
): PoolFundingTransferBlock | null {
  const { snapshot } = funding;
  // A snapshot kept from a failed refresh is not current, so it shows nothing.
  if (!snapshot || funding.isError) return "limits_unread";
  const row = snapshot.disbursements.find(
    (entry) => entry.disbursementId === transfer.disbursementId
  );
  const resend = row?.state === "DISPATCHED" && row.executionKey ? row.executionKey : null;
  if (resend && transfer.state !== undefined && transfer.state !== "DISPATCHED") {
    return "limits_unread";
  }
  if (
    row &&
    !transfer.batchId &&
    transfer.attempt !== undefined &&
    row.attempt !== transfer.attempt
  ) {
    return "limits_unread";
  }
  const commandPaused = resend ? recordedExecutorPaused(snapshot, resend) : undefined;
  if (resend && row && celoRecorded(snapshot, row)) {
    const paused = commandPaused === undefined ? snapshot.executorPaused : commandPaused;
    if (paused === null) return "executor_unreadable";
    return paused ? "executor_paused" : null;
  }
  const reasons: readonly SettlementUnavailableReason[] =
    commandPaused === undefined
      ? snapshot.settlementUnavailableReasons
      : [
          ...snapshot.settlementUnavailableReasons.filter(
            (reason) => reason !== "executor_paused" && reason !== "executor_unreadable"
          ),
          ...(commandPaused === null
            ? (["executor_unreadable"] as const)
            : commandPaused
              ? (["executor_paused"] as const)
              : []),
        ];
  // A refusal the current read shows outranks anything it couldn't read.
  const refusal = SAFE_WIDE_REFUSALS.find((reason) => reasons.includes(reason));
  if (refusal) return refusal;
  if (!selectTransferLimitsRead(funding)) return "limits_unread";
  const unread = SAFE_WIDE_UNREAD.find((reason) => reasons.includes(reason));
  if (unread) return unread;
  const quote = row && snapshot.feeQuotes.find((entry) => entry.id === row.id);
  if (!quote || quote.fee === null || quote.senderPays === null) return "limits_unread";
  if (quote.fee > 0n && !quote.senderPays) return "limits_unread";
  // The readiness checks every quote against the policy; a send needs only its own to fit.
  if (!snapshot.feePolicy) return "fee_policy_unavailable";
  if (quote.fee > calculateKnownTransferFeeBuffer(quote.amount, snapshot.feePolicy)) {
    return "fee_policy_breach";
  }
  return selectExceededTransferLimit(funding, transfer.amount, quote.fee);
}

/**
 * Whether the executor a recorded command goes to is paused; null when the read
 * couldn't show that executor or its pause flag, which holds the resend.
 */
function recordedExecutorPaused(
  snapshot: Pick<PoolFundingSnapshot, "commandExecutors">,
  executionKey: `0x${string}`
): boolean | null {
  const key = executionKey.toLowerCase();
  return (
    snapshot.commandExecutors.find((entry) => entry.executionKey.toLowerCase() === key)?.paused ??
    null
  );
}

/** Whether Celo has recorded an execution of the transfer's current command. */
function celoRecorded(
  snapshot: Pick<PoolFundingSnapshot, "executions">,
  row: Pick<PoolFundingDisbursement, "executionKey">
): boolean {
  const key = row.executionKey?.toLowerCase();
  return (
    Boolean(key) && snapshot.executions.some((entry) => entry.executionKey.toLowerCase() === key)
  );
}

/**
 * The smallest limit a transfer of `amount` out of this Safe is over, so one
 * correction clears every limit it broke; null when it fits all that were read.
 * Only what the current read returned counts: `selectTransferLimitsRead` says
 * whether that read is whole. The Celo executor compares the amount plus any
 * sender-paid G$ fee. A transfer not queued yet has no quote, so an amount within
 * that fee of a limit fits here; `selectQueuedTransferBlock` checks the quoted
 * debit before a dispatch can spend the CCIP fee.
 */
export function selectExceededTransferLimit(
  funding: TransferFundingRead,
  amount: bigint,
  fee = 0n
): PoolFundingTransferLimit | null {
  if (!funding.snapshot || funding.isError) return null;
  const { balance, limits } = funding.snapshot;
  const debit = amount + fee;
  const maxima: [PoolFundingTransferLimit, bigint | null, bigint][] = [
    ["transfer_cap", limits.maxTransferAmount, debit],
    ["period_allowance", limits.periodAllowanceRemaining, debit],
    // The Safe's allowance covers the transfer itself, as the settlement readiness counts it.
    ["roles_allowance", limits.rolesAllowanceRemaining, amount],
    ["balance", funding.hasStaleBalance ? null : (balance?.value ?? null), debit],
  ];
  let exceeded: { limit: PoolFundingTransferLimit; max: bigint } | null = null;
  for (const [limit, max, needed] of maxima) {
    if (max === null || needed <= max) continue;
    if (!exceeded || max < exceeded.max) exceeded = { limit, max };
  }
  return exceeded?.limit ?? null;
}
