import { indexer, type CommitmentPayoutPlan, type Disbursement } from "envio";

import {
  ZERO_BYTES32,
  configurationId,
  disbursementId,
  disbursementKind,
  fundingRoute,
  optionalAddress,
  payoutPlanId,
  payoutStatus,
  settlementFlow,
  sourceConfiguration,
} from "./settlement-projections";
import { normalizeAddress } from "./shared";

indexer.onEvent(
  { contract: "SettlementModule", event: "FundingConfigurationLocked" },
  async ({ event, context }) => {
    const id = configurationId(event.chainId);
    const existing = await context.SettlementConfiguration.get(id);
    const protocolGarden = normalizeAddress(event.params.protocolGarden);
    const configuration = {
      ...sourceConfiguration(
        event.chainId,
        event.srcAddress,
        event.params.gDollarToken,
        event.block.timestamp,
        existing
      ),
      protocolGarden,
      pendingPayoutPlanEntityIds: [],
    };
    context.SettlementConfiguration.set(configuration);
    for (const pendingId of existing?.pendingPayoutPlanEntityIds ?? []) {
      const pendingPlan = await context.CommitmentPayoutPlan.get(pendingId);
      if (!pendingPlan) continue;
      context.CommitmentPayoutPlan.set({
        ...pendingPlan,
        settlementFlow: settlementFlow(
          pendingPlan.payerGarden,
          pendingPlan.providerGarden,
          protocolGarden
        ),
        updatedAt: Math.max(pendingPlan.updatedAt, event.block.timestamp),
      });
    }
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "CommitmentPayoutPlanCreated" },
  async ({ event, context }) => {
    const providerGarden = normalizeAddress(event.params.providerGarden);
    const payerGarden = normalizeAddress(event.params.payerGarden);
    const beneficiaryGarden = optionalAddress(event.params.beneficiaryGarden);
    const kind = disbursementKind(event.params.payoutKind);
    const configId = configurationId(event.chainId);
    const configuration = await context.SettlementConfiguration.get(configId);
    const entityId = payoutPlanId(event.chainId, event.params.payoutPlanId);
    const flow = settlementFlow(payerGarden, providerGarden, configuration?.protocolGarden);
    const plan: CommitmentPayoutPlan = {
      id: entityId,
      chainId: event.chainId,
      payoutPlanId: event.params.payoutPlanId,
      commitmentId: event.params.commitmentId,
      commitmentEntityId: `${event.chainId}-${event.params.commitmentId}`,
      providerGarden,
      providerGardenId: providerGarden,
      payerGarden,
      payerGardenId: payerGarden,
      settlementFlow: flow,
      source: normalizeAddress(event.params.source),
      token: normalizeAddress(event.params.token),
      payoutKind: kind,
      declaredAmount: event.params.declaredAmount,
      gardenRetainedAmount: event.params.gardenRetainedAmount,
      contributorPayoutTotal:
        kind === "CONTRIBUTOR_CONSIDERATION" ? event.params.declaredAmount : 0n,
      beneficiaryGarden,
      beneficiaryGardenId: beneficiaryGarden,
      beneficiaryRecipient: optionalAddress(event.params.beneficiaryRecipient),
      beneficiaryAmount: event.params.beneficiaryAmount,
      beneficiaryDisbursementId: undefined,
      beneficiaryDisbursementEntityId: undefined,
      recognitionContributorCount: 0,
      payablePayoutCount: kind === "GARDEN_BENEFICIARY" ? 1 : 0,
      preparedPayoutCount: 0,
      confirmedPayoutCount: 0,
      failedPayoutCount: 0,
      cancelledPayoutCount: 0,
      recognitionSnapshotHash: event.params.recognitionSnapshotHash.toLowerCase(),
      paymentSnapshotHash: ZERO_BYTES32,
      paymentSnapshotVersion: 1,
      latestEditReasonCID: undefined,
      finalized: false,
      status: "DRAFT",
      disbursementEntityIds: [],
      createdBy: normalizeAddress(event.params.createdBy),
      createdAt: event.block.timestamp,
      finalizedAt: undefined,
      updatedAt: event.block.timestamp,
    };
    context.CommitmentPayoutPlan.set(plan);
    if (flow === "UNKNOWN") {
      const sourceConfig = sourceConfiguration(
        event.chainId,
        event.srcAddress,
        event.params.token,
        event.block.timestamp,
        configuration
      );
      context.SettlementConfiguration.set({
        ...sourceConfig,
        pendingPayoutPlanEntityIds: sourceConfig.pendingPayoutPlanEntityIds.includes(entityId)
          ? sourceConfig.pendingPayoutPlanEntityIds
          : [...sourceConfig.pendingPayoutPlanEntityIds, entityId],
      });
    }
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "CommitmentPayoutPlanFinalized" },
  async ({ event, context }) => {
    const entityId = payoutPlanId(event.chainId, event.params.payoutPlanId);
    const existing = await context.CommitmentPayoutPlan.get(entityId);
    if (!existing) return;
    const next: CommitmentPayoutPlan = {
      ...existing,
      payoutKind: disbursementKind(event.params.payoutKind),
      payablePayoutCount: Number(event.params.payablePayoutCount),
      contributorPayoutTotal: event.params.contributorPayoutTotal,
      beneficiaryAmount: event.params.beneficiaryAmount,
      gardenRetainedAmount: event.params.gardenRetainedAmount,
      recognitionSnapshotHash: event.params.recognitionSnapshotHash.toLowerCase(),
      paymentSnapshotHash: event.params.paymentSnapshotHash.toLowerCase(),
      finalized: true,
      finalizedAt: Number(event.params.finalizedAt),
      status: event.params.completedWithoutDispatch ? "COMPLETE" : "PENDING",
      updatedAt: event.block.timestamp,
    };
    context.CommitmentPayoutPlan.set(next);
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "DisbursementQueued" },
  async ({ event, context }) => {
    const kind = disbursementKind(event.params.kind);
    const entityId = disbursementId(event.chainId, event.params.disbursementId);
    const planEntityId =
      event.params.payoutPlanId === 0n
        ? undefined
        : payoutPlanId(event.chainId, event.params.payoutPlanId);
    const plan = planEntityId ? await context.CommitmentPayoutPlan.get(planEntityId) : undefined;
    const garden = normalizeAddress(event.params.garden);
    const executorGarden = normalizeAddress(event.params.executorGarden);
    const contributor = optionalAddress(event.params.contributor);
    const entity: Disbursement = {
      id: entityId,
      chainId: event.chainId,
      disbursementId: event.params.disbursementId,
      garden,
      gardenId: garden,
      executorGarden,
      executorGardenId: executorGarden,
      commitmentId: event.params.commitmentId === 0n ? undefined : event.params.commitmentId,
      commitmentEntityId:
        event.params.commitmentId === 0n
          ? undefined
          : `${event.chainId}-${event.params.commitmentId}`,
      payoutPlanId: event.params.payoutPlanId === 0n ? undefined : event.params.payoutPlanId,
      payoutPlanEntityId: planEntityId,
      contributor,
      contributorEntityId: contributor,
      settlementFlow: plan?.settlementFlow,
      kind,
      fundingRoute: fundingRoute(event.params.fundingRoute),
      source: normalizeAddress(event.params.source),
      recipient: normalizeAddress(event.params.recipient),
      token: normalizeAddress(event.params.token),
      amount: event.params.amount,
      state: "QUEUED",
      batchId: undefined,
      batchEntityId: undefined,
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
    context.Disbursement.set(entity);

    if (plan) {
      const nextBase = {
        ...plan,
        preparedPayoutCount: plan.preparedPayoutCount + 1,
        beneficiaryDisbursementId:
          kind === "GARDEN_BENEFICIARY"
            ? event.params.disbursementId
            : plan.beneficiaryDisbursementId,
        beneficiaryDisbursementEntityId:
          kind === "GARDEN_BENEFICIARY" ? entityId : plan.beneficiaryDisbursementEntityId,
        disbursementEntityIds: [...plan.disbursementEntityIds, entityId],
        updatedAt: event.block.timestamp,
      };
      context.CommitmentPayoutPlan.set({
        ...nextBase,
        status: payoutStatus(nextBase),
      });
    }
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "SettlementAcknowledged" },
  async ({ event, context }) => {
    if (event.params.isBatch) return;
    const entityId = disbursementId(event.chainId, event.params.subjectId);
    const existing = await context.Disbursement.get(entityId);
    if (!existing) return;
    const next: Disbursement = {
      ...existing,
      state: event.params.success ? "CONFIRMED" : "FAILED",
      executionKey: event.params.executionKey.toLowerCase(),
      commandMessageId: event.params.originatingCommandMessageId.toLowerCase(),
      acknowledgmentMessageId: event.params.acknowledgmentMessageId.toLowerCase(),
      failureCode: Number(event.params.failureCode),
      confirmedAt: event.params.success ? event.block.timestamp : undefined,
      updatedAt: event.block.timestamp,
    };
    context.Disbursement.set(next);
    if (!existing.payoutPlanEntityId) return;
    const plan = await context.CommitmentPayoutPlan.get(existing.payoutPlanEntityId);
    if (!plan) return;
    const updatedPlanBase = {
      ...plan,
      confirmedPayoutCount: plan.confirmedPayoutCount + (event.params.success ? 1 : 0),
      failedPayoutCount: plan.failedPayoutCount + (event.params.success ? 0 : 1),
      updatedAt: event.block.timestamp,
    };
    context.CommitmentPayoutPlan.set({
      ...updatedPlanBase,
      status: payoutStatus(updatedPlanBase),
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
      updatedAt: event.block.timestamp,
    });
    if (!existing.payoutPlanEntityId) return;
    const plan = await context.CommitmentPayoutPlan.get(existing.payoutPlanEntityId);
    if (!plan) return;
    const updatedPlanBase = {
      ...plan,
      failedPayoutCount: Math.max(0, plan.failedPayoutCount - 1),
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
    if (!existing.payoutPlanEntityId) return;
    const plan = await context.CommitmentPayoutPlan.get(existing.payoutPlanEntityId);
    if (!plan) return;
    const fromFailed = Number(event.params.cancelledFromState) === 4;
    const updatedPlanBase = {
      ...plan,
      failedPayoutCount: fromFailed
        ? Math.max(0, plan.failedPayoutCount - 1)
        : plan.failedPayoutCount,
      cancelledPayoutCount: plan.cancelledPayoutCount + 1,
      updatedAt: event.block.timestamp,
    };
    context.CommitmentPayoutPlan.set({
      ...updatedPlanBase,
      status: payoutStatus(updatedPlanBase),
    });
  }
);
