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
    expect(commitmentNeedsSeat({ commitment: expired, seat: "provider", isCreator: true })).toBe(
      false
    );

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
describe("composing a settled commitment again", () => {
  const SETTLED: CommitmentDerivedState[] = ["EXPIRED", "FULFILLED", "RECONCILED", "CANCELLED"];
  const SEATS = ["provider", "confirmer", "contributor", "bystander"] as const;

  it("offers it to whoever made the commitment, in the commitment's own direction", () => {
    for (const derivedState of SETTLED) {
      // The person who made an offer reads as its provider; whoever asked reads
      // as the confirmer of their own request.
      expect(
        selectCommitmentActKind({
          commitment: { ...base, derivedState, direction: "OFFER" },
          seat: "provider",
          isCreator: true,
        })
      ).toBe("offerAgain");
      expect(
        selectCommitmentActKind({
          commitment: { ...base, derivedState, direction: "REQUEST" },
          seat: "confirmer",
          isCreator: true,
        })
      ).toBe("askAgain");
    }
  });

  it("offers it to nobody else, whatever seat they hold", () => {
    // Whoever took a request up sits in the provider seat once it lapses, and
    // the words are still the asker's. Starting from somebody else's commitment
    // is a different act, and not one this table offers.
    for (const derivedState of SETTLED) {
      for (const seat of SEATS) {
        for (const direction of ["OFFER", "REQUEST"] as const) {
          expect(
            selectCommitmentActKind({ commitment: { ...base, derivedState, direction }, seat })
          ).toBeNull();
        }
      }
    }
  });

  it("waits while the record is held under review, and never stands in for a live act", () => {
    expect(
      selectCommitmentActKind({
        commitment: { ...base, derivedState: "DISPUTED", direction: "OFFER" },
        seat: "provider",
        isCreator: true,
      })
    ).toBeNull();
    expect(
      selectCommitmentActKind({
        commitment: { ...base, derivedState: "OFFERED", direction: "OFFER" },
        seat: "provider",
        isCreator: true,
      })
    ).toBe("withdraw");
  });

  it("is the reader's own choice, so it never badges them", () => {
    for (const direction of ["OFFER", "REQUEST"] as const) {
      expect(
        commitmentNeedsSeat({
          commitment: { ...base, derivedState: "FULFILLED", direction },
          seat: direction === "OFFER" ? "provider" : "confirmer",
          isCreator: true,
        })
      ).toBe(false);
    }
  });
});
