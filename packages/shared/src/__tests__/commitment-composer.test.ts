import { describe, expect, it } from "vitest";

import {
  buildCommitmentCreationPayload,
  COMMITMENT_COMPOSER_DEFAULTS,
  commitmentComposerSchema,
  MAX_COMMITMENT_REQUIREMENTS,
} from "../hooks/commitment-pooling/useCommitmentComposerForm";
import type { Address } from "../types/domain";

const CREATOR = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const NOW = 1_700_000_000;

// A commitment must be named, so every fixture carries one.
const values = {
  ...COMMITMENT_COMPOSER_DEFAULTS,
  title: "Compost workshop",
  unitLabel: "hours",
  targetUnits: 3,
};

function build(overrides: Partial<typeof values> = {}) {
  return buildCommitmentCreationPayload({
    values: { ...values, ...overrides },
    clientCommitmentId: "draft-1",
    poolId: 7n,
    creator: CREATOR,
    gardenAddress: GARDEN,
    nowSeconds: NOW,
  });
}

const gardenWork = {
  ...values,
  kind: "GARDEN_WORK" as const,
  requirements: [
    { actionUID: "44", requiredCount: 2 },
    { actionUID: "0", requiredCount: 12 },
  ],
};

describe("commitment composer validation", () => {
  it("refuses a commitment that counts nothing", () => {
    expect(commitmentComposerSchema.safeParse({ ...values, unitLabel: "  " }).success).toBe(false);
    expect(commitmentComposerSchema.safeParse({ ...values, targetUnits: 0 }).success).toBe(false);
  });

  it("refuses a commitment with no end, which could never lapse or settle", () => {
    expect(commitmentComposerSchema.safeParse({ ...values, dueInDays: 0 }).success).toBe(false);
  });

  it("refuses a commitment nobody could recognise in the pool", () => {
    expect(commitmentComposerSchema.safeParse({ ...values, title: "  " }).success).toBe(false);
  });

  it("accepts an ordinary one", () => {
    expect(commitmentComposerSchema.safeParse(values).success).toBe(true);
  });

  it("requires garden work to name at least one action, each with a count of one or more", () => {
    expect(commitmentComposerSchema.safeParse({ ...gardenWork, requirements: [] }).success).toBe(
      false
    );
    expect(
      commitmentComposerSchema.safeParse({
        ...gardenWork,
        requirements: [{ actionUID: "44", requiredCount: 0 }],
      }).success
    ).toBe(false);
    expect(commitmentComposerSchema.safeParse(gardenWork).success).toBe(true);
  });

  it("treats action UID zero as a real action, and refuses the same action twice", () => {
    expect(
      commitmentComposerSchema.safeParse({
        ...gardenWork,
        requirements: [{ actionUID: "0", requiredCount: 1 }],
      }).success
    ).toBe(true);
    expect(
      commitmentComposerSchema.safeParse({
        ...gardenWork,
        requirements: [
          { actionUID: "44", requiredCount: 1 },
          { actionUID: "44", requiredCount: 2 },
        ],
      }).success
    ).toBe(false);
  });

  it("caps rows at the module's limit without ever telling a member four is the maximum", () => {
    expect(MAX_COMMITMENT_REQUIREMENTS).toBeGreaterThan(4);
    const tooMany = Array.from({ length: MAX_COMMITMENT_REQUIREMENTS + 1 }, (_, i) => ({
      actionUID: String(i),
      requiredCount: 1,
    }));
    expect(
      commitmentComposerSchema.safeParse({ ...gardenWork, requirements: tooMany }).success
    ).toBe(false);
  });

  it("lets a service carry no rows at all", () => {
    expect(commitmentComposerSchema.safeParse({ ...values, kind: "SERVICE" }).success).toBe(true);
  });

  it("keeps a link list honest: every entry must be a web address", () => {
    expect(
      commitmentComposerSchema.safeParse({ ...values, links: ["https://example.org/plan"] }).success
    ).toBe(true);
    expect(commitmentComposerSchema.safeParse({ ...values, links: ["not a link"] }).success).toBe(
      false
    );
  });
});

describe("buildCommitmentCreationPayload", () => {
  it("maps the two directions onto the contract's own ordinals", () => {
    expect(build({ direction: "OFFER" }).direction).toBe(0);
    expect(build({ direction: "REQUEST" }).direction).toBe(1);
  });

  it("creates as the member themselves, never as a garden", () => {
    // ClaimType.Garden is a GardenAccount claiming on a protocol pool. A member
    // composing in their own garden is Individual.
    expect(build().claimType).toBe(1);
    expect(build().onBehalfOf).toBe(CREATOR);
    expect(build().gardenAddress).toBe(GARDEN);
  });

  it("carries the exact unit label the member typed, trimmed but not normalized", () => {
    expect(build({ unitLabel: "  Hours  " }).unitLabel).toBe("Hours");
    expect(build({ unitLabel: "hours" }).unitLabel).toBe("hours");
  });

  it("turns an open team into the contract's open policy and a closed one into lead-managed", () => {
    expect(build({ openTeam: true }).contributorPolicy).toBe(0);
    expect(build({ openTeam: false }).contributorPolicy).toBe(1);
  });

  it("gives the commitment a real end date rather than an open one", () => {
    expect(build({ dueInDays: 14 }).dueDate).toBe(BigInt(NOW + 14 * 86_400));
  });

  it("preserves the member's fallback choice in both directions", () => {
    expect(build({ protocolFallbackEnabled: true }).protocolFallbackEnabled).toBe(true);
    expect(build({ protocolFallbackEnabled: false }).protocolFallbackEnabled).toBe(false);
  });

  it("names nobody as confirmer, so the ordinary rule decides", () => {
    expect(build().confirmers).toEqual([]);
    expect(build().confirmationThreshold).toBe(1);
  });

  it("declares no money, so nothing reads as a priced commitment", () => {
    const payload = build();
    expect(payload.consideration.rail).toBe(0);
    expect(payload.consideration.amount).toBe(0n);
    expect(payload.declaredUnitValue).toBe(0n);
    expect(payload.declaredValueBasis).toBe("");
  });

  it("leaves the creation key to the queue, so a retry cannot mint a second one", () => {
    expect("creationRequestKey" in build()).toBe(false);
    expect(build().clientCommitmentId).toBe("draft-1");
  });

  it("is a pure function of its inputs", () => {
    expect(build()).toEqual(build());
  });

  it("rides the service rail with no rows unless the member chose garden work", () => {
    expect(build().commitmentType).toBe(1);
    expect(build().requirements).toEqual([]);
    const work = build(gardenWork);
    expect(work.commitmentType).toBe(0);
  });

  it("preserves every requirement row, in order, including action UID zero, and authors no tags", () => {
    const work = build(gardenWork);
    expect(work.requirements).toEqual([
      { actionUID: 44n, requiredCount: 2 },
      { actionUID: 0n, requiredCount: 12 },
    ]);
    // The contract derives domains from the registry; a caller-authored tag
    // would be rejected or ignored, so none is ever written.
    expect(work.domainTags).toEqual([]);
  });

  it("binds the cycle the member chose, with zero meaning no season or campaign", () => {
    expect(build({ cycleId: "8" }).cycleId).toBe(8n);
    expect(build({ cycleId: "0" }).cycleId).toBe(0n);
  });

  it("maps who-can-take-it onto the claim mode, and only a request may gate it", () => {
    expect(build({ direction: "REQUEST", claimMode: "APPROVAL_GATED" }).claimMode).toBe(1);
    expect(build({ direction: "REQUEST", claimMode: "OPEN" }).claimMode).toBe(0);
    expect(build({ direction: "OFFER", claimMode: "APPROVAL_GATED" }).claimMode).toBe(0);
  });

  it("carries the note and links into the metadata document under the schema's own names", () => {
    const payload = build({ note: "Bring gloves", links: ["https://example.org/plan"] });
    expect(payload.metadata).toEqual({
      version: 1,
      title: "Compost workshop",
      note: "Bring gloves",
      links: [{ url: "https://example.org/plan" }],
    });
  });
});
