import {
  indexer,
  type CommitmentPayoutPlan,
  type ContributorPayout,
  type PayoutSnapshotBuffer,
  type PayoutSnapshotCommit,
  type PayoutSnapshotRow,
} from "envio";
import { encodeAbiParameters, keccak256, parseAbiParameters, type Address } from "viem";

import {
  contributorPayoutId,
  payoutPlanId,
  payoutSnapshotId,
  payoutSnapshotRowId,
  payoutStatus,
} from "./settlement-projections";
import { normalizeAddress } from "./shared";

type EntityStore<Entity> = {
  get: (id: string) => Promise<Entity | undefined>;
  set: (entity: Entity) => void;
  deleteUnsafe: (id: string) => void;
};

type SnapshotContext = {
  CommitmentPayoutPlan: EntityStore<CommitmentPayoutPlan>;
  ContributorPayout: EntityStore<ContributorPayout>;
  PayoutSnapshotBuffer: EntityStore<PayoutSnapshotBuffer>;
  PayoutSnapshotCommit: EntityStore<PayoutSnapshotCommit>;
  PayoutSnapshotRow: EntityStore<PayoutSnapshotRow>;
};

const PAYMENT_SNAPSHOT_PARAMETERS = parseAbiParameters(
  "uint256, uint256, uint32, uint256, uint256, (address contributor,address recipient,uint16 recognitionWeightBps,uint16 paymentWeightBps,uint256 amount)[]"
);

export async function tryPublishContributorSnapshot(
  context: SnapshotContext,
  chainId: number,
  rawPayoutPlanId: bigint,
  rawVersion: bigint,
  updatedAt: number
): Promise<void> {
  const snapshotEntityId = payoutSnapshotId(chainId, rawPayoutPlanId, rawVersion);
  const [buffer, commit, plan] = await Promise.all([
    context.PayoutSnapshotBuffer.get(snapshotEntityId),
    context.PayoutSnapshotCommit.get(snapshotEntityId),
    context.CommitmentPayoutPlan.get(payoutPlanId(chainId, rawPayoutPlanId)),
  ]);
  if (
    !buffer ||
    !commit ||
    !plan ||
    plan.payoutKind !== "CONTRIBUTOR_CONSIDERATION" ||
    buffer.rowEntityIds.length !== commit.rowCount
  ) {
    return;
  }

  const rows = await Promise.all(
    buffer.rowEntityIds.map((id) => context.PayoutSnapshotRow.get(id))
  );
  if (rows.some((row) => !row)) return;
  const completeRows = rows as PayoutSnapshotRow[];
  const calculatedHash = keccak256(
    encodeAbiParameters(PAYMENT_SNAPSHOT_PARAMETERS, [
      BigInt(chainId),
      rawPayoutPlanId,
      Number(rawVersion),
      commit.gardenRetainedAmount,
      commit.contributorPayoutTotal,
      completeRows.map((row) => ({
        contributor: row.contributor as Address,
        recipient: row.recipient as Address,
        recognitionWeightBps: row.recognitionWeightBps,
        paymentWeightBps: row.paymentWeightBps,
        amount: row.amount,
      })),
    ])
  );
  if (calculatedHash.toLowerCase() !== commit.paymentSnapshotHash.toLowerCase()) return;

  const contributorPayoutEntityIds = completeRows.map((row) =>
    contributorPayoutId(chainId, rawPayoutPlanId, row.contributor)
  );
  for (const staleEntityId of plan.contributorPayoutEntityIds) {
    if (!contributorPayoutEntityIds.includes(staleEntityId)) {
      context.ContributorPayout.deleteUnsafe(staleEntityId);
    }
  }
  for (let index = 0; index < completeRows.length; ++index) {
    const row = completeRows[index];
    const entityId = contributorPayoutEntityIds[index];
    if (!row || !entityId) continue;
    const existing = await context.ContributorPayout.get(entityId);
    context.ContributorPayout.set({
      id: entityId,
      chainId,
      payoutPlanId: rawPayoutPlanId,
      payoutPlanEntityId: plan.id,
      commitmentId: plan.commitmentId,
      commitmentEntityId: plan.commitmentEntityId,
      contributor: row.contributor,
      contributorEntityId: row.contributor,
      recipient: row.recipient,
      paymentSnapshotVersion: Number(rawVersion),
      recognitionWeightBps: row.recognitionWeightBps,
      paymentWeightBps: row.paymentWeightBps,
      amount: row.amount,
      disbursementId: existing?.disbursementId,
      disbursementEntityId: existing?.disbursementEntityId,
      latestEditReasonCID: commit.reasonCID,
      editedBy: commit.editedBy,
      createdAt: existing?.createdAt ?? row.createdAt,
      updatedAt,
    });
  }

  const nextBase = {
    ...plan,
    gardenRetainedAmount: commit.gardenRetainedAmount,
    contributorPayoutTotal: commit.contributorPayoutTotal,
    recognitionContributorCount: completeRows.length,
    payablePayoutCount: completeRows.filter((row) => row.amount > 0n).length,
    paymentSnapshotVersion: Number(rawVersion),
    paymentSnapshotHash: commit.paymentSnapshotHash,
    latestEditReasonCID: commit.reasonCID,
    contributorPayoutEntityIds,
    updatedAt,
  };
  context.CommitmentPayoutPlan.set({
    ...nextBase,
    status: payoutStatus(nextBase),
  });
}

indexer.onEvent(
  { contract: "SettlementModule", event: "ContributorPayoutSet" },
  async ({ event, context }) => {
    const contributor = normalizeAddress(event.params.contributor);
    const snapshotEntityId = payoutSnapshotId(
      event.chainId,
      event.params.payoutPlanId,
      event.params.paymentSnapshotVersion
    );
    const rowEntityId = payoutSnapshotRowId(
      event.chainId,
      event.params.payoutPlanId,
      event.params.paymentSnapshotVersion,
      contributor
    );
    const [existingBuffer, existingRow] = await Promise.all([
      context.PayoutSnapshotBuffer.get(snapshotEntityId),
      context.PayoutSnapshotRow.get(rowEntityId),
    ]);
    context.PayoutSnapshotRow.set({
      id: rowEntityId,
      chainId: event.chainId,
      payoutPlanId: event.params.payoutPlanId,
      paymentSnapshotVersion: Number(event.params.paymentSnapshotVersion),
      contributor,
      recipient: normalizeAddress(event.params.recipient),
      recognitionWeightBps: Number(event.params.recognitionWeightBps),
      paymentWeightBps: Number(event.params.paymentWeightBps),
      amount: event.params.amount,
      reasonCID: event.params.reasonCID || undefined,
      editedBy: normalizeAddress(event.params.editedBy),
      createdAt: existingRow?.createdAt ?? event.block.timestamp,
      updatedAt: event.block.timestamp,
    });
    context.PayoutSnapshotBuffer.set({
      id: snapshotEntityId,
      chainId: event.chainId,
      payoutPlanId: event.params.payoutPlanId,
      paymentSnapshotVersion: Number(event.params.paymentSnapshotVersion),
      rowEntityIds:
        existingBuffer?.rowEntityIds.includes(rowEntityId) === true
          ? existingBuffer.rowEntityIds
          : [...(existingBuffer?.rowEntityIds ?? []), rowEntityId],
      updatedAt: event.block.timestamp,
    });
    await tryPublishContributorSnapshot(
      context,
      event.chainId,
      event.params.payoutPlanId,
      event.params.paymentSnapshotVersion,
      event.block.timestamp
    );
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "CommitmentPayoutSnapshotCommitted" },
  async ({ event, context }) => {
    const entityId = payoutSnapshotId(
      event.chainId,
      event.params.payoutPlanId,
      event.params.paymentSnapshotVersion
    );
    context.PayoutSnapshotCommit.set({
      id: entityId,
      chainId: event.chainId,
      payoutPlanId: event.params.payoutPlanId,
      paymentSnapshotVersion: Number(event.params.paymentSnapshotVersion),
      rowCount: Number(event.params.rowCount),
      gardenRetainedAmount: event.params.gardenRetainedAmount,
      contributorPayoutTotal: event.params.contributorPayoutTotal,
      paymentSnapshotHash: event.params.paymentSnapshotHash.toLowerCase(),
      reasonCID: event.params.reasonCID || undefined,
      editedBy: normalizeAddress(event.params.editedBy),
      committedAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
    });
    await tryPublishContributorSnapshot(
      context,
      event.chainId,
      event.params.payoutPlanId,
      event.params.paymentSnapshotVersion,
      event.block.timestamp
    );
  }
);
