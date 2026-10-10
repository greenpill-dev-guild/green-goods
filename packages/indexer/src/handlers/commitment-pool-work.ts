import type { Commitment, CommitmentWorkAttribution } from "envio";
import { keccak256, stringToBytes } from "viem";

import {
  commitmentMemberId,
  createContributor,
  createRequirement,
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
import { getPool, type PoolingContext, type RuntimeEvent, value } from "./commitment-pool-runtime";
import { applyUnitSummaryDeltas } from "./commitment-pool-unit-summary";
import { reconcileCommitmentHypercerts } from "./hypercert-allocations";
import { normalizeAddress } from "./shared";

async function reconcileWorkMembership(
  event: RuntimeEvent,
  context: PoolingContext,
  commitmentId: bigint,
  contributor: string | undefined,
  workUID: string,
  linked: boolean,
  creditActive: boolean
): Promise<void> {
  const commitment = await getCommitment(event, context, commitmentId);
  const hasWork = commitment.workUIDs.includes(workUID);
  if (hasWork === linked) return;
  const membershipDelta = linked ? 1 : -1;
  context.Commitment.set({
    ...commitment,
    workUIDs: linked
      ? sortedUnique([...commitment.workUIDs, workUID])
      : commitment.workUIDs.filter((candidate) => candidate !== workUID),
    updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
  });
  if (commitment.poolId !== undefined) {
    const pool = await getPool(event, context, commitment.poolId);
    const nextWorkLinkedCount = pool.workLinkedCount + BigInt(membershipDelta);
    context.CommitmentPool.set({
      ...pool,
      workLinkedCount: nextWorkLinkedCount < 0n ? 0n : nextWorkLinkedCount,
      updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
    });
  }
  if (contributor === undefined) return;
  const contributorId = commitmentMemberId(event.chainId, commitmentId, contributor);
  const contributorRow =
    (await context.CommitmentContributor.get(contributorId)) ??
    createContributor(event.chainId, commitmentId, contributor, event.block.timestamp);
  const uncountedDelta = creditActive ? 0 : membershipDelta;
  context.CommitmentContributor.set({
    ...contributorRow,
    uncountedLinkedWorkCount: Math.max(0, contributorRow.uncountedLinkedWorkCount + uncountedDelta),
    updatedAt: Math.max(contributorRow.updatedAt, event.block.timestamp),
  });
  await addContributorToIndex(event, context, commitmentId, contributorId);
}

export async function handleWorkEvent(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const commitmentId = value<bigint>(event, "commitmentId");
  const workUID = value<string>(event, "workUID").toLowerCase();
  const id = workAttributionId(event.chainId, workUID);
  const existing =
    (await context.CommitmentWorkAttribution.get(id)) ??
    createWorkAttribution(event.chainId, commitmentId, workUID, event.block.timestamp);
  if (event.eventName === "WorkLinked" || event.eventName === "WorkUnlinked") {
    const linking = event.eventName === "WorkLinked";
    const contributor = linking
      ? normalizeAddress(value<string>(event, "contributor"))
      : existing.contributor;
    const linkWins = cursorWins(
      event.block.number,
      event.logIndex,
      existing.linkLifecycleBlockNumber,
      existing.linkLifecycleLogIndex
    );
    const payloadWins =
      linking &&
      cursorWins(
        event.block.number,
        event.logIndex,
        existing.linkPayloadBlockNumber,
        existing.linkPayloadLogIndex
      );
    const baseAttribution: CommitmentWorkAttribution = payloadWins
      ? {
          ...existing,
          commitmentId,
          commitmentEntityId: poolingEntityId(event.chainId, commitmentId),
          linkSeen: true,
          contributor,
          contributorEntityId:
            contributor === undefined
              ? undefined
              : commitmentMemberId(event.chainId, commitmentId, contributor),
          requirementIndex: Number(value<bigint>(event, "requirementIndex")),
          operationKey: value<string>(event, "operationKey").toLowerCase(),
          linkedBy: normalizeAddress(value<string>(event, "linker")),
          linkedAt: event.block.timestamp,
          linkPayloadBlockNumber: BigInt(event.block.number),
          linkPayloadLogIndex: event.logIndex,
          updatedAt: Math.max(existing.updatedAt, event.block.timestamp),
        }
      : existing;
    const ownerChanged = payloadWins && existing.linkSeen && existing.commitmentId !== commitmentId;
    if (ownerChanged) {
      await reconcileWorkMembership(
        event,
        context,
        existing.commitmentId,
        existing.contributor,
        workUID,
        false,
        existing.creditActive
      );
    }
    if (!linkWins) {
      if (!payloadWins) return;
      context.CommitmentWorkAttribution.set(baseAttribution);
      if (contributor) {
        const contributorId = commitmentMemberId(event.chainId, commitmentId, contributor);
        const contributorRow =
          (await context.CommitmentContributor.get(contributorId)) ??
          createContributor(event.chainId, commitmentId, contributor, event.block.timestamp);
        context.CommitmentContributor.set(contributorRow);
        await addContributorToIndex(event, context, commitmentId, contributorId);
      }
      return;
    }
    const updatedAttribution = {
      ...baseAttribution,
      linked: linking,
      linkLifecycleBlockNumber: BigInt(event.block.number),
      linkLifecycleLogIndex: event.logIndex,
      linkedBy: baseAttribution.linkedBy,
      linkedAt: baseAttribution.linkedAt,
      unlinkedBy: linking
        ? existing.unlinkedBy
        : normalizeAddress(value<string>(event, "unlinker")),
      unlinkedAt: linking ? existing.unlinkedAt : event.block.timestamp,
      updatedAt: Math.max(existing.updatedAt, event.block.timestamp),
    } satisfies CommitmentWorkAttribution;
    context.CommitmentWorkAttribution.set(updatedAttribution);
    await reconcileWorkMembership(
      event,
      context,
      commitmentId,
      contributor,
      workUID,
      linking,
      updatedAttribution.creditActive
    );
    return;
  }
  const sequence = value<bigint>(event, "decisionSequence");
  const counted = event.eventName === "ApprovedWorkCounted";
  const contributor = normalizeAddress(value<string>(event, "contributor"));
  const creditDelta = existing.creditActive === counted ? 0 : counted ? 1 : -1;
  let commitment = await getCommitment(event, context, commitmentId);
  if (
    cursorWins(
      event.block.number,
      event.logIndex,
      commitment.approvedUnitsBlockNumber,
      commitment.approvedUnitsLogIndex
    )
  ) {
    commitment = {
      ...commitment,
      approvedUnits: value<bigint>(event, "approvedUnits"),
      approvedUnitsBlockNumber: BigInt(event.block.number),
      approvedUnitsLogIndex: event.logIndex,
      updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
    };
    context.Commitment.set(commitment);
  }
  const requirementIndex = Number(value<bigint>(event, "requirementIndex"));
  const requirementId = `${event.chainId}-${commitmentId}-${requirementIndex}`;
  const requirement =
    (await context.CommitmentRequirement.get(requirementId)) ??
    createRequirement(event.chainId, commitmentId, requirementIndex, event.block.timestamp);
  if (
    cursorWins(
      event.block.number,
      event.logIndex,
      requirement.approvalBlockNumber,
      requirement.approvalLogIndex
    )
  ) {
    context.CommitmentRequirement.set({
      ...requirement,
      approvedCount: Number(value<bigint>(event, "approvedWorkCount")),
      approvalBlockNumber: BigInt(event.block.number),
      approvalLogIndex: event.logIndex,
      updatedAt: Math.max(requirement.updatedAt, event.block.timestamp),
    });
  }
  const approvedDelta = counted
    ? value<bigint>(event, "newlyApprovedUnits")
    : -value<bigint>(event, "removedApprovedUnits");
  if (commitment.poolId !== undefined && commitment.unitLabel) {
    await applyUnitSummaryDeltas(
      context,
      event.chainId,
      commitment.poolId,
      commitment.cycleId,
      commitment.unitLabel,
      event.block.timestamp,
      { approved: approvedDelta }
    );
  } else if (!commitment.creationSeen) {
    commitment = {
      ...commitment,
      pendingApprovedUnitDelta: commitment.pendingApprovedUnitDelta + approvedDelta,
      updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
    };
    context.Commitment.set(commitment);
  }
  if (existing.latestDecisionSequence !== undefined && sequence <= existing.latestDecisionSequence)
    return;
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
    const pool = await getPool(event, context, commitment.poolId);
    const nextWorkApprovedCount = pool.workApprovedCount + BigInt(creditDelta);
    context.CommitmentPool.set({
      ...pool,
      workApprovedCount: nextWorkApprovedCount < 0n ? 0n : nextWorkApprovedCount,
      updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
    });
  } else if (!commitment.creationSeen && creditDelta !== 0) {
    commitment = {
      ...commitment,
      pendingWorkApprovedCountDelta: commitment.pendingWorkApprovedCountDelta + BigInt(creditDelta),
      updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
    };
    context.Commitment.set(commitment);
  }
  const reconciled = await reconcileMemberHistory(context, commitment, event.block.timestamp);
  await reconcileRecognitionWeights(context, reconciled, event.block.timestamp);
  await reconcileCommitmentHypercerts(context, reconciled, event.block.timestamp);
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
    const id = `${event.chainId}-${commitmentId}-${keccak256(stringToBytes(cid))}-${contributor}`;
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
  const reconciled = await reconcileMemberHistory(context, updated, event.block.timestamp);
  await reconcileRecognitionWeights(context, reconciled, event.block.timestamp);
  await reconcileCommitmentHypercerts(context, reconciled, event.block.timestamp);
}
