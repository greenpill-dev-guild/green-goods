import type { Commitment, CommitmentContributor } from "envio";

import {
  commitmentMemberId,
  createContributor,
  cursorWins,
  poolingEntityId,
  sortedUnique,
  sortedUniqueByNumericSuffix,
} from "./commitment-pool-projections";
import {
  getCommitment,
  reconcileMemberHistory,
  reconcileRecognitionWeights,
} from "./commitment-pool-members";
import { type PoolingContext, type RuntimeEvent, value } from "./commitment-pool-runtime";
import { reconcileCommitmentHypercerts } from "./hypercert-allocations";
import { normalizeAddress } from "./shared";

export async function addContributorToIndex(
  event: RuntimeEvent,
  context: PoolingContext,
  commitmentId: bigint,
  contributorEntityId: string
): Promise<void> {
  const indexId = poolingEntityId(event.chainId, commitmentId);
  const contributorIndex = await context.CommitmentContributorIndex.get(indexId);
  context.CommitmentContributorIndex.set({
    id: indexId,
    chainId: event.chainId,
    commitmentId,
    commitmentEntityId: indexId,
    contributorEntityIds: sortedUnique([
      ...(contributorIndex?.contributorEntityIds ?? []),
      contributorEntityId,
    ]),
    updatedAt: Math.max(contributorIndex?.updatedAt ?? 0, event.block.timestamp),
  });
}

export async function handleContributorEvent(
  event: RuntimeEvent,
  context: PoolingContext
): Promise<void> {
  const commitmentId = value<bigint>(event, "commitmentId");
  const contributor = normalizeAddress(value<string>(event, "contributor"));
  const id = commitmentMemberId(event.chainId, commitmentId, contributor);
  const existing =
    (await context.CommitmentContributor.get(id)) ??
    createContributor(event.chainId, commitmentId, contributor, event.block.timestamp);
  if (event.eventName === "ContributorRequirementAssigned") {
    const requirementIndex = Number(value<bigint>(event, "requirementIndex"));
    const assignmentId = `${id}-${requirementIndex}`;
    const assignment = await context.CommitmentContributorRequirementAssignment.get(assignmentId);
    if (
      assignment &&
      !cursorWins(
        event.block.number,
        event.logIndex,
        assignment.lifecycleBlockNumber,
        assignment.lifecycleLogIndex
      )
    )
      return;
    const assigned = value<boolean>(event, "assigned");
    context.CommitmentContributorRequirementAssignment.set({
      id: assignmentId,
      chainId: event.chainId,
      commitmentId,
      commitmentEntityId: poolingEntityId(event.chainId, commitmentId),
      contributor,
      contributorEntityId: id,
      requirementIndex,
      assigned,
      lifecycleBlockNumber: BigInt(event.block.number),
      lifecycleLogIndex: event.logIndex,
      updatedAt: event.block.timestamp,
    });
    context.CommitmentContributor.set({
      ...existing,
      requirementIndexes: assigned
        ? sortedUnique([...existing.requirementIndexes, requirementIndex])
        : existing.requirementIndexes.filter((candidate) => candidate !== requirementIndex),
      updatedAt: Math.max(existing.updatedAt, event.block.timestamp),
    });
    const indexId = poolingEntityId(event.chainId, commitmentId);
    const assignmentIndex = await context.CommitmentContributorRequirementIndex.get(indexId);
    context.CommitmentContributorRequirementIndex.set({
      id: indexId,
      chainId: event.chainId,
      commitmentId,
      commitmentEntityId: indexId,
      assignmentEntityIds: sortedUniqueByNumericSuffix([
        ...(assignmentIndex?.assignmentEntityIds ?? []),
        assignmentId,
      ]),
      updatedAt: Math.max(assignmentIndex?.updatedAt ?? 0, event.block.timestamp),
    });
    return;
  }
  const adding = event.eventName === "ContributorAdded";
  const commitment = await getCommitment(event, context, commitmentId);
  const membershipWins = cursorWins(
    event.block.number,
    event.logIndex,
    existing.membershipBlockNumber,
    existing.membershipLogIndex
  );
  const removalWins =
    !adding &&
    cursorWins(
      event.block.number,
      event.logIndex,
      existing.removalBlockNumber,
      existing.removalLogIndex
    );
  if (!membershipWins) {
    if (!adding) {
      if (!removalWins) return;
      context.CommitmentContributor.set({
        ...existing,
        removedBy: normalizeAddress(value<string>(event, "removedBy")),
        removedAt: event.block.timestamp,
        removalBlockNumber: BigInt(event.block.number),
        removalLogIndex: event.logIndex,
        updatedAt: Math.max(existing.updatedAt, event.block.timestamp),
      });
      return;
    }
    if (existing.additionSeen) return;
    context.CommitmentContributor.set({
      ...existing,
      additionSeen: true,
      isLead: existing.isLead || commitment.leadProvider === contributor,
      addedBy: normalizeAddress(value<string>(event, "addedBy")),
      addedAt: existing.addedAt ?? event.block.timestamp,
      updatedAt: Math.max(existing.updatedAt, event.block.timestamp),
    });
    await addContributorToIndex(event, context, commitmentId, id);
    context.Commitment.set({
      ...commitment,
      contributorEntityIds: sortedUnique([...commitment.contributorEntityIds, id]),
      updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
    });
    return;
  }
  const updatedContributor = {
    ...existing,
    additionSeen: adding || existing.additionSeen,
    active: adding,
    isLead: existing.isLead || commitment.leadProvider === contributor,
    membershipBlockNumber: BigInt(event.block.number),
    membershipLogIndex: event.logIndex,
    addedBy: adding ? normalizeAddress(value<string>(event, "addedBy")) : existing.addedBy,
    addedAt: adding ? (existing.addedAt ?? event.block.timestamp) : existing.addedAt,
    removedBy: removalWins
      ? normalizeAddress(value<string>(event, "removedBy"))
      : existing.removedBy,
    removedAt: removalWins ? event.block.timestamp : existing.removedAt,
    removalBlockNumber: removalWins ? BigInt(event.block.number) : existing.removalBlockNumber,
    removalLogIndex: removalWins ? event.logIndex : existing.removalLogIndex,
    updatedAt: Math.max(existing.updatedAt, event.block.timestamp),
  } satisfies CommitmentContributor;
  context.CommitmentContributor.set(updatedContributor);
  await addContributorToIndex(event, context, commitmentId, id);
  const activeDelta = existing.active === adding ? 0 : adding ? 1 : -1;
  const updatedCommitment = {
    ...commitment,
    contributorCount: Math.max(0, commitment.contributorCount + activeDelta),
    contributorEntityIds: sortedUnique([...commitment.contributorEntityIds, id]),
    updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
  } satisfies Commitment;
  context.Commitment.set(updatedCommitment);
  const reconciled = await reconcileMemberHistory(
    context,
    updatedCommitment,
    event.block.timestamp
  );
  await reconcileRecognitionWeights(context, reconciled, event.block.timestamp);
  await reconcileCommitmentHypercerts(context, reconciled, event.block.timestamp);
}
