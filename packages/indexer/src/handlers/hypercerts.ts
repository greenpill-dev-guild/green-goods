import {
  indexer,
  type Commitment,
  type CommitmentContributor,
  type CommitmentContributorIndex,
  type CommitmentCycle,
  type Enum,
  type Hypercert,
  type HypercertClaim,
  type HypercertCommitmentContributorAllocation,
  type NeedCommitmentIndex,
} from "envio";

type HypercertStatus = Enum<"HypercertStatus">;

import {
  createDefaultHypercert,
  fetchJson,
  getTxHash,
  parseHypercertMetadata,
  ZERO_ADDRESS,
} from "./shared";
import { poolingEntityId, sortedUnique } from "./commitment-pool-projections";

type EntityStore<T extends { readonly id: string }> = {
  get(id: string): Promise<T | undefined>;
  set(entity: T): void;
};

type CommitmentAllocationContext = {
  Commitment: EntityStore<Commitment>;
  CommitmentContributor: EntityStore<CommitmentContributor>;
  CommitmentContributorIndex: EntityStore<CommitmentContributorIndex>;
  CommitmentCycle: EntityStore<CommitmentCycle>;
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
    return left.row.id.localeCompare(right.row.id);
  });
  const awarded = new Set(remainderOrder.slice(0, Number(remaining)).map((row) => row.row.id));
  return new Map(
    provisional.map((row) => [row.row.id, row.units + (awarded.has(row.row.id) ? 1n : 0n)])
  );
}

async function contributorWeights(
  context: CommitmentAllocationContext,
  commitment: Commitment,
  cycle: CommitmentCycle,
  timestamp: number
): Promise<ReadonlyArray<{ readonly row: CommitmentContributor; readonly weight: number }>> {
  const index = await context.CommitmentContributorIndex.get(commitment.id);
  const eligible = (
    await Promise.all(
      (index?.contributorEntityIds ?? []).map((id) => context.CommitmentContributor.get(id))
    )
  )
    .filter(
      (row): row is CommitmentContributor =>
        Boolean(row?.active) && (row?.approvedWorkCredits ?? 0) + (row?.evidenceCredits ?? 0) > 0
    )
    .sort((left, right) => left.contributor.localeCompare(right.contributor));
  if (eligible.length === 0) return [];
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
          right.remainder - left.remainder || left.account.localeCompare(right.account)
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
    if (row.recognitionWeightBps !== weight) {
      context.CommitmentContributor.set({
        ...row,
        recognitionWeightBps: weight,
        updatedAt: Math.max(row.updatedAt, timestamp),
      });
    }
    return { row, weight };
  });
}

async function expandCommitmentAllocations(
  context: CommitmentAllocationContext,
  chainId: number,
  hypercertId: bigint,
  commitmentIds: readonly bigint[],
  totalUnits: bigint,
  timestamp: number
): Promise<void> {
  const commitments = (
    await Promise.all(
      commitmentIds.map((id) => context.Commitment.get(poolingEntityId(chainId, id)))
    )
  )
    .filter(
      (row): row is Commitment =>
        Boolean(row) && row?.state === "FULFILLED" && row.cycleId !== undefined
    )
    .sort((left, right) =>
      left.commitmentId < right.commitmentId ? -1 : left.commitmentId > right.commitmentId ? 1 : 0
    );
  if (commitments.length === 0) return;
  const cycleId = commitments[0]?.cycleId;
  if (cycleId === undefined || commitments.some((row) => row.cycleId !== cycleId)) return;
  const cycle = await context.CommitmentCycle.get(poolingEntityId(chainId, cycleId));
  if (!cycle) return;
  const gardenersClassUnits = (totalUnits * BigInt(cycle.gardenersBps)) / 10_000n;
  const baseBudget = gardenersClassUnits / BigInt(commitments.length);
  const extraBudgets = gardenersClassUnits % BigInt(commitments.length);
  for (let index = 0; index < commitments.length; index += 1) {
    const commitment = commitments[index];
    if (!commitment) continue;
    const commitmentBudget = baseBudget + (BigInt(index) < extraBudgets ? 1n : 0n);
    const weights = await contributorWeights(context, commitment, cycle, timestamp);
    const units = distributeUnits(
      commitmentBudget,
      weights.map(({ row, weight }) => ({ id: row.id, weight }))
    );
    for (const { row, weight } of weights) {
      const id = `${chainId}-${hypercertId}-${commitment.commitmentId}-${row.contributor}`;
      const existing = await context.HypercertCommitmentContributorAllocation.get(id);
      context.HypercertCommitmentContributorAllocation.set({
        id,
        chainId,
        hypercertId,
        hypercertEntityId: poolingEntityId(chainId, hypercertId),
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
      const needId = `${chainId}-${commitment.needUID.toLowerCase()}`;
      const need = await context.NeedCommitmentIndex.get(needId);
      if (need) {
        context.NeedCommitmentIndex.set({
          ...need,
          hypercertEntityIds: sortedUnique([
            ...need.hypercertEntityIds,
            poolingEntityId(chainId, hypercertId),
          ]),
          updatedAt: Math.max(need.updatedAt, timestamp),
        });
      }
    }
  }
}

// ============================================================================
// HYPERCERT EVENT HANDLERS
// ============================================================================

// Handler for HypercertMinter TransferSingle event (detects mints)
// This fires for all ERC1155 transfers, we filter for mints (from = zero address)
indexer.onEvent(
  { contract: "HypercertMinter", event: "TransferSingle" },
  async ({ event, context }) => {
    // Only process mints (from zero address)
    if (event.params.from.toLowerCase() !== ZERO_ADDRESS) {
      return;
    }

    const tokenId = event.params.id;
    const hypercertId = `${event.chainId}-${tokenId.toString()}`;
    const timestamp = event.block.timestamp;

    // Check if hypercert already exists (may be created by ClaimStored event first)
    const existingHypercert = await context.Hypercert.get(hypercertId);

    if (existingHypercert) {
      // Idempotency: skip if this is the same transaction replaying
      if (existingHypercert.txHash === getTxHash(event.transaction)) {
        return;
      }

      const hasMintedBy = Boolean(existingHypercert.mintedBy);

      if (!hasMintedBy) {
        // Update with mint details
        const updatedHypercert: Hypercert = {
          ...existingHypercert,
          totalUnits: existingHypercert.totalUnits || event.params.value,
          mintedBy: event.params.operator,
          mintedAt: timestamp,
          txHash: getTxHash(event.transaction),
          updatedAt: timestamp,
        };
        context.Hypercert.set(updatedHypercert);
        context.log.info("Hypercert minted", {
          hypercertId,
          units: event.params.value,
          chainId: event.chainId,
          blockNumber: event.block.number,
          txHash: getTxHash(event.transaction),
        });
        return;
      }

      // Treat subsequent mint-from-zero transfers as claims
      const claimant = event.params.to;
      const claimId = `${event.chainId}-${tokenId.toString()}-${claimant}`;

      // Idempotency: check if claim already exists
      const existingClaim = await context.HypercertClaim.get(claimId);
      if (existingClaim) {
        return;
      }

      const claim: HypercertClaim = {
        id: claimId,
        chainId: event.chainId,
        hypercertId,
        claimant,
        units: event.params.value,
        claimedAt: timestamp,
        txHash: getTxHash(event.transaction),
      };
      context.HypercertClaim.set(claim);

      const newClaimedUnits = existingHypercert.claimedUnits + event.params.value;
      const isFullyClaimed = newClaimedUnits >= existingHypercert.totalUnits;
      const newStatus: HypercertStatus = isFullyClaimed ? "CLAIMED" : existingHypercert.status;

      const updatedHypercert: Hypercert = {
        ...existingHypercert,
        claimedUnits: newClaimedUnits,
        status: newStatus,
        updatedAt: timestamp,
      };
      context.Hypercert.set(updatedHypercert);

      context.log.info("Hypercert claimed", {
        hypercertId,
        claimant,
        units: event.params.value,
        chainId: event.chainId,
        blockNumber: event.block.number,
        correlationId: getTxHash(event.transaction),
      });
      return;
    }

    // Create new hypercert entity
    const newHypercert: Hypercert = {
      ...createDefaultHypercert(hypercertId, event.chainId, tokenId, timestamp),
      totalUnits: event.params.value,
      mintedBy: event.params.operator,
      txHash: getTxHash(event.transaction),
    };
    context.Hypercert.set(newHypercert);

    context.log.info("Hypercert minted", {
      hypercertId,
      units: event.params.value,
      chainId: event.chainId,
      blockNumber: event.block.number,
      correlationId: getTxHash(event.transaction),
    });
  }
);

// Handler for HypercertMinter ClaimStored event (stores metadata URI)
indexer.onEvent(
  { contract: "HypercertMinter", event: "ClaimStored" },
  async ({ event, context }) => {
    const tokenId = event.params.claimID;
    const hypercertId = `${event.chainId}-${tokenId.toString()}`;
    const timestamp = event.block.timestamp;

    const existingHypercert = await context.Hypercert.get(hypercertId);

    const baseHypercert =
      existingHypercert ?? createDefaultHypercert(hypercertId, event.chainId, tokenId, timestamp);

    const metadata = await fetchJson(event.params.uri, {
      eventType: "ClaimStored",
      chainId: event.chainId,
      blockNumber: event.block.number,
      txHash: getTxHash(event.transaction),
      log: context.log,
    });

    const parsedMetadata = metadata ? parseHypercertMetadata(metadata) : {};
    const parsedAttestationUIDs = parsedMetadata.attestationUIDs;
    const bundleKind = parsedMetadata.bundleKind ?? "WORK_LEGACY";
    const commitmentIds = bundleKind === "COMMITMENT" ? (parsedMetadata.commitmentIds ?? []) : [];
    const needUIDs = bundleKind === "COMMITMENT" ? (parsedMetadata.needUIDs ?? []) : [];

    const updatedHypercert: Hypercert = {
      ...baseHypercert,
      metadataUri: event.params.uri,
      totalUnits: event.params.totalUnits,
      bundleKind,
      commitmentIds,
      commitmentEntityIds: commitmentIds.map((id) => poolingEntityId(event.chainId, id)),
      needUIDs,
      updatedAt: timestamp,
      ...(parsedMetadata.gardenId ? { garden: parsedMetadata.gardenId } : {}),
      ...(parsedAttestationUIDs
        ? {
            attestationUIDs: parsedAttestationUIDs,
            attestationCount: parsedAttestationUIDs.length,
          }
        : {}),
    };

    context.Hypercert.set(updatedHypercert);
    if (bundleKind === "COMMITMENT") {
      await expandCommitmentAllocations(
        context,
        event.chainId,
        tokenId,
        commitmentIds,
        event.params.totalUnits,
        timestamp
      );
    }

    context.log.info("Hypercert claim stored", {
      hypercertId,
      uri: event.params.uri,
      chainId: event.chainId,
      blockNumber: event.block.number,
      correlationId: getTxHash(event.transaction),
    });
  }
);
