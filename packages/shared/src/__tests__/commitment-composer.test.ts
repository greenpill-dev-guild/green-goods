import { describe, expect, it } from "vitest";

import {
  buildCommitmentCreationPayload,
  COMMITMENT_COMPOSER_DEFAULTS,
  commitmentComposerSchema,
} from "../hooks/commitment-pooling/useCommitmentComposerForm";
import type { Address } from "../types/domain";

const CREATOR = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const NOW = 1_700_000_000;

const values = { ...COMMITMENT_COMPOSER_DEFAULTS, unitLabel: "hours", targetUnits: 3 };

function build(overrides: Partial<typeof values> = {}) {
  return buildCommitmentCreationPayload({
    values: { ...values, ...overrides },
    clientCommitmentId: "draft-1",
    poolId: 7n,
    cycleId: 0n,
    creator: CREATOR,
    gardenAddress: GARDEN,
    nowSeconds: NOW,
  });
}

describe("commitment composer validation", () => {
  it("refuses a commitment that counts nothing", () => {
    expect(commitmentComposerSchema.safeParse({ ...values, unitLabel: "  " }).success).toBe(false);
    expect(commitmentComposerSchema.safeParse({ ...values, targetUnits: 0 }).success).toBe(false);
  });

  it("refuses a commitment with no end, which could never lapse or settle", () => {
    expect(commitmentComposerSchema.safeParse({ ...values, dueInDays: 0 }).success).toBe(false);
  });

  it("accepts an ordinary one", () => {
    expect(commitmentComposerSchema.safeParse(values).success).toBe(true);
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
});
