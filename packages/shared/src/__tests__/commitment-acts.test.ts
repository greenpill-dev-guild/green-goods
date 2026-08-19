import { describe, expect, it } from "vitest";

import { commitmentNeedsSeat, selectCommitmentActKind } from "../modules/commitment-pooling/acts";
import type { CommitmentDerivedState } from "../modules/commitment-pooling/types";

const base = { derivedState: "ACTIVE" as CommitmentDerivedState, claimMode: "OPEN" as const };

describe("one act table for every surface", () => {
  it("marks the provider as needed while their proof is waiting to be sent", () => {
    // The inbox kept its own copy of this and omitted EVIDENCE_SUBMITTED, so a
    // member with work ready to send saw no marker on the surface built to
    // tell them. Both now ask the same question.
    const commitment = { ...base, derivedState: "EVIDENCE_SUBMITTED" as CommitmentDerivedState };
    expect(selectCommitmentActKind({ commitment, seat: "provider" })).toBe("sendForConfirmation");
    expect(commitmentNeedsSeat({ commitment, seat: "provider" })).toBe(true);
  });

  it("agrees with itself on every seat and phase", () => {
    const phases: CommitmentDerivedState[] = [
      "OFFERED",
      "REQUESTED",
      "ACCEPTED",
      "ACTIVE",
      "PARTIALLY_APPROVED",
      "EVIDENCE_SUBMITTED",
      "READY_FOR_CONFIRMATION",
      "FULFILLED",
      "RECONCILED",
      "CANCELLED",
      "EXPIRED",
      "DISPUTED",
    ];
    for (const derivedState of phases) {
      for (const seat of ["provider", "confirmer", "contributor", "bystander"] as const) {
        const input = { commitment: { ...base, derivedState }, seat };
        expect(commitmentNeedsSeat(input)).toBe(selectCommitmentActKind(input) !== null);
      }
    }
  });

  it("treats an accepted commitment as in progress, matching its band", () => {
    // deriveCommitmentState collapses ACCEPTED today, so this never arrives in
    // practice. The band table still answers for it, and an act table that said
    // otherwise is the split this module exists to close.
    expect(
      selectCommitmentActKind({
        commitment: { ...base, derivedState: "ACCEPTED" },
        seat: "provider",
      })
    ).toBe("addProof");
  });

  it("withholds every act while one is already waiting to send", () => {
    for (const seat of ["provider", "confirmer", "contributor", "bystander"] as const) {
      expect(selectCommitmentActKind({ commitment: base, seat, hasPendingJob: true })).toBeNull();
    }
  });
});
