import { indexer, type CommitmentEvent, type CommitmentFunding } from "envio";

import {
  cursorWins,
  eventAuditId,
  fundingIndexId,
  poolingEntityId,
} from "./commitment-pool-projections";
import { getTxHash, normalizeAddress } from "./shared";
import { linkConsumedFundingToCommitment } from "./settlement-funding-reconciliation";

function fundingEntityId(chainId: number, fundingId: bigint): string {
  return `${chainId}-${fundingId}`;
}

function createFunding(chainId: number, fundingId: bigint, timestamp: number): CommitmentFunding {
  return {
    id: fundingEntityId(chainId, fundingId),
    chainId,
    fundingId,
    pledgeSeen: false,
    commitmentId: undefined,
    commitmentEntityId: undefined,
    funder: undefined,
    garden: undefined,
    gardenId: undefined,
    refundAccount: undefined,
    expectedAmount: undefined,
    depositedAmount: 0n,
    depositReference: undefined,
    state: "UNKNOWN",
    refundDisbursementId: undefined,
    refundDisbursementEntityId: undefined,
    pledgeBlockNumber: undefined,
    pledgeLogIndex: undefined,
    depositBlockNumber: undefined,
    depositLogIndex: undefined,
    consumeBlockNumber: undefined,
    consumeLogIndex: undefined,
    withdrawBlockNumber: undefined,
    withdrawLogIndex: undefined,
    pledgedAt: undefined,
    depositRecordedAt: undefined,
    consumedAt: undefined,
    withdrawnAt: undefined,
    closedAt: undefined,
    updatedAt: timestamp,
  };
}

function derivedFundingState(funding: CommitmentFunding): CommitmentFunding["state"] {
  if (funding.state === "REFUNDED") return "REFUNDED";
  if (funding.withdrawBlockNumber !== undefined) return "WITHDRAWN";
  if (funding.refundDisbursementId !== undefined) return "REFUND_QUEUED";
  if (funding.closedAt !== undefined) return "CLOSED";
  if (funding.consumeBlockNumber !== undefined) return "CONSUMED";
  if (funding.depositBlockNumber !== undefined) return "DEPOSIT_RECORDED";
  if (funding.pledgeSeen) return "PLEDGED";
  return "UNKNOWN";
}

type FundingEvent = {
  readonly chainId: number;
  readonly block: { readonly timestamp: number };
  readonly transaction: unknown;
  readonly logIndex: number;
};

type FundingContext = {
  CommitmentEvent: {
    get(id: string): Promise<CommitmentEvent | undefined>;
    set(entity: CommitmentEvent): void;
  };
};

async function putFundingAudit(
  event: FundingEvent,
  context: FundingContext,
  eventType: CommitmentEvent["eventType"],
  commitmentId: bigint | undefined,
  actor: string | undefined
): Promise<boolean> {
  const id = eventAuditId(event.chainId, getTxHash(event.transaction), event.logIndex);
  if (await context.CommitmentEvent.get(id)) return false;
  context.CommitmentEvent.set({
    id,
    chainId: event.chainId,
    poolId: undefined,
    poolEntityId: undefined,
    cycleId: undefined,
    cycleEntityId: undefined,
    commitmentId,
    commitmentEntityId:
      commitmentId === undefined ? undefined : poolingEntityId(event.chainId, commitmentId),
    eventType,
    actor,
    configurationKey: undefined,
    previousValue: undefined,
    newValue: undefined,
    units: undefined,
    data: undefined,
    txHash: getTxHash(event.transaction).toLowerCase(),
    timestamp: event.block.timestamp,
  });
  return true;
}

indexer.onEvent(
  { contract: "SettlementModule", event: "FundingPledged" },
  async ({ event, context }) => {
    const commitmentId = event.params.commitmentId;
    const funder = normalizeAddress(event.params.funder);
    if (!(await putFundingAudit(event, context, "FUNDING_PLEDGED", commitmentId, funder))) return;
    const id = fundingEntityId(event.chainId, event.params.fundingId);
    const existing =
      (await context.CommitmentFunding.get(id)) ??
      createFunding(event.chainId, event.params.fundingId, event.block.timestamp);
    const indexId = fundingIndexId(event.chainId, commitmentId, funder);
    const fundingIndex = await context.CommitmentFundingIndex.get(indexId);
    const garden = normalizeAddress(event.params.garden);
    const next: CommitmentFunding = {
      ...existing,
      pledgeSeen: true,
      commitmentId,
      commitmentEntityId: poolingEntityId(event.chainId, commitmentId),
      funder,
      garden,
      gardenId: garden,
      refundAccount: normalizeAddress(event.params.refundAccount),
      expectedAmount: event.params.expectedAmount,
      refundDisbursementId: existing.refundDisbursementId ?? fundingIndex?.refundDisbursementId,
      refundDisbursementEntityId:
        existing.refundDisbursementEntityId ?? fundingIndex?.refundDisbursementEntityId,
      pledgeBlockNumber: BigInt(event.block.number),
      pledgeLogIndex: event.logIndex,
      pledgedAt: existing.pledgedAt ?? event.block.timestamp,
      updatedAt: Math.max(existing.updatedAt, event.block.timestamp),
      state: existing.state,
    };
    let resolved = { ...next, state: derivedFundingState(next) } satisfies CommitmentFunding;
    context.CommitmentFundingIndex.set({
      id: indexId,
      chainId: event.chainId,
      commitmentId,
      commitmentEntityId: poolingEntityId(event.chainId, commitmentId),
      funder,
      fundingId: fundingIndex?.fundingId ?? event.params.fundingId,
      fundingEntityId: fundingIndex?.fundingEntityId ?? id,
      refundDisbursementId: fundingIndex?.refundDisbursementId,
      refundDisbursementEntityId: fundingIndex?.refundDisbursementEntityId,
      updatedAt: Math.max(fundingIndex?.updatedAt ?? 0, event.block.timestamp),
    });
    if (fundingIndex?.refundDisbursementEntityId) {
      const refund = await context.Disbursement.get(fundingIndex.refundDisbursementEntityId);
      if (refund) {
        context.Disbursement.set({
          ...refund,
          fundingId: event.params.fundingId,
          fundingEntityId: id,
          updatedAt: Math.max(refund.updatedAt, event.block.timestamp),
        });
        if (refund.state === "CONFIRMED") {
          resolved = {
            ...resolved,
            state: "REFUNDED",
            closedAt: refund.confirmedAt ?? refund.updatedAt,
            updatedAt: Math.max(resolved.updatedAt, refund.updatedAt),
          };
        }
      }
    }
    context.CommitmentFunding.set(resolved);
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "FundingDepositRecorded" },
  async ({ event, context }) => {
    if (
      !(await putFundingAudit(
        event,
        context,
        "FUNDING_DEPOSIT_RECORDED",
        undefined,
        normalizeAddress(event.params.recordedBy)
      ))
    )
      return;
    const id = fundingEntityId(event.chainId, event.params.fundingId);
    const existing =
      (await context.CommitmentFunding.get(id)) ??
      createFunding(event.chainId, event.params.fundingId, event.block.timestamp);
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        existing.depositBlockNumber,
        existing.depositLogIndex
      )
    )
      return;
    const next: CommitmentFunding = {
      ...existing,
      depositedAmount: event.params.amount,
      depositReference: event.params.depositReference.toLowerCase(),
      depositBlockNumber: BigInt(event.block.number),
      depositLogIndex: event.logIndex,
      depositRecordedAt: event.block.timestamp,
      updatedAt: Math.max(existing.updatedAt, event.block.timestamp),
      state: existing.state,
    };
    context.CommitmentFunding.set({ ...next, state: derivedFundingState(next) });
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "FundingConsumed" },
  async ({ event, context }) => {
    const commitmentId = event.params.commitmentId;
    const funder = normalizeAddress(event.params.funder);
    if (
      !(await putFundingAudit(
        event,
        context,
        "FUNDING_CONSUMED",
        commitmentId,
        normalizeAddress(event.params.consumedBy)
      ))
    )
      return;
    const id = fundingEntityId(event.chainId, event.params.fundingId);
    const existing =
      (await context.CommitmentFunding.get(id)) ??
      createFunding(event.chainId, event.params.fundingId, event.block.timestamp);
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        existing.consumeBlockNumber,
        existing.consumeLogIndex
      )
    )
      return;
    const next: CommitmentFunding = {
      ...existing,
      commitmentId: existing.commitmentId ?? commitmentId,
      commitmentEntityId:
        existing.commitmentEntityId ?? poolingEntityId(event.chainId, commitmentId),
      funder: existing.funder ?? funder,
      depositedAmount: event.params.depositedAmount,
      consumeBlockNumber: BigInt(event.block.number),
      consumeLogIndex: event.logIndex,
      consumedAt: event.block.timestamp,
      updatedAt: Math.max(existing.updatedAt, event.block.timestamp),
      state: existing.state,
    };
    const resolved = { ...next, state: derivedFundingState(next) } satisfies CommitmentFunding;
    context.CommitmentFunding.set(resolved);
    const indexId = fundingIndexId(event.chainId, commitmentId, funder);
    const fundingIndex = await context.CommitmentFundingIndex.get(indexId);
    context.CommitmentFundingIndex.set({
      id: indexId,
      chainId: event.chainId,
      commitmentId,
      commitmentEntityId: poolingEntityId(event.chainId, commitmentId),
      funder,
      fundingId: event.params.fundingId,
      fundingEntityId: id,
      refundDisbursementId: fundingIndex?.refundDisbursementId,
      refundDisbursementEntityId: fundingIndex?.refundDisbursementEntityId,
      updatedAt: Math.max(fundingIndex?.updatedAt ?? 0, event.block.timestamp),
    });
    await linkConsumedFundingToCommitment(context, resolved);
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "FundingWithdrawn" },
  async ({ event, context }) => {
    const commitmentId = event.params.commitmentId;
    const funder = normalizeAddress(event.params.funder);
    if (
      !(await putFundingAudit(
        event,
        context,
        "FUNDING_WITHDRAWN",
        commitmentId,
        normalizeAddress(event.params.withdrawnBy)
      ))
    )
      return;
    const id = fundingEntityId(event.chainId, event.params.fundingId);
    const existing =
      (await context.CommitmentFunding.get(id)) ??
      createFunding(event.chainId, event.params.fundingId, event.block.timestamp);
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        existing.withdrawBlockNumber,
        existing.withdrawLogIndex
      )
    )
      return;
    const next: CommitmentFunding = {
      ...existing,
      commitmentId: existing.commitmentId ?? commitmentId,
      commitmentEntityId:
        existing.commitmentEntityId ?? poolingEntityId(event.chainId, commitmentId),
      funder: existing.funder ?? funder,
      withdrawBlockNumber: BigInt(event.block.number),
      withdrawLogIndex: event.logIndex,
      withdrawnAt: event.block.timestamp,
      closedAt: event.block.timestamp,
      updatedAt: Math.max(existing.updatedAt, event.block.timestamp),
      state: existing.state,
    };
    context.CommitmentFunding.set({ ...next, state: derivedFundingState(next) });
  }
);
