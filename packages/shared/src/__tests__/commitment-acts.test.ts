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
        // Needing somebody is a narrower question than offering them something,
        // so it may only ever be a subset of where an act exists.
        if (commitmentNeedsSeat(input)) expect(selectCommitmentActKind(input)).not.toBeNull();
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

  it("does not badge a member for something only they may choose to do", () => {
    // The bar offers everything available; the badge counts only what somebody
    // else is held up by. Withdrawing your own untaken offer is neither.
    const offered = { ...base, derivedState: "OFFERED" as CommitmentDerivedState };
    expect(selectCommitmentActKind({ commitment: offered, seat: "provider" })).toBe("withdraw");
    expect(commitmentNeedsSeat({ commitment: offered, seat: "provider" })).toBe(false);

    const expired = { ...base, derivedState: "EXPIRED" as CommitmentDerivedState };
    expect(commitmentNeedsSeat({ commitment: expired, seat: "provider" })).toBe(false);

    // Taking something up is an invitation, not an obligation.
    expect(commitmentNeedsSeat({ commitment: offered, seat: "bystander" })).toBe(false);
  });

  it("still badges the acts other people are actually waiting on", () => {
    for (const [derivedState, seat] of [
      ["ACTIVE", "provider"],
      ["EVIDENCE_SUBMITTED", "provider"],
      ["READY_FOR_CONFIRMATION", "confirmer"],
    ] as const) {
      expect(commitmentNeedsSeat({ commitment: { ...base, derivedState }, seat })).toBe(true);
    }
  });

  it("withholds every act while one is already waiting to send", () => {
    for (const seat of ["provider", "confirmer", "contributor", "bystander"] as const) {
      expect(selectCommitmentActKind({ commitment: base, seat, hasPendingJob: true })).toBeNull();
    }
  });
});
