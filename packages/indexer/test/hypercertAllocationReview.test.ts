import assert from "node:assert/strict";

import {
  createCommitment,
  createContributor,
  createCycle,
  createPool,
} from "../src/handlers/commitment-pool-projections";
import { reconcileRecognitionWeights } from "../src/handlers/commitment-pool-members";
import {
  indexCommitmentHypercert,
  reconcileCommitmentHypercerts,
} from "../src/handlers/hypercert-allocations";
import { createDefaultHypercert } from "../src/handlers/shared";
import { Addresses, CommitmentPoolingModule, createTestIndexer } from "./v3";

const CHAIN_ID = 42161;

function address(index: number): string {
  return Addresses.mockAddresses[index] ?? `0x${index.toString(16).padStart(40, "0")}`;
}

describe("commitment hypercert allocation reconciliation", () => {
  it("defers cycle recognition until CycleOpened supplies its policy", async () => {
    let db = createTestIndexer();
    const commitment = {
      ...createCommitment(CHAIN_ID, 39n, 1),
      creationSeen: true,
      poolId: 7n,
      poolEntityId: `${CHAIN_ID}-7`,
      cycleId: 9n,
      cycleEntityId: `${CHAIN_ID}-9`,
      contributorsFrozen: true,
      frozenContributorCount: 2,
    };
    const first = {
      ...createContributor(CHAIN_ID, 39n, address(4), 1),
      active: true,
      approvedWorkCredits: 1,
    };
    const second = {
      ...createContributor(CHAIN_ID, 39n, address(5), 1),
      active: true,
      approvedWorkCredits: 3,
    };
    db.CommitmentPool.set({
      ...createPool(CHAIN_ID, 7n, 1),
      childCommitmentEntityIds: [commitment.id],
    });
    db.CommitmentCycle.set(createCycle(CHAIN_ID, 9n, 7n, 1));
    db.Commitment.set(commitment);
    db.CommitmentContributor.set(first);
    db.CommitmentContributor.set(second);
    db.CommitmentContributorIndex.set({
      id: commitment.id,
      chainId: CHAIN_ID,
      commitmentId: commitment.commitmentId,
      commitmentEntityId: commitment.id,
      contributorEntityIds: [first.id, second.id],
      updatedAt: 1,
    });

    await reconcileRecognitionWeights(db, commitment, 2);
    assert.equal((await db.CommitmentContributor.get(first.id))?.recognitionWeightBps, undefined);
    assert.equal((await db.CommitmentContributor.get(second.id))?.recognitionWeightBps, undefined);

    db = await CommitmentPoolingModule.CycleOpened.processEvent({
      event: CommitmentPoolingModule.CycleOpened.createMockEvent({
        cycleId: 9n,
        poolId: 7n,
        gardenersBps: 6_000n,
        treasuryBps: 1_000n,
        operatorBps: 1_000n,
        evaluatorBps: 500n,
        communityBps: 500n,
        funderBps: 1_000n,
        equalParticipationBps: 6_000n,
        verifiedContributionBps: 4_000n,
        mockEventData: {
          chainId: CHAIN_ID,
          block: { timestamp: 3, number: 3 },
          srcAddress: undefined,
          transaction: { hash: `0x${"3".padStart(64, "0")}` },
          logIndex: 0,
        },
      }),
      mockDb: db,
    });
    assert.equal((await db.CommitmentContributor.get(first.id))?.recognitionWeightBps, 4_000);
    assert.equal((await db.CommitmentContributor.get(second.id))?.recognitionWeightBps, 6_000);
  });

  it("clears stale weights when contributors lose recognition eligibility", async () => {
    const db = createTestIndexer();
    const commitment = {
      ...createCommitment(CHAIN_ID, 40n, 1),
      contributorsFrozen: true,
      frozenContributorCount: 2,
    };
    const eligible = {
      ...createContributor(CHAIN_ID, 40n, address(4), 1),
      active: true,
      approvedWorkCredits: 1,
      recognitionWeightBps: 6_000,
    };
    const ineligible = {
      ...createContributor(CHAIN_ID, 40n, address(5), 1),
      active: true,
      recognitionWeightBps: 4_000,
    };
    db.CommitmentContributor.set(eligible);
    db.CommitmentContributor.set(ineligible);
    db.CommitmentContributorIndex.set({
      id: commitment.id,
      chainId: CHAIN_ID,
      commitmentId: commitment.commitmentId,
      commitmentEntityId: commitment.id,
      contributorEntityIds: [eligible.id, ineligible.id],
      updatedAt: 1,
    });

    await reconcileRecognitionWeights(db, commitment, 2);
    assert.equal((await db.CommitmentContributor.get(eligible.id))?.recognitionWeightBps, 10_000);
    assert.equal((await db.CommitmentContributor.get(ineligible.id))?.recognitionWeightBps, 0);

    db.CommitmentContributor.set({
      ...(await db.CommitmentContributor.get(eligible.id))!,
      approvedWorkCredits: 0,
    });
    await reconcileRecognitionWeights(db, commitment, 3);
    assert.equal((await db.CommitmentContributor.get(eligible.id))?.recognitionWeightBps, 0);
  });

  it("defers every allocation until the complete referenced roster is stable", async () => {
    const db = createTestIndexer();
    const cycle = {
      ...createCycle(CHAIN_ID, 9n, 7n, 1),
      state: "OPEN" as const,
      gardenersBps: 10_000,
      equalParticipationBps: 2_000,
      verifiedContributionBps: 8_000,
    };
    db.CommitmentCycle.set(cycle);

    for (const commitmentId of [41n, 42n]) {
      db.Commitment.set({
        ...createCommitment(CHAIN_ID, commitmentId, 1),
        creationSeen: true,
        poolId: 7n,
        poolEntityId: `${CHAIN_ID}-7`,
        cycleId: 9n,
        cycleEntityId: `${CHAIN_ID}-9`,
        state: "FULFILLED",
        contributorsFrozen: true,
        frozenContributorCount: 1,
      });
    }

    const firstContributor = {
      ...createContributor(CHAIN_ID, 41n, address(4), 2),
      additionSeen: true,
      active: true,
      approvedWorkCredits: 1,
    };
    db.CommitmentContributor.set(firstContributor);
    db.CommitmentContributorIndex.set({
      id: `${CHAIN_ID}-41`,
      chainId: CHAIN_ID,
      commitmentId: 41n,
      commitmentEntityId: `${CHAIN_ID}-41`,
      contributorEntityIds: [firstContributor.id],
      updatedAt: 2,
    });

    const hypercert = {
      ...createDefaultHypercert(`${CHAIN_ID}-77`, CHAIN_ID, 77n, 3),
      totalUnits: 100n,
      bundleKind: "COMMITMENT" as const,
      commitmentIds: [41n, 42n],
      commitmentEntityIds: [`${CHAIN_ID}-41`, `${CHAIN_ID}-42`],
    };
    db.Hypercert.set(hypercert);
    await indexCommitmentHypercert(db, hypercert, 3);

    assert.deepEqual(await db.HypercertCommitmentContributorAllocation.getAll(), []);
    assert.equal(
      (await db.CommitmentContributor.get(firstContributor.id))?.recognitionWeightBps,
      undefined
    );

    const secondContributor = {
      ...createContributor(CHAIN_ID, 42n, address(5), 4),
      additionSeen: true,
      active: true,
      approvedWorkCredits: 1,
    };
    db.CommitmentContributor.set(secondContributor);
    db.CommitmentContributorIndex.set({
      id: `${CHAIN_ID}-42`,
      chainId: CHAIN_ID,
      commitmentId: 42n,
      commitmentEntityId: `${CHAIN_ID}-42`,
      contributorEntityIds: [secondContributor.id],
      updatedAt: 4,
    });
    const secondCommitment = await db.Commitment.get(`${CHAIN_ID}-42`);
    assert.ok(secondCommitment);
    await reconcileCommitmentHypercerts(db, secondCommitment, 4);

    const allocations = await db.HypercertCommitmentContributorAllocation.getAll();
    assert.equal(allocations.length, 2);
    assert.ok(allocations.every((row) => row.commitmentGardenersClassUnits === 50n));
    assert.ok(allocations.every((row) => row.recognitionUnits === 50n));
    assert.ok(allocations.every((row) => row.recognitionWeightBps === 10_000));
  });

  it("retires allocations when a contributor loses recognition eligibility", async () => {
    const db = createTestIndexer();
    const cycle = {
      ...createCycle(CHAIN_ID, 9n, 7n, 1),
      state: "OPEN" as const,
      gardenersBps: 10_000,
      equalParticipationBps: 2_000,
      verifiedContributionBps: 8_000,
    };
    const commitment = {
      ...createCommitment(CHAIN_ID, 43n, 1),
      creationSeen: true,
      poolId: 7n,
      poolEntityId: `${CHAIN_ID}-7`,
      cycleId: 9n,
      cycleEntityId: `${CHAIN_ID}-9`,
      state: "FULFILLED" as const,
      contributorsFrozen: true,
      frozenContributorCount: 2,
    };
    const first = {
      ...createContributor(CHAIN_ID, 43n, address(4), 1),
      active: true,
      approvedWorkCredits: 1,
    };
    const second = {
      ...createContributor(CHAIN_ID, 43n, address(5), 1),
      active: true,
      approvedWorkCredits: 1,
    };
    db.CommitmentCycle.set(cycle);
    db.Commitment.set(commitment);
    db.CommitmentContributor.set(first);
    db.CommitmentContributor.set(second);
    db.CommitmentContributorIndex.set({
      id: commitment.id,
      chainId: CHAIN_ID,
      commitmentId: commitment.commitmentId,
      commitmentEntityId: commitment.id,
      contributorEntityIds: [first.id, second.id],
      updatedAt: 1,
    });
    const hypercert = {
      ...createDefaultHypercert(`${CHAIN_ID}-78`, CHAIN_ID, 78n, 2),
      totalUnits: 100n,
      bundleKind: "COMMITMENT" as const,
      commitmentIds: [43n],
      commitmentEntityIds: [commitment.id],
    };
    db.Hypercert.set(hypercert);
    await indexCommitmentHypercert(db, hypercert, 2);

    db.CommitmentContributor.set({ ...second, approvedWorkCredits: 0 });
    const indexedCommitment = await db.Commitment.get(commitment.id);
    assert.ok(indexedCommitment);
    await reconcileCommitmentHypercerts(db, indexedCommitment, 3);

    const allocations = await db.HypercertCommitmentContributorAllocation.getAll();
    const retained = allocations.find((row) => row.contributor === first.contributor);
    const retired = allocations.find((row) => row.contributor === second.contributor);
    assert.equal(retained?.recognitionWeightBps, 10_000);
    assert.equal(retained?.recognitionUnits, 100n);
    assert.equal(retired?.recognitionWeightBps, 0);
    assert.equal(retired?.recognitionUnits, 0n);

    db.CommitmentContributor.set({ ...first, approvedWorkCredits: 0 });
    await reconcileCommitmentHypercerts(db, indexedCommitment, 4);
    const fullyRetired = await db.HypercertCommitmentContributorAllocation.getAll();
    assert.ok(fullyRetired.every((row) => row.recognitionWeightBps === 0));
    assert.ok(fullyRetired.every((row) => row.recognitionUnits === 0n));
  });
});
