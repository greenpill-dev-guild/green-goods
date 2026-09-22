/**
 * composerValuesFromCommitment — composing a commitment again from one already made.
 *
 * The answers travel; the record does not. Nothing about who took it up, what
 * was proved, confirmed, or paid belongs to the new commitment, and neither do
 * its dates: a due date and a season are chosen fresh.
 *
 * The rule with teeth is that a composer is never handed an answer it cannot
 * show. The member's composer has no fields for a named confirmer group or a
 * declared payment, so copying a steward's into it would make a member promise
 * money, or hand confirmation to people, without ever seeing either.
 */

import { describe, expect, it } from "vitest";

import {
  COMMITMENT_COMPOSER_DEFAULTS,
  commitmentComposerSchema,
} from "../hooks/commitment-pooling/useCommitmentComposerForm";
import {
  type ComposeAgainInput,
  composerValuesFromCommitment,
} from "../modules/commitment-pooling/compose-again";
import type { Address } from "../types/domain";

const SAFE = "0x1111111111111111111111111111111111111111" as Address;
const TOKEN = "0x2222222222222222222222222222222222222222" as Address;
const CONFIRMER_A = "0x3333333333333333333333333333333333333333" as Address;
const CONFIRMER_B = "0x4444444444444444444444444444444444444444" as Address;

const words = {
  version: 1 as const,
  title: "Water the north beds",
  note: "Mornings, before the heat",
  links: [{ url: "https://example.org/beds", label: "Map" }],
};

/** A steward-seeded, gated, paid, two-of-two season commitment: every extra at once. */
const seeded: ComposeAgainInput["commitment"] = {
  direction: "OFFER",
  commitmentType: "SEASON_CAMPAIGN",
  unitLabel: "sessions",
  targetUnits: 4n,
  claimMode: "APPROVAL_GATED",
  contributorPolicy: "LEAD_MANAGED",
  protocolFallbackEnabled: false,
  confirmers: [CONFIRMER_A, CONFIRMER_B],
  confirmationThreshold: 2,
  considerationRail: "ARBITRUM_EXTERNAL",
  considerationSource: SAFE,
  considerationToken: TOKEN,
  considerationAmount: 25_000_000n,
};

const gardenWork: ComposeAgainInput["commitment"] = {
  ...seeded,
  direction: "REQUEST",
  commitmentType: "DOMAIN_IMPACT",
  confirmers: [],
  confirmationThreshold: 1,
  considerationRail: "NONE",
  considerationSource: null,
  considerationToken: null,
  considerationAmount: null,
};

/** Listed out of order on purpose: the rows must come back in the order they were asked. */
const requirements = [
  { requirementIndex: 1, actionUID: 0n, requiredCount: 3 },
  { requirementIndex: 0, actionUID: 44n, requiredCount: 2 },
];

describe("composerValuesFromCommitment", () => {
  it("carries a member's own answers into a composer that opens ready to place", () => {
    const values = composerValuesFromCommitment({
      composer: "member",
      commitment: gardenWork,
      metadata: words,
      requirements,
    });

    expect(values).toMatchObject({
      direction: "REQUEST",
      kind: "GARDEN_WORK",
      title: "Water the north beds",
      note: "Mornings, before the heat",
      links: ["https://example.org/beds"],
      unitLabel: "sessions",
      targetUnits: 4,
      claimMode: "APPROVAL_GATED",
      openTeam: false,
      protocolFallbackEnabled: false,
      requirements: [
        { actionUID: "44", requiredCount: 2 },
        { actionUID: "0", requiredCount: 3 },
      ],
    });
    expect(
      commitmentComposerSchema.safeParse({ ...COMMITMENT_COMPOSER_DEFAULTS, ...values }).success
    ).toBe(true);
  });

  it("never hands the member's composer a steward's extras, which it has no fields to show", () => {
    const values = composerValuesFromCommitment({
      composer: "member",
      commitment: seeded,
      metadata: words,
      requirements: [],
    });

    // Nobody named and no money: the member composer's own answers.
    expect(values).not.toHaveProperty("confirmers");
    expect(values).not.toHaveProperty("confirmationThreshold");
    expect(values).not.toHaveProperty("considerationRail");
    expect(values).not.toHaveProperty("considerationSource");
    expect(values).not.toHaveProperty("considerationToken");
    expect(values).not.toHaveProperty("considerationAmount");
    // A member cannot gate an offer, and a season commitment is the pool's own:
    // the nearest thing a member can make is a service kept by proof.
    expect(values.claimMode).toBe("OPEN");
    expect(values.kind).toBe("SERVICE");
  });

  it("gives the steward's seeding wizard everything the steward set", () => {
    const external = composerValuesFromCommitment({
      composer: "steward",
      commitment: seeded,
      metadata: words,
      requirements: [],
    });
    expect(external).toMatchObject({
      kind: "SEASON_CAMPAIGN",
      claimMode: "APPROVAL_GATED",
      confirmers: [CONFIRMER_A, CONFIRMER_B],
      confirmationThreshold: 2,
      considerationRail: "ARBITRUM_EXTERNAL",
      considerationSource: SAFE,
      considerationToken: TOKEN,
      considerationAmount: "25000000",
    });
    expect(
      commitmentComposerSchema.safeParse({ ...COMMITMENT_COMPOSER_DEFAULTS, ...external }).success
    ).toBe(true);

    // A Celo settlement stores zero-address sentinels; only the amount is the steward's.
    const celo = composerValuesFromCommitment({
      composer: "steward",
      commitment: { ...seeded, considerationRail: "CELO_SETTLEMENT" },
      metadata: words,
      requirements: [],
    });
    expect(celo).toMatchObject({
      considerationRail: "CELO_SETTLEMENT",
      considerationAmount: "25000000",
    });
    expect(celo).not.toHaveProperty("considerationSource");
    expect(celo).not.toHaveProperty("considerationToken");
  });

  it("never copies the new maker into the confirmer group they would have to reach", () => {
    // The contract drops the provider from the group when the commitment is taken
    // up, and refuses it outright when too few are left, so copying CONFIRMER_A
    // into a commitment CONFIRMER_A is about to make would strand it.
    const values = composerValuesFromCommitment({
      composer: "steward",
      commitment: seeded,
      metadata: words,
      requirements: [],
      creator: CONFIRMER_A,
    });

    expect(values.confirmers).toEqual([CONFIRMER_B]);
    // The threshold follows the group down; two of one can never be met.
    expect(values.confirmationThreshold).toBe(1);
  });

  it("drops a requirement naming an action that can no longer take work", () => {
    const values = composerValuesFromCommitment({
      composer: "member",
      commitment: gardenWork,
      metadata: words,
      requirements,
      usableActionUIDs: new Set(["44"]),
    });

    expect(values.requirements).toEqual([{ actionUID: "44", requiredCount: 2 }]);
  });

  it("leaves the dates to be chosen fresh", () => {
    const values = composerValuesFromCommitment({
      composer: "steward",
      commitment: seeded,
      metadata: words,
      requirements: [],
    });

    expect(values).not.toHaveProperty("dueInDays");
    expect(values).not.toHaveProperty("cycleId");
  });

  it("still carries the terms when the words could not be read, and leaves the name to the person", () => {
    const values = composerValuesFromCommitment({
      composer: "member",
      commitment: gardenWork,
      metadata: null,
      requirements,
    });

    expect(values).not.toHaveProperty("title");
    expect(values).toMatchObject({ kind: "GARDEN_WORK", unitLabel: "sessions", targetUnits: 4 });
  });
});
