import type { Commitment, CommitmentWorkAttribution } from "envio";
import { keccak256, toBytes } from "viem";

import {
  commitmentMemberId,
  createContributor,
  createWorkAttribution,
  cursorWins,
  poolingEntityId,
  sortedUnique,
  workAttributionId,
} from "./commitment-pool-projections";
import { addContributorToIndex } from "./commitment-pool-contributors";
import {
  getCommitment,
  reconcileMemberHistory,
  reconcileRecognitionWeights,
} from "./commitment-pool-members";
import { type PoolingContext, type RuntimeEvent, value } from "./commitment-pool-runtime";
import { applyUnitSummaryDeltas } from "./commitment-pool-unit-summary";
import { normalizeAddress } from "./shared";

export async function handleWorkEvent(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const commitmentId = value<bigint>(event, "commitmentId");
  const workUID = value<string>(event, "workUID").toLowerCase();
  const id = workAttributionId(event.chainId, workUID);
  const existing =
    (await context.CommitmentWorkAttribution.get(id)) ??
    createWorkAttribution(event.chainId, commitmentId, workUID, event.block.timestamp);
  if (event.eventName === "WorkLinked" || event.eventName === "WorkUnlinked") {
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        existing.linkLifecycleBlockNumber,
        existing.linkLifecycleLogIndex
      )
    )
      return;
    const linking = event.eventName === "WorkLinked";
    const contributor = linking
      ? normalizeAddress(value<string>(event, "contributor"))
      : existing.contributor;
    const updatedAttribution = {
      ...existing,
      linkSeen: linking || existing.linkSeen,
      contributor,
      contributorEntityId:
        contributor === undefined
          ? undefined
          : commitmentMemberId(event.chainId, commitmentId, contributor),
      requirementIndex: linking
        ? Number(value<bigint>(event, "requirementIndex"))
        : existing.requirementIndex,
      operationKey: linking
        ? value<string>(event, "operationKey").toLowerCase()
        : existing.operationKey,
      linked: linking,
      linkLifecycleBlockNumber: BigInt(event.block.number),
      linkLifecycleLogIndex: event.logIndex,
      linkedBy: linking ? normalizeAddress(value<string>(event, "linker")) : existing.linkedBy,
      linkedAt: linking ? (existing.linkedAt ?? event.block.timestamp) : existing.linkedAt,
      unlinkedBy: linking
        ? existing.unlinkedBy
        : normalizeAddress(value<string>(event, "unlinker")),
      unlinkedAt: linking ? existing.unlinkedAt : event.block.timestamp,
      updatedAt: Math.max(existing.updatedAt, event.block.timestamp),
    } satisfies CommitmentWorkAttribution;
    context.CommitmentWorkAttribution.set(updatedAttribution);
    const linkDelta = existing.linked === linking ? 0 : linking ? 1 : -1;
    const commitment = await getCommitment(event, context, commitmentId);
    const updatedCommitment = {
      ...commitment,
      workUIDs: linking
        ? sortedUnique([...commitment.workUIDs, workUID])
        : commitment.workUIDs.filter((candidate) => candidate !== workUID),
      updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
    } satisfies Commitment;
    context.Commitment.set(updatedCommitment);
    if (commitment.poolId !== undefined && linkDelta !== 0) {
      const pool = await context.CommitmentPool.get(
        poolingEntityId(event.chainId, commitment.poolId)
      );
      if (pool) {
        const nextWorkLinkedCount = pool.workLinkedCount + BigInt(linkDelta);
        context.CommitmentPool.set({
          ...pool,
          workLinkedCount: nextWorkLinkedCount < 0n ? 0n : nextWorkLinkedCount,
          updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
        });
      }
    }
    if (contributor && linkDelta !== 0) {
      const contributorId = commitmentMemberId(event.chainId, commitmentId, contributor);
      const contributorRow =
        (await context.CommitmentContributor.get(contributorId)) ??
        createContributor(event.chainId, commitmentId, contributor, event.block.timestamp);
      const uncountedDelta = updatedAttribution.creditActive ? 0 : linkDelta;
      context.CommitmentContributor.set({
        ...contributorRow,
        uncountedLinkedWorkCount: Math.max(
          0,
          contributorRow.uncountedLinkedWorkCount + uncountedDelta
        ),
        updatedAt: Math.max(contributorRow.updatedAt, event.block.timestamp),
      });
      await addContributorToIndex(event, context, commitmentId, contributorId);
    }
    return;
  }
  const sequence = value<bigint>(event, "decisionSequence");
  if (existing.latestDecisionSequence !== undefined && sequence <= existing.latestDecisionSequence)
    return;
  const counted = event.eventName === "ApprovedWorkCounted";
  const contributor = normalizeAddress(value<string>(event, "contributor"));
  const creditDelta = existing.creditActive === counted ? 0 : counted ? 1 : -1;
  context.CommitmentWorkAttribution.set({
    ...existing,
    contributor,
    contributorEntityId: commitmentMemberId(
      event.chainId,
      commitmentId,
      value<string>(event, "contributor")
    ),
    requirementIndex: Number(value<bigint>(event, "requirementIndex")),
    creditActive: counted,
    latestDecisionSequence: sequence,
    latestDecisionUID: value<string>(event, counted ? "approvalUID" : "decisionUID").toLowerCase(),
    updatedAt: Math.max(existing.updatedAt, event.block.timestamp),
  });
  const commitment = await getCommitment(event, context, commitmentId);
  context.Commitment.set({
    ...commitment,
    approvedUnits: value<bigint>(event, "approvedUnits"),
    updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
  });
  const requirementIndex = Number(value<bigint>(event, "requirementIndex"));
  const requirementId = `${event.chainId}-${commitmentId}-${requirementIndex}`;
  const requirement = await context.CommitmentRequirement.get(requirementId);
  if (requirement) {
    context.CommitmentRequirement.set({
      ...requirement,
      approvedCount: Number(value<bigint>(event, "approvedWorkCount")),
      updatedAt: Math.max(requirement.updatedAt, event.block.timestamp),
    });
  }
  const contributorId = commitmentMemberId(event.chainId, commitmentId, contributor);
  const contributorRow =
    (await context.CommitmentContributor.get(contributorId)) ??
    createContributor(event.chainId, commitmentId, contributor, event.block.timestamp);
  context.CommitmentContributor.set({
    ...contributorRow,
    approvedWorkCredits: Math.max(0, contributorRow.approvedWorkCredits + creditDelta),
    uncountedLinkedWorkCount:
      existing.linked && creditDelta !== 0
        ? Math.max(0, contributorRow.uncountedLinkedWorkCount - creditDelta)
        : contributorRow.uncountedLinkedWorkCount,
    updatedAt: Math.max(contributorRow.updatedAt, event.block.timestamp),
  });
  await addContributorToIndex(event, context, commitmentId, contributorId);
  if (commitment.poolId !== undefined && creditDelta !== 0) {
    const pool = await context.CommitmentPool.get(
      poolingEntityId(event.chainId, commitment.poolId)
    );
    if (pool) {
      const nextWorkApprovedCount = pool.workApprovedCount + BigInt(creditDelta);
      context.CommitmentPool.set({
        ...pool,
        workApprovedCount: nextWorkApprovedCount < 0n ? 0n : nextWorkApprovedCount,
        updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
      });
    }
  }
  if (commitment.poolId !== undefined && commitment.unitLabel) {
    const approvedDelta = counted
      ? value<bigint>(event, "newlyApprovedUnits")
      : -value<bigint>(event, "removedApprovedUnits");
    await applyUnitSummaryDeltas(
      context,
      event.chainId,
      commitment.poolId,
      commitment.cycleId,
      commitment.unitLabel,
      event.block.timestamp,
      { approved: approvedDelta }
    );
  }
  await reconcileMemberHistory(context, commitment, event.block.timestamp);
  await reconcileRecognitionWeights(context, commitment, event.block.timestamp);
}

export async function handleEvidence(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const commitmentId = value<bigint>(event, "commitmentId");
  const cid = value<string>(event, "cid");
  const attacher = normalizeAddress(value<string>(event, "attacher"));
  const indexId = poolingEntityId(event.chainId, commitmentId);
  const evidenceIndex = await context.CommitmentEvidenceAttributionIndex.get(indexId);
  const commitment = await getCommitment(event, context, commitmentId);
  const attributionIds = [...(evidenceIndex?.attributionEntityIds ?? [])];
  for (const rawContributor of value<readonly string[]>(event, "creditedContributors")) {
    const contributor = normalizeAddress(rawContributor);
    const id = `${event.chainId}-${commitmentId}-${keccak256(toBytes(cid))}-${contributor}`;
    if (!(await context.CommitmentEvidenceAttribution.get(id))) {
      context.CommitmentEvidenceAttribution.set({
        id,
        chainId: event.chainId,
        commitmentId,
        commitmentEntityId: indexId,
        cid,
        contributor,
        contributorEntityId: commitmentMemberId(event.chainId, commitmentId, contributor),
        attacher,
        confirmed: commitment.state === "FULFILLED",
        createdAt: event.block.timestamp,
        updatedAt: event.block.timestamp,
      });
      const contributorId = commitmentMemberId(event.chainId, commitmentId, contributor);
      const contributorRow =
        (await context.CommitmentContributor.get(contributorId)) ??
        createContributor(event.chainId, commitmentId, contributor, event.block.timestamp);
      if (contributorRow.evidenceCredits === 0) {
        context.CommitmentContributor.set({
          ...contributorRow,
          evidenceCredits: 1,
          updatedAt: Math.max(contributorRow.updatedAt, event.block.timestamp),
        });
      }
      await addContributorToIndex(event, context, commitmentId, contributorId);
    }
    attributionIds.push(id);
  }
  context.CommitmentEvidenceAttributionIndex.set({
    id: indexId,
    chainId: event.chainId,
    commitmentId,
    commitmentEntityId: indexId,
    attributionEntityIds: sortedUnique(attributionIds),
    updatedAt: Math.max(evidenceIndex?.updatedAt ?? 0, event.block.timestamp),
  });
  const updated = {
    ...commitment,
    evidenceCIDs: sortedUnique([...commitment.evidenceCIDs, cid]),
    evidenceCount: commitment.evidenceCIDs.includes(cid)
      ? commitment.evidenceCount
      : commitment.evidenceCount + 1,
    updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
  } satisfies Commitment;
  context.Commitment.set(updated);
  await reconcileMemberHistory(context, updated, event.block.timestamp);
  await reconcileRecognitionWeights(context, updated, event.block.timestamp);
}
