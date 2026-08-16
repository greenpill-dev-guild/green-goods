import { indexer, type Disbursement } from "envio";

import {
  applySubjectStateToDisbursement,
  contributorPayoutId,
  disbursementId,
  disbursementKind,
  fundingRoute,
  optionalAddress,
  payoutPlanId,
  payoutStatus,
  settlementCommandIndexId,
  settlementSubjectId,
} from "./settlement-projections";
import { fundingIndexId, poolingEntityId } from "./commitment-pool-projections";
import { normalizeAddress } from "./shared";
import { linkPayoutPlanToCommitment } from "./settlement-funding-reconciliation";

indexer.onEvent(
  { contract: "SettlementModule", event: "DisbursementQueued" },
  async ({ event, context }) => {
    const kind = disbursementKind(event.params.kind);
    const entityId = disbursementId(event.chainId, event.params.disbursementId);
    if (await context.Disbursement.get(entityId)) return;
    const planEntityId =
      event.params.payoutPlanId === 0n
        ? undefined
        : payoutPlanId(event.chainId, event.params.payoutPlanId);
    const plan = planEntityId ? await context.CommitmentPayoutPlan.get(planEntityId) : undefined;
    const garden = normalizeAddress(event.params.garden);
    const executorGarden = normalizeAddress(event.params.executorGarden);
    const contributor = optionalAddress(event.params.contributor);
    const commitmentId = event.params.commitmentId === 0n ? undefined : event.params.commitmentId;
    const fundingIndex =
      kind === "REFUND" && commitmentId !== undefined && contributor !== undefined
        ? await context.CommitmentFundingIndex.get(
            fundingIndexId(event.chainId, commitmentId, contributor)
          )
        : undefined;
    const membership = await context.SettlementBatchMembership.get(entityId);
    const loanRelationship = await context.LoanPrincipalRelationship.get(entityId);
    let entity: Disbursement = {
      id: entityId,
      chainId: event.chainId,
      disbursementId: event.params.disbursementId,
      garden,
      gardenId: garden,
      executorGarden,
      executorGardenId: executorGarden,
      commitmentId,
      commitmentEntityId:
        event.params.commitmentId === 0n
          ? undefined
          : `${event.chainId}-${event.params.commitmentId}`,
      payoutPlanId: event.params.payoutPlanId === 0n ? undefined : event.params.payoutPlanId,
      payoutPlanEntityId: planEntityId,
      contributor,
      contributorEntityId: contributor,
      fundingId: fundingIndex?.fundingId,
      fundingEntityId: fundingIndex?.fundingEntityId,
      creditRegistry: loanRelationship?.creditRegistry,
      loanId: loanRelationship?.loanId,
      settlementFlow: plan?.settlementFlow,
      kind,
      fundingRoute: fundingRoute(event.params.fundingRoute),
      source: normalizeAddress(event.params.source),
      recipient: normalizeAddress(event.params.recipient),
      token: normalizeAddress(event.params.token),
      amount: event.params.amount,
      state: "QUEUED",
      batchId: membership?.batchId,
      batchEntityId: membership?.batchEntityId,
      reasonCID: undefined,
      attempt: 0,
      executionKey: undefined,
      commandMessageId: undefined,
      dispatchedAt: undefined,
      celoExecutionTx: undefined,
      acknowledgmentMessageId: undefined,
      confirmedAt: undefined,
      failureCode: undefined,
      cancelledFromState: undefined,
      createdAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
    };
    const subject = await context.SettlementSubjectState.get(
      settlementSubjectId(
        event.chainId,
        membership !== undefined,
        membership?.batchId ?? event.params.disbursementId
      )
    );
    if (subject) entity = applySubjectStateToDisbursement(entity, subject);
    context.Disbursement.set(entity);

    if (kind === "REFUND" && commitmentId !== undefined && contributor !== undefined) {
      const indexId = fundingIndexId(event.chainId, commitmentId, contributor);
      const retainedRefundId = fundingIndex?.refundDisbursementId ?? event.params.disbursementId;
      const retainedRefundEntityId = fundingIndex?.refundDisbursementEntityId ?? entityId;
      context.CommitmentFundingIndex.set({
        id: indexId,
        chainId: event.chainId,
        commitmentId,
        commitmentEntityId: poolingEntityId(event.chainId, commitmentId),
        funder: contributor,
        fundingId: fundingIndex?.fundingId,
        fundingEntityId: fundingIndex?.fundingEntityId,
        refundDisbursementId: retainedRefundId,
        refundDisbursementEntityId: retainedRefundEntityId,
        updatedAt: Math.max(fundingIndex?.updatedAt ?? 0, event.block.timestamp),
      });
      if (fundingIndex?.fundingEntityId) {
        const funding = await context.CommitmentFunding.get(fundingIndex.fundingEntityId);
        if (funding) {
          const refunded = entity.state === "CONFIRMED";
          context.CommitmentFunding.set({
            ...funding,
            refundDisbursementId: funding.refundDisbursementId ?? retainedRefundId,
            refundDisbursementEntityId:
              funding.refundDisbursementEntityId ?? retainedRefundEntityId,
            state: funding.state === "REFUNDED" || refunded ? "REFUNDED" : "REFUND_QUEUED",
            closedAt: refunded ? (entity.confirmedAt ?? entity.updatedAt) : funding.closedAt,
            updatedAt: Math.max(funding.updatedAt, event.block.timestamp),
          });
        }
      }
    }

    if (plan && contributor) {
      const contributorEntityId = contributorPayoutId(
        event.chainId,
        event.params.payoutPlanId,
        contributor
      );
      const payout = await context.ContributorPayout.get(contributorEntityId);
      if (payout) {
        context.ContributorPayout.set({
          ...payout,
          disbursementId: event.params.disbursementId,
          disbursementEntityId: entityId,
          updatedAt: event.block.timestamp,
        });
      }
    }

    if (plan) {
      const nextBase = {
        ...plan,
        preparedPayoutCount: plan.preparedPayoutCount + 1,
        confirmedPayoutCount: plan.confirmedPayoutCount + (entity.state === "CONFIRMED" ? 1 : 0),
        failedPayoutCount: plan.failedPayoutCount + (entity.state === "FAILED" ? 1 : 0),
        beneficiaryDisbursementId:
          kind === "GARDEN_BENEFICIARY"
            ? event.params.disbursementId
            : plan.beneficiaryDisbursementId,
        beneficiaryDisbursementEntityId:
          kind === "GARDEN_BENEFICIARY" ? entityId : plan.beneficiaryDisbursementEntityId,
        disbursementEntityIds: [...plan.disbursementEntityIds, entityId],
        updatedAt: event.block.timestamp,
      };
      const updatedPlan = {
        ...nextBase,
        status: payoutStatus(nextBase),
      };
      context.CommitmentPayoutPlan.set(updatedPlan);
      await linkPayoutPlanToCommitment(context, updatedPlan);
    }
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "LoanPrincipalQueued" },
  async ({ event, context }) => {
    const entityId = disbursementId(event.chainId, event.params.disbursementId);
    const creditRegistry = normalizeAddress(event.params.creditRegistry);
    context.LoanPrincipalRelationship.set({
      id: entityId,
      chainId: event.chainId,
      disbursementId: event.params.disbursementId,
      creditRegistry,
      loanId: event.params.loanId,
      updatedAt: event.block.timestamp,
    });
    const existing = await context.Disbursement.get(entityId);
    if (!existing) return;
    context.Disbursement.set({
      ...existing,
      creditRegistry,
      loanId: event.params.loanId,
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "DisbursementRequeued" },
  async ({ event, context }) => {
    const entityId = disbursementId(event.chainId, event.params.disbursementId);
    const existing = await context.Disbursement.get(entityId);
    if (!existing) return;
    context.Disbursement.set({
      ...existing,
      state: "QUEUED",
      attempt: Number(event.params.attempt),
      executionKey: undefined,
      commandMessageId: undefined,
      acknowledgmentMessageId: undefined,
      dispatchedAt: undefined,
      confirmedAt: undefined,
      failureCode: undefined,
      updatedAt: event.block.timestamp,
    });
    context.SettlementSubjectState.set({
      id: settlementSubjectId(event.chainId, false, event.params.disbursementId),
      chainId: event.chainId,
      isBatch: false,
      subjectId: event.params.disbursementId,
      state: "QUEUED",
      attempt: Number(event.params.attempt),
      executionKey: undefined,
      commandMessageId: undefined,
      acknowledgmentMessageId: undefined,
      failureCode: undefined,
      dispatchedAt: undefined,
      confirmedAt: undefined,
      reasonCID: existing.reasonCID,
      updatedAt: event.block.timestamp,
    });
    if (!existing.payoutPlanEntityId) return;
    const plan = await context.CommitmentPayoutPlan.get(existing.payoutPlanEntityId);
    if (!plan) return;
    const updatedPlanBase = {
      ...plan,
      failedPayoutCount:
        existing.state === "FAILED"
          ? Math.max(0, plan.failedPayoutCount - 1)
          : plan.failedPayoutCount,
      updatedAt: event.block.timestamp,
    };
    context.CommitmentPayoutPlan.set({
      ...updatedPlanBase,
      status: payoutStatus(updatedPlanBase),
    });
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "DisbursementCancelled" },
  async ({ event, context }) => {
    const entityId = disbursementId(event.chainId, event.params.disbursementId);
    const existing = await context.Disbursement.get(entityId);
    if (!existing) return;
    context.Disbursement.set({
      ...existing,
      state: "CANCELLED",
      cancelledFromState: Number(event.params.cancelledFromState) === 4 ? "FAILED" : "QUEUED",
      reasonCID: event.params.reasonCID,
      updatedAt: event.block.timestamp,
    });
    const commandIndex = existing.executionKey
      ? await context.SettlementCommandIndex.get(
          settlementCommandIndexId(event.chainId, existing.executionKey)
        )
      : undefined;
    context.SettlementSubjectState.set({
      id: settlementSubjectId(event.chainId, false, event.params.disbursementId),
      chainId: event.chainId,
      isBatch: false,
      subjectId: event.params.disbursementId,
      state: "CANCELLED",
      attempt: existing.attempt,
      executionKey: existing.executionKey,
      commandMessageId: existing.commandMessageId ?? commandIndex?.commandMessageId,
      acknowledgmentMessageId: existing.acknowledgmentMessageId,
      failureCode: existing.failureCode,
      dispatchedAt: existing.dispatchedAt,
      confirmedAt: existing.confirmedAt,
      reasonCID: event.params.reasonCID,
      updatedAt: event.block.timestamp,
    });
    if (!existing.payoutPlanEntityId) return;
    const plan = await context.CommitmentPayoutPlan.get(existing.payoutPlanEntityId);
    if (!plan) return;
    const fromFailed = Number(event.params.cancelledFromState) === 4;
    const updatedPlanBase = {
      ...plan,
      failedPayoutCount: fromFailed
        ? Math.max(0, plan.failedPayoutCount - 1)
        : plan.failedPayoutCount,
      cancelledPayoutCount:
        existing.state === "CANCELLED" ? plan.cancelledPayoutCount : plan.cancelledPayoutCount + 1,
      updatedAt: event.block.timestamp,
    };
    context.CommitmentPayoutPlan.set({
      ...updatedPlanBase,
      status: payoutStatus(updatedPlanBase),
    });
  }
);
