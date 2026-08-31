import { describe, expect, it } from "vitest";

import {
  buildCommitmentCreationPayload,
  COMMITMENT_COMPOSER_DEFAULTS,
  COMMITMENT_COMPOSER_ERROR_IDS,
  commitmentComposerSchema,
  MAX_COMMITMENT_REQUIREMENTS,
} from "../hooks/commitment-pooling/useCommitmentComposerForm";
import type { Address } from "../types/domain";

const CREATOR = "0x1111111111111111111111111111111111111111" as Address;
const MEMBER = "0x6666666666666666666666666666666666666666" as Address;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
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
    expect(build().gardenAddress).toBe(GARDEN);
  });

  it("names nobody on whose behalf it is created, which every direct creation reverts on", () => {
    // CreationChecksLib.resolveCreator reverts UnauthorizedCaller for a non-zero
    // onBehalfOf on every type but StewardCaptured, and reads the creator from
    // msg.sender instead. None of the three types this composer builds —
    // DomainImpact, SupportService, SeasonCampaign — is StewardCaptured.
    expect(build().onBehalfOf).toBe(ZERO_ADDRESS);
    expect(build({ kind: "SEASON_CAMPAIGN" }).onBehalfOf).toBe(ZERO_ADDRESS);
    expect(build(gardenWork).onBehalfOf).toBe(ZERO_ADDRESS);
  });

  it("keeps delegated creation available for the capture lane, and only there", () => {
    const captured = buildCommitmentCreationPayload({
      values,
      clientCommitmentId: "draft-1",
      poolId: 7n,
      creator: CREATOR,
      gardenAddress: GARDEN,
      nowSeconds: NOW,
      capturedFor: MEMBER,
    });
    expect(captured.onBehalfOf).toBe(MEMBER);
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

describe("the steward's extras on the same composer", () => {
  const CONFIRMER = "0x2222222222222222222222222222222222222222" as Address;
  const OTHER = "0x3333333333333333333333333333333333333333" as Address;
  const TOKEN = "0x4444444444444444444444444444444444444444" as Address;
  const SOURCE = "0x5555555555555555555555555555555555555555" as Address;

  it("seeds a season or campaign commitment on the contract's own ordinal", () => {
    expect(build({ kind: "SEASON_CAMPAIGN" }).commitmentType).toBe(2);
    expect(build({ kind: "SEASON_CAMPAIGN" }).requirements).toEqual([]);
  });

  it("carries a named confirmer group and its threshold, lowercased and deduplicated", () => {
    const payload = build({
      confirmers: [CONFIRMER, CONFIRMER.toUpperCase() as Address, OTHER],
      confirmationThreshold: 2,
    });
    expect(payload.confirmers).toEqual([CONFIRMER, OTHER]);
    expect(payload.confirmationThreshold).toBe(2);
  });

  it("refuses a threshold the named group could never reach", () => {
    const result = commitmentComposerSchema.safeParse({
      ...values,
      confirmers: [CONFIRMER],
      confirmationThreshold: 2,
    });
    expect(result.success).toBe(false);
  });

  it("refuses the zero address as a named confirmer", () => {
    // CreditLib.eligibleNamedConfirmerCount skips the zero address while
    // counting who may still confirm, so a group of one leaves the threshold
    // unreachable — and after acceptance the group can no longer be repaired.
    const result = commitmentComposerSchema.safeParse({
      ...values,
      confirmers: [ZERO_ADDRESS],
      confirmationThreshold: 1,
    });
    expect(result.success).toBe(false);
    expect(
      commitmentComposerSchema.safeParse({
        ...values,
        confirmers: [CONFIRMER, ZERO_ADDRESS],
        confirmationThreshold: 1,
      }).success
    ).toBe(false);
  });

  it("says its own rules as message ids, so the console can read them in any language", () => {
    const messageFor = (input: Record<string, unknown>, field: string) => {
      const result = commitmentComposerSchema.safeParse({ ...values, ...input });
      if (result.success) return undefined;
      return result.error.issues.find((issue) => issue.path.join(".") === field)?.message;
    };
    expect(
      messageFor({ confirmers: [CONFIRMER], confirmationThreshold: 2 }, "confirmationThreshold")
    ).toBe(COMMITMENT_COMPOSER_ERROR_IDS.thresholdAboveGroup);
    expect(messageFor({ confirmationThreshold: 0 }, "confirmationThreshold")).toBe(
      COMMITMENT_COMPOSER_ERROR_IDS.thresholdAtLeastOne
    );
    expect(
      messageFor({ confirmers: Array.from({ length: 41 }, () => CONFIRMER) }, "confirmers")
    ).toBe(COMMITMENT_COMPOSER_ERROR_IDS.confirmersTooMany);
    const external = { considerationRail: "ARBITRUM_EXTERNAL", considerationAmount: "0" };
    expect(messageFor(external, "considerationSource")).toBe(
      COMMITMENT_COMPOSER_ERROR_IDS.considerationSource
    );
    expect(messageFor(external, "considerationToken")).toBe(
      COMMITMENT_COMPOSER_ERROR_IDS.considerationToken
    );
    expect(messageFor(external, "considerationAmount")).toBe(
      COMMITMENT_COMPOSER_ERROR_IDS.considerationAmount
    );
  });

  it("lets a steward gate an offer, which a member composing alone cannot", () => {
    expect(build({ direction: "OFFER", claimMode: "APPROVAL_GATED" }).claimMode).toBe(0);
    expect(
      buildCommitmentCreationPayload({
        values: { ...values, direction: "OFFER", claimMode: "APPROVAL_GATED" },
        clientCommitmentId: "draft-1",
        poolId: 7n,
        creator: CREATOR,
        gardenAddress: GARDEN,
        nowSeconds: NOW,
        allowGatedOffers: true,
      }).claimMode
    ).toBe(1);
  });

  it("declares exactly one consideration rail with the sentinels each rail wants", () => {
    expect(build({ considerationRail: "NONE", considerationAmount: "20" }).consideration).toEqual({
      rail: 0,
      source: "0x0000000000000000000000000000000000000000",
      token: "0x0000000000000000000000000000000000000000",
      amount: 0n,
    });
    expect(
      build({
        considerationRail: "ARBITRUM_EXTERNAL",
        considerationSource: SOURCE,
        considerationToken: TOKEN,
        considerationAmount: "20000000",
      }).consideration
    ).toEqual({ rail: 1, source: SOURCE, token: TOKEN, amount: 20_000_000n });
    // Celo settlement derives its token and payer from the module: zero sentinels.
    expect(
      build({
        considerationRail: "CELO_SETTLEMENT",
        considerationSource: SOURCE,
        considerationToken: TOKEN,
        considerationAmount: "5",
      }).consideration
    ).toEqual({
      rail: 2,
      source: "0x0000000000000000000000000000000000000000",
      token: "0x0000000000000000000000000000000000000000",
      amount: 5n,
    });
  });

  it("requires the external rail to name its source, token and a non-zero amount", () => {
    expect(
      commitmentComposerSchema.safeParse({
        ...values,
        considerationRail: "ARBITRUM_EXTERNAL",
        considerationSource: SOURCE,
        considerationToken: TOKEN,
        considerationAmount: "0",
      }).success
    ).toBe(false);
    expect(
      commitmentComposerSchema.safeParse({
        ...values,
        considerationRail: "ARBITRUM_EXTERNAL",
        considerationSource: "",
        considerationToken: TOKEN,
        considerationAmount: "20",
      }).success
    ).toBe(false);
    expect(
      commitmentComposerSchema.safeParse({
        ...values,
        considerationRail: "CELO_SETTLEMENT",
        considerationAmount: "20",
      }).success
    ).toBe(true);
  });
});
