import { indexer, type CreditLoanProjection, type CreditPoolStats, type Loan } from "envio";

import { cursorWins, poolingEntityId } from "./commitment-pool-projections";
import { getTxHash, normalizeAddress } from "./shared";

export type CreditContext = Parameters<Parameters<typeof indexer.onEvent>[1]>[0]["context"];
export type CreditEvent = {
  chainId: number;
  srcAddress: string;
  block: { number: number; timestamp: number };
  transaction: unknown;
  logIndex: number;
};

function loanId(chainId: number, value: bigint): string {
  return `${chainId}-${value}`;
}

function poolStatsId(chainId: number, poolId: bigint): string {
  return `${chainId}-${poolId}`;
}

export function executorId(chainId: number, poolId: bigint, executor: string): string {
  return `${chainId}-${poolId}-${normalizeAddress(executor)}`;
}

function eventId(event: CreditEvent): string {
  return `${event.chainId}-${getTxHash(event.transaction)}-${event.logIndex}`;
}

function eventData(value: Record<string, unknown>): string {
  return JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item));
}

export function loanRail(value: bigint): Loan["rail"] {
  const values = ["NONE", "JAR", "TREASURY", "GDOLLAR_SETTLEMENT"] as const;
  return values[Number(value)] ?? "NONE";
}

function emptyProjection(event: CreditEvent, value: bigint): CreditLoanProjection {
  return {
    id: loanId(event.chainId, value),
    chainId: event.chainId,
    loanId: value,
    creditRegistry: normalizeAddress(event.srcAddress),
    requestSeen: false,
    poolId: undefined,
    borrower: undefined,
    requestedBy: undefined,
    commitmentId: undefined,
    token: undefined,
    principal: 0n,
    feeAmount: 0n,
    dueDate: 0n,
    installmentsTotal: 0,
    termsCID: undefined,
    createdAt: undefined,
    state: undefined,
    lifecycleBlockNumber: undefined,
    lifecycleLogIndex: undefined,
    recordedBy: undefined,
    actorBlockNumber: undefined,
    actorLogIndex: undefined,
    rail: undefined,
    disbursementId: undefined,
    issuedAmount: 0n,
    attempts: undefined,
    executionRef: undefined,
    disbursementBlockNumber: undefined,
    disbursementLogIndex: undefined,
    repaidAmount: 0n,
    outstanding: 0n,
    installmentsPaid: 0,
    repaymentBlockNumber: undefined,
    repaymentLogIndex: undefined,
    reasonCID: undefined,
    defaultReasonCID: undefined,
    defaultedAt: undefined,
    defaultBlockNumber: undefined,
    defaultLogIndex: undefined,
    recoveredFromDefault: false,
    settlementRelationshipEntityId: undefined,
    appliedIssued: 0n,
    appliedRepaid: 0n,
    appliedDefaultCount: 0n,
    appliedLoanCount: 0n,
    updatedAt: event.block.timestamp,
  };
}

export async function projection(
  context: CreditContext,
  event: CreditEvent,
  value: bigint
): Promise<CreditLoanProjection> {
  return (
    (await context.CreditLoanProjection.get(loanId(event.chainId, value))) ??
    emptyProjection(event, value)
  );
}

export function actorUpdate(
  current: CreditLoanProjection,
  event: CreditEvent,
  actor: string
): CreditLoanProjection {
  if (
    !cursorWins(event.block.number, event.logIndex, current.actorBlockNumber, current.actorLogIndex)
  ) {
    return current;
  }
  return {
    ...current,
    recordedBy: normalizeAddress(actor),
    actorBlockNumber: BigInt(event.block.number),
    actorLogIndex: event.logIndex,
  };
}

export function lifecycleUpdate(
  current: CreditLoanProjection,
  event: CreditEvent,
  state: Loan["state"]
): CreditLoanProjection {
  if (
    !cursorWins(
      event.block.number,
      event.logIndex,
      current.lifecycleBlockNumber,
      current.lifecycleLogIndex
    )
  ) {
    return current;
  }
  return {
    ...current,
    state,
    lifecycleBlockNumber: BigInt(event.block.number),
    lifecycleLogIndex: event.logIndex,
  };
}

export async function putLoanEvent(
  context: CreditContext,
  event: CreditEvent,
  input: {
    eventType: string;
    poolId?: bigint;
    loanId?: bigint;
    actor?: string;
    amount?: bigint;
    data?: Record<string, unknown>;
  }
): Promise<boolean> {
  const id = eventId(event);
  if (await context.LoanEvent.get(id)) return false;
  context.LoanEvent.set({
    id,
    chainId: event.chainId,
    poolId: input.poolId,
    loanId: input.loanId,
    eventType: input.eventType,
    actor: input.actor ? normalizeAddress(input.actor) : undefined,
    amount: input.amount,
    data: input.data ? eventData(input.data) : undefined,
    txHash: getTxHash(event.transaction),
    blockNumber: BigInt(event.block.number),
    logIndex: event.logIndex,
    timestamp: event.block.timestamp,
  });
  return true;
}

export async function ensurePoolStats(
  context: CreditContext,
  chainId: number,
  poolId: bigint,
  timestamp: number
): Promise<CreditPoolStats | undefined> {
  const id = poolStatsId(chainId, poolId);
  const existing = await context.CreditPoolStats.get(id);
  if (existing) return existing;
  const pool = await context.CommitmentPool.get(poolingEntityId(chainId, poolId));
  if (!pool?.registrationSeen || !pool.garden || !pool.gardenId) return undefined;
  return {
    id,
    chainId,
    poolId,
    garden: pool.garden,
    gardenId: pool.gardenId,
    token: undefined,
    borrowerCap: 0n,
    enabled: false,
    creditIssued: 0n,
    creditRepaid: 0n,
    creditOutstanding: 0n,
    repaymentRateNumerator: 0n,
    repaymentRateDenominator: 0n,
    defaultRateNumerator: 0n,
    defaultRateDenominator: 0n,
    configurationBlockNumber: undefined,
    configurationLogIndex: undefined,
    updatedAt: timestamp,
  };
}

export async function reconcileProjection(
  context: CreditContext,
  current: CreditLoanProjection
): Promise<void> {
  if (
    !current.requestSeen ||
    current.poolId === undefined ||
    !current.borrower ||
    !current.requestedBy ||
    !current.token ||
    !current.termsCID ||
    current.createdAt === undefined ||
    !current.state
  ) {
    context.CreditLoanProjection.set(current);
    return;
  }

  const pool = await context.CommitmentPool.get(poolingEntityId(current.chainId, current.poolId));
  if (!pool?.registrationSeen || !pool.garden || !pool.gardenId) {
    context.CreditLoanProjection.set(current);
    return;
  }

  let attempts = current.attempts;
  let relationshipEntityId = current.settlementRelationshipEntityId;
  if (current.disbursementId !== undefined && current.disbursementId !== 0n) {
    const relationshipId = `${current.chainId}-${current.disbursementId}`;
    const relationship = await context.LoanPrincipalRelationship.get(relationshipId);
    if (
      relationship?.loanId === current.loanId &&
      relationship.creditRegistry === current.creditRegistry
    ) {
      relationshipEntityId = relationshipId;
      const disbursement = await context.Disbursement.get(relationshipId);
      attempts = disbursement?.attempt ?? attempts;
    }
  }

  const stats = await ensurePoolStats(context, current.chainId, current.poolId, current.updatedAt);
  let nextProjection = {
    ...current,
    attempts,
    settlementRelationshipEntityId: relationshipEntityId,
  };
  if (stats) {
    const desiredIssued = current.disbursementBlockNumber ? current.issuedAmount : 0n;
    const desiredRepaid = current.repaidAmount;
    const desiredDefaultCount = current.defaultBlockNumber ? 1n : 0n;
    const desiredLoanCount = current.disbursementBlockNumber ? 1n : 0n;
    const issuedDelta = desiredIssued - current.appliedIssued;
    const repaidDelta = desiredRepaid - current.appliedRepaid;
    context.CreditPoolStats.set({
      ...stats,
      creditIssued: stats.creditIssued + issuedDelta,
      creditRepaid: stats.creditRepaid + repaidDelta,
      creditOutstanding: stats.creditOutstanding + issuedDelta - repaidDelta,
      repaymentRateNumerator: stats.repaymentRateNumerator + repaidDelta,
      repaymentRateDenominator: stats.repaymentRateDenominator + issuedDelta,
      defaultRateNumerator:
        stats.defaultRateNumerator + desiredDefaultCount - current.appliedDefaultCount,
      defaultRateDenominator:
        stats.defaultRateDenominator + desiredLoanCount - current.appliedLoanCount,
      updatedAt: Math.max(stats.updatedAt, current.updatedAt),
    });
    nextProjection = {
      ...nextProjection,
      appliedIssued: desiredIssued,
      appliedRepaid: desiredRepaid,
      appliedDefaultCount: desiredDefaultCount,
      appliedLoanCount: desiredLoanCount,
    };
  }

  const row: Loan = {
    id: current.id,
    chainId: current.chainId,
    loanId: current.loanId,
    creditRegistry: current.creditRegistry,
    poolId: current.poolId,
    garden: pool.garden,
    gardenId: pool.gardenId,
    borrower: current.borrower,
    requestedBy: current.requestedBy,
    recordedBy: current.recordedBy ?? current.requestedBy,
    commitmentId: current.commitmentId,
    token: current.token,
    principal: current.principal,
    repaidAmount: current.repaidAmount,
    outstanding: current.outstanding,
    feeAmount: current.feeAmount,
    rail: current.rail ?? "NONE",
    disbursementId: current.disbursementId,
    state: current.state,
    dueDate: current.dueDate,
    installmentsTotal: current.installmentsTotal,
    installmentsPaid: current.installmentsPaid,
    attempts,
    executionRef: current.executionRef,
    termsCID: current.termsCID,
    reasonCID: current.reasonCID,
    defaultReasonCID: current.defaultReasonCID,
    recoveredFromDefault: current.recoveredFromDefault,
    defaultedAt: current.defaultedAt,
    settlementRelationshipEntityId: relationshipEntityId,
    createdAt: current.createdAt,
    updatedAt: current.updatedAt,
  };
  context.Loan.set(row);
  context.CreditLoanProjection.set(nextProjection);
}
