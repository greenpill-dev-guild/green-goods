import assert from "node:assert/strict";

import {
  createCommitment,
  createContributor,
  createCycle,
} from "../src/handlers/commitment-pool-projections";
import {
  indexCommitmentHypercert,
  reconcileCommitmentHypercerts,
} from "../src/handlers/hypercert-allocations";
import { createDefaultHypercert } from "../src/handlers/shared";
import { Addresses, createTestIndexer } from "./v3";

const CHAIN_ID = 42161;

function address(index: number): string {
  return Addresses.mockAddresses[index] ?? `0x${index.toString(16).padStart(40, "0")}`;
}

describe("commitment hypercert allocation reconciliation", () => {
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
});
