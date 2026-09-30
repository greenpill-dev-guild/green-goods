/**
 * Adding to a group: the new copies are the group's terms, deadline, reward
 * and metadata document, under new creation ids, read from a copy on chain.
 */

import { describe, expect, it } from "vitest";

import {
  canAddToGroup,
  type GroupTemplate,
  groupAdditionPayload,
  readGroupTemplate,
} from "../modules/commitment-pooling/group-additions";
import { buildCommitmentMetadata } from "../modules/commitment-pooling/metadata";
import type { Address } from "../types/domain";

const STEWARD = "0x1111111111111111111111111111111111111111" as Address;
const OTHER = "0x2222222222222222222222222222222222222222" as Address;
const CONFIRMER = "0x3333333333333333333333333333333333333333" as Address;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const ZERO = "0x0000000000000000000000000000000000000000" as Address;

/** How `getCommitment` decodes a copy of a garden-work group, trimmed to what matters. */
const onChain = {
  poolId: 7n,
  cycleId: 12n,
  commitmentSeriesId: 0n,
  creator: STEWARD,
  direction: 1,
  commitmentType: 0,
  state: 0,
  claimType: 1,
  claimMode: 1,
  contributorPolicy: 1,
  domains: [2],
  requirements: [{ actionUID: 44n, domain: 2, requiredCount: 3, approvedCount: 1 }],
  dueDate: 1_792_000_000n,
  unitLabel: "hours",
  targetUnits: 4n,
  confirmationThreshold: 1,
  protocolFallbackEnabled: true,
  requiresAssessment: false,
  needUID: `0x${"0".repeat(64)}` as const,
  counterCommitmentId: 0n,
  metadataCID: "bafy-group-document",
  consideration: { rail: 2, source: ZERO, token: ZERO, amount: 38_865n },
  declaredUnitValue: 0n,
  declaredValueBasis: "",
};

const metadata = buildCommitmentMetadata({
  title: "Prune the orchard",
  displayGroup: { version: 1, id: "group-00000001" },
});

async function template(): Promise<GroupTemplate> {
  return readGroupTemplate(
    async (functionName) => (functionName === "getCommitment" ? onChain : [CONFIRMER]),
    9n
  );
}

describe("adding to a group", () => {
  it("makes a copy of the group's terms, deadline, reward and document under a new id", async () => {
    const copy = groupAdditionPayload({
      template: await template(),
      metadata,
      clientCommitmentId: "added-1",
      gardenAddress: GARDEN,
    });

    expect(copy).toMatchObject({
      clientCommitmentId: "added-1",
      poolId: 7n,
      cycleId: 12n,
      direction: 1,
      commitmentType: 0,
      claimType: 1,
      claimMode: 1,
      contributorPolicy: 1,
      // Direct creation, with the domains left to the contract.
      onBehalfOf: ZERO,
      domainTags: [],
      requirements: [{ actionUID: 44n, requiredCount: 3 }],
      dueDate: 1_792_000_000n,
      metadataCID: "bafy-group-document",
      metadata,
      confirmers: [CONFIRMER],
      consideration: { rail: 2, source: ZERO, token: ZERO, amount: 38_865n },
      gardenAddress: GARDEN,
    });
  });

  it("lets only the steward who created the group add to it, so it stays one row", async () => {
    expect(canAddToGroup(await template(), STEWARD)).toBe(true);
    expect(canAddToGroup(await template(), STEWARD.toUpperCase() as Address)).toBe(true);
    expect(canAddToGroup(await template(), OTHER)).toBe(false);
    expect(canAddToGroup(await template(), null)).toBe(false);
  });

  it("refuses to add to a commitment that isn't in a group", async () => {
    const onItsOwn = await template();
    expect(() =>
      groupAdditionPayload({
        template: onItsOwn,
        metadata: buildCommitmentMetadata({ title: "On its own" }),
        clientCommitmentId: "added-1",
        gardenAddress: GARDEN,
      })
    ).toThrow("group");
  });
});
