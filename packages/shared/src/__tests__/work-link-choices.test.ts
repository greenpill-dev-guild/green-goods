import { describe, expect, it } from "vitest";
import {
  isEligibleWorkLinkDetail,
  workLinkReturnTo,
} from "../hooks/commitment-pooling/useWorkLinkChoices";
import type { CommitmentDetail } from "../modules/commitment-pooling/types-relations";

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
