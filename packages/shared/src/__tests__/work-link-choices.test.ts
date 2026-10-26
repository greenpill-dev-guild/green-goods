import { describe, expect, it } from "vitest";
import {
  isEligibleWorkLinkDetail,
  workablePromiseOf,
  workLinkReturnTo,
} from "../hooks/commitment-pooling/useWorkLinkChoices";
import { MARIA } from "../modules/commitment-pooling/demo/demo-builders";
import type { CommitmentRequirementRecord } from "../modules/commitment-pooling/types-core";
import type { CommitmentDetail } from "../modules/commitment-pooling/types-relations";
import {
  commitmentDetailFixture,
  commitmentFixture,
  contributorFixture,
} from "./test-utils/commitment-pooling-fixtures";

const ACCOUNT = "0x1111111111111111111111111111111111111111" as const;
const ROUTE_GARDEN = "0x2222222222222222222222222222222222222222" as const;

function detail(overrides: Partial<CommitmentDetail> = {}): CommitmentDetail {
  return {
    commitment: {
      commitmentId: 9n,
      leadProvider: ACCOUNT,
      commitmentType: "DOMAIN_IMPACT",
      contributorsFrozen: false,
      derivedState: "ACCEPTED",
    } as CommitmentDetail["commitment"],
    contributors: [{ contributor: ACCOUNT, active: true }] as CommitmentDetail["contributors"],
    workAttributions: [],
    requirements: [],
    assignments: [],
    evidenceAttributions: [],
    claimRequests: [],
    counterpartCommitments: [],
    ...overrides,
  };
}

describe("eligible Work-link choices", () => {
  it("requires an active contributor and the shared canLinkWork gates", () => {
    expect(isEligibleWorkLinkDetail(detail(), ACCOUNT)).toBe(true);
    expect(isEligibleWorkLinkDetail(detail({ contributors: [] }), ACCOUNT)).toBe(false);
    expect(
      isEligibleWorkLinkDetail(
        detail({
          commitment: {
            ...detail().commitment,
            contributorsFrozen: true,
          },
        }),
        ACCOUNT
      )
    ).toBe(false);
  });

  it("builds the return route from the route garden, independently of the Work garden", () => {
    expect(workLinkReturnTo(ROUTE_GARDEN, 9n)).toBe(`/home/${ROUTE_GARDEN}/commitments/9`);
  });
});

describe("workable promises", () => {
  const requirement = (index: number, actionUID: bigint) =>
    ({
      requirementIndex: index,
      actionUID,
      requiredCount: 4,
      approvedCount: 1,
    }) as CommitmentRequirementRecord;
  const read = (detail: CommitmentDetail) =>
    workablePromiseOf(detail, {
      account: MARIA,
      workGarden: ROUTE_GARDEN,
      returnGarden: ROUTE_GARDEN,
      title: "Workshop photos",
    });

  it("lets the promise's own act rules say what its member can do on it", () => {
    // Garden work its lead can link to each requirement, and add evidence to.
    const gardenWork = read(
      commitmentDetailFixture({
        commitment: commitmentFixture({ commitmentId: 9n, commitmentType: "DOMAIN_IMPACT" }),
        requirements: [requirement(0, 5n), requirement(1, 6n)],
        contributors: [contributorFixture({ commitmentId: 9n })],
      })
    );
    expect(gardenWork?.takesEvidence).toBe(true);
    expect(gardenWork?.choices).toEqual([
      expect.objectContaining({ actionUID: 5, requirementIndex: 0, approvedCount: 1 }),
      expect.objectContaining({ actionUID: 6, requirementIndex: 1, requiredCount: 4 }),
    ]);
    expect(gardenWork?.choices[0]?.returnTo).toBe(`/home/${ROUTE_GARDEN}/commitments/9`);

    // A service takes evidence only: no work links to it.
    const service = read(commitmentDetailFixture());
    expect(service).toMatchObject({ takesEvidence: true, choices: [] });

    // A frozen team takes no new work, yet Add Proof stays its lead's.
    const frozen = read(
      commitmentDetailFixture({
        commitment: commitmentFixture({
          commitmentType: "DOMAIN_IMPACT",
          contributorsFrozen: true,
        }),
        requirements: [requirement(0, 5n)],
      })
    );
    expect(frozen).toMatchObject({ takesEvidence: true, choices: [] });
  });

  it("reads nothing workable on a promise the account has no seat on", () => {
    const someoneElses = commitmentDetailFixture({
      commitment: commitmentFixture({
        commitmentType: "DOMAIN_IMPACT",
        leadProvider: ROUTE_GARDEN,
        creator: ROUTE_GARDEN,
      }),
      contributors: [],
      requirements: [requirement(0, 5n)],
    });
    expect(read(someoneElses)).toBeNull();
  });
});
