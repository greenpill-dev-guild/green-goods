import type { Commitment, CommitmentContributor } from "envio";

import {
  commitmentMemberId,
  createContributor,
  cursorWins,
  poolingEntityId,
  sortedUnique,
} from "./commitment-pool-projections";
import {
  getCommitment,
  reconcileMemberHistory,
  reconcileRecognitionWeights,
} from "./commitment-pool-members";
import { type PoolingContext, type RuntimeEvent, value } from "./commitment-pool-runtime";
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
      assignmentEntityIds: sortedUnique([
        ...(assignmentIndex?.assignmentEntityIds ?? []),
        assignmentId,
      ]),
      updatedAt: Math.max(assignmentIndex?.updatedAt ?? 0, event.block.timestamp),
    });
    return;
  }
  if (
    !cursorWins(
      event.block.number,
      event.logIndex,
      existing.membershipBlockNumber,
      existing.membershipLogIndex
    )
  )
    return;
  const adding = event.eventName === "ContributorAdded";
  const commitment = await getCommitment(event, context, commitmentId);
  const updatedContributor = {
    ...existing,
    additionSeen: adding || existing.additionSeen,
    active: adding,
    isLead: existing.isLead || commitment.leadProvider === contributor,
    membershipBlockNumber: BigInt(event.block.number),
    membershipLogIndex: event.logIndex,
    addedBy: adding ? normalizeAddress(value<string>(event, "addedBy")) : existing.addedBy,
    addedAt: adding ? (existing.addedAt ?? event.block.timestamp) : existing.addedAt,
    removedBy: adding ? existing.removedBy : normalizeAddress(value<string>(event, "removedBy")),
    removedAt: adding ? existing.removedAt : event.block.timestamp,
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
  await reconcileMemberHistory(context, updatedCommitment, event.block.timestamp);
  await reconcileRecognitionWeights(context, updatedCommitment, event.block.timestamp);
}
