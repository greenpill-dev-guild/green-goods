import type {
  Commitment,
  CommitmentContributor,
  CommitmentContributorIndex,
  CommitmentCycle,
  CommitmentPool,
  Hypercert,
  HypercertCommitmentContributorAllocation,
  NeedCommitmentIndex,
} from "envio";

import {
  compareCodeUnits,
  createCommitment,
  poolingEntityId,
  sortedUnique,
} from "./commitment-pool-projections";

type EntityStore<T extends { readonly id: string }> = {
  get(id: string): Promise<T | undefined>;
  set(entity: T): void;
};

export type HypercertAllocationContext = {
  Commitment: EntityStore<Commitment>;
  CommitmentContributor: EntityStore<CommitmentContributor>;
  CommitmentContributorIndex: EntityStore<CommitmentContributorIndex>;
  CommitmentCycle: EntityStore<CommitmentCycle>;
  Hypercert: EntityStore<Hypercert>;
  HypercertCommitmentContributorAllocation: EntityStore<HypercertCommitmentContributorAllocation>;
  NeedCommitmentIndex: EntityStore<NeedCommitmentIndex>;
};

function distributeUnits<T extends { readonly id: string; readonly weight: number }>(
  units: bigint,
  rows: readonly T[]
): ReadonlyMap<string, bigint> {
  if (rows.length === 0) return new Map();
  const provisional = rows.map((row) => {
    const numerator = units * BigInt(row.weight);
    return { row, units: numerator / 10_000n, remainder: numerator % 10_000n };
  });
  const remaining = units - provisional.reduce((total, row) => total + row.units, 0n);
  const remainderOrder = [...provisional].sort((left, right) => {
    if (left.remainder !== right.remainder) return left.remainder > right.remainder ? -1 : 1;
    return compareCodeUnits(left.row.id, right.row.id);
  });
  const awarded = new Set(remainderOrder.slice(0, Number(remaining)).map((row) => row.row.id));
  return new Map(
    provisional.map((row) => [row.row.id, row.units + (awarded.has(row.row.id) ? 1n : 0n)])
  );
}

async function contributorWeights(
  context: HypercertAllocationContext,
  commitment: Commitment,
  cycle: CommitmentCycle
): Promise<
  ReadonlyArray<{ readonly row: CommitmentContributor; readonly weight: number }> | undefined
> {
  const index = await context.CommitmentContributorIndex.get(commitment.id);
  const active = (
    await Promise.all(
      (index?.contributorEntityIds ?? []).map((id) => context.CommitmentContributor.get(id))
    )
  )
    .filter((row): row is CommitmentContributor => Boolean(row?.active))
    .sort((left, right) => compareCodeUnits(left.contributor, right.contributor));
  if (active.length !== commitment.frozenContributorCount) return undefined;
  const eligible = active.filter((row) => row.approvedWorkCredits + row.evidenceCredits > 0);
  if (eligible.length === 0) return undefined;
  const equalBps =
    cycle.equalParticipationBps + cycle.verifiedContributionBps === 10_000
      ? cycle.equalParticipationBps
      : 2_000;
  const verifiedBps = 10_000 - equalBps;
  const equalBase = Math.floor(equalBps / eligible.length);
  const equalRemainderIds = new Set(
    eligible.slice(0, equalBps % eligible.length).map((row) => row.id)
  );
  const totalCredits = eligible.reduce(
    (total, row) => total + row.approvedWorkCredits + row.evidenceCredits,
    0
  );
  const verified = eligible.map((row) => {
    const numerator = verifiedBps * (row.approvedWorkCredits + row.evidenceCredits);
    return {
      id: row.id,
      account: row.contributor,
      floor: Math.floor(numerator / totalCredits),
      remainder: numerator % totalCredits,
    };
  });
  const verifiedRemainder = verifiedBps - verified.reduce((total, row) => total + row.floor, 0);
  const verifiedRemainderIds = new Set(
    [...verified]
      .sort(
        (left, right) =>
          right.remainder - left.remainder || compareCodeUnits(left.account, right.account)
      )
      .slice(0, verifiedRemainder)
      .map((row) => row.id)
  );
  return eligible.map((row) => {
    const verifiedRow = verified.find((candidate) => candidate.id === row.id);
    const weight =
      equalBase +
      (equalRemainderIds.has(row.id) ? 1 : 0) +
      (verifiedRow?.floor ?? 0) +
      (verifiedRemainderIds.has(row.id) ? 1 : 0);
    return { row, weight };
  });
}

async function expandCommitmentAllocations(
  context: HypercertAllocationContext,
  hypercert: Hypercert,
  timestamp: number
): Promise<void> {
  if (hypercert.bundleKind !== "COMMITMENT" || hypercert.commitmentIds.length === 0) return;
  const rows = await Promise.all(
    hypercert.commitmentIds.map((id) =>
      context.Commitment.get(poolingEntityId(hypercert.chainId, id))
    )
  );
  if (
    rows.some(
      (row) =>
        !row ||
        !row.creationSeen ||
        row.state !== "FULFILLED" ||
        row.cycleId === undefined ||
        !row.contributorsFrozen ||
        row.frozenContributorCount === undefined
    )
  )
    return;
  const commitments = rows as Commitment[];
  const cycleId = commitments[0]?.cycleId;
  if (cycleId === undefined || commitments.some((row) => row.cycleId !== cycleId)) return;
  const cycle = await context.CommitmentCycle.get(poolingEntityId(hypercert.chainId, cycleId));
  if (!cycle) return;
  const gardenersClassUnits = (hypercert.totalUnits * BigInt(cycle.gardenersBps)) / 10_000n;
  const baseBudget = gardenersClassUnits / BigInt(commitments.length);
  const extraBudgets = gardenersClassUnits % BigInt(commitments.length);
  const weightedCommitments = await Promise.all(
    commitments.map(async (commitment, index) => ({
      commitment,
      commitmentBudget: baseBudget + (BigInt(index) < extraBudgets ? 1n : 0n),
      weights: await contributorWeights(context, commitment, cycle),
    }))
  );
  if (weightedCommitments.some(({ weights }) => weights === undefined)) return;
  for (const { commitment, commitmentBudget, weights } of weightedCommitments) {
    if (!weights) return;
    const units = distributeUnits(
      commitmentBudget,
      weights.map(({ row, weight }) => ({ id: row.id, weight }))
    );
    for (const { row, weight } of weights) {
      if (row.recognitionWeightBps !== weight) {
        context.CommitmentContributor.set({
          ...row,
          recognitionWeightBps: weight,
          updatedAt: Math.max(row.updatedAt, timestamp),
        });
      }
      const id = `${hypercert.chainId}-${hypercert.tokenId}-${commitment.commitmentId}-${row.contributor}`;
      const existing = await context.HypercertCommitmentContributorAllocation.get(id);
      context.HypercertCommitmentContributorAllocation.set({
        id,
        chainId: hypercert.chainId,
        hypercertId: hypercert.tokenId,
        hypercertEntityId: hypercert.id,
        commitmentId: commitment.commitmentId,
        commitmentEntityId: commitment.id,
        contributor: row.contributor,
        contributorEntityId: row.id,
        recognitionWeightBps: weight,
        commitmentGardenersClassUnits: commitmentBudget,
        recognitionUnits: units.get(row.id) ?? 0n,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: Math.max(existing?.updatedAt ?? 0, timestamp),
      });
    }
    if (commitment.needUID) {
      const needId = `${hypercert.chainId}-${commitment.needUID.toLowerCase()}`;
      const need = await context.NeedCommitmentIndex.get(needId);
      if (need) {
        context.NeedCommitmentIndex.set({
          ...need,
          hypercertEntityIds: sortedUnique([...need.hypercertEntityIds, hypercert.id]),
          updatedAt: Math.max(need.updatedAt, timestamp),
        });
      }
    }
  }
}

export async function indexCommitmentHypercert(
  context: HypercertAllocationContext,
  hypercert: Hypercert,
  timestamp: number
): Promise<void> {
  for (const commitmentId of hypercert.commitmentIds) {
    const entityId = poolingEntityId(hypercert.chainId, commitmentId);
    const commitment =
      (await context.Commitment.get(entityId)) ??
      createCommitment(hypercert.chainId, commitmentId, timestamp);
    context.Commitment.set({
      ...commitment,
      hypercertEntityIds: sortedUnique([...commitment.hypercertEntityIds, hypercert.id]),
      updatedAt: Math.max(commitment.updatedAt, timestamp),
    });
  }
  await expandCommitmentAllocations(context, hypercert, timestamp);
}

export async function reconcileCommitmentHypercerts(
  context: HypercertAllocationContext,
  commitment: Commitment,
  timestamp: number
): Promise<void> {
  for (const hypercertEntityId of commitment.hypercertEntityIds) {
    const hypercert = await context.Hypercert.get(hypercertEntityId);
    if (hypercert) await expandCommitmentAllocations(context, hypercert, timestamp);
  }
}

export async function reconcilePoolCommitmentHypercerts(
  context: HypercertAllocationContext,
  pool: CommitmentPool,
  cycleId: bigint,
  timestamp: number
): Promise<void> {
  for (const commitmentEntityId of pool.childCommitmentEntityIds) {
    const commitment = await context.Commitment.get(commitmentEntityId);
    if (commitment?.cycleId === cycleId) {
      await reconcileCommitmentHypercerts(context, commitment, timestamp);
    }
  }
}
