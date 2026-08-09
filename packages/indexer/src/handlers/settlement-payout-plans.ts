import { indexer, type CommitmentPayoutPlan } from "envio";

import {
  ZERO_BYTES32,
  configurationId,
  disbursementKind,
  optionalAddress,
  payoutPlanId,
  settlementFlow,
  sourceConfiguration,
} from "./settlement-projections";
import { tryPublishContributorSnapshot } from "./settlement-snapshots";
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
      contributorPayoutEntityIds: [],
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
    await tryPublishContributorSnapshot(
      context,
      event.chainId,
      event.params.payoutPlanId,
      1n,
      event.block.timestamp
    );
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
