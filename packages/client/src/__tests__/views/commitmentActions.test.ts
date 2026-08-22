/**
 * The commitment view's act and band resolution.
 *
 * These are the guards for the defect class the seat axis exists to prevent:
 * an act offered to a seat that cannot perform it, and a sentence written to
 * the wrong person. Both shipped before, and neither typechecked its way out.
 */

import { describe, expect, it } from "vitest";

import { canLinkWork } from "@green-goods/shared";
import {
  canJoinTeam,
  selectCommitmentAct,
} from "../../views/Home/Garden/Commitment/commitmentActions";
import { selectStatusBand } from "../../views/Home/Garden/Commitment/statusBand";

const base = {
  derivedState: "ACTIVE" as const,
  claimMode: "OPEN" as const,
  contributorPolicy: "OPEN" as const,
  contributorsFrozen: false,
  contributorCount: 1,
};

describe("selectCommitmentAct", () => {
  it("offers nothing at all to a reader who is not signed in", () => {
    expect(selectCommitmentAct({ commitment: base, seat: null })).toBeNull();
  });

  it("never offers a provider the confirmation of their own commitment", () => {
    const act = selectCommitmentAct({
      commitment: { ...base, derivedState: "READY_FOR_CONFIRMATION" },
      seat: "provider",
    });
    expect(act).toBeNull();
  });

  it("offers confirmation only to the confirmer, and only when it is ready", () => {
    expect(
      selectCommitmentAct({
        commitment: { ...base, derivedState: "READY_FOR_CONFIRMATION" },
        seat: "confirmer",
      })?.kind
    ).toBe("confirm");
    expect(
      selectCommitmentAct({ commitment: { ...base, derivedState: "ACTIVE" }, seat: "confirmer" })
    ).toBeNull();
  });

  it("never lets someone on the team send or confirm", () => {
    expect(
      selectCommitmentAct({
        commitment: { ...base, derivedState: "EVIDENCE_SUBMITTED" },
        seat: "contributor",
      })
    ).toBeNull();
    expect(
      selectCommitmentAct({
        commitment: { ...base, derivedState: "READY_FOR_CONFIRMATION" },
        seat: "contributor",
      })
    ).toBeNull();
  });

  it("lets the team add proof while the commitment is still moving", () => {
    for (const seat of ["provider", "contributor"] as const) {
      expect(selectCommitmentAct({ commitment: base, seat })?.kind).toBe("addProof");
    }
  });

  it("lets only the lead send it, because sending settles the team", () => {
    expect(
      selectCommitmentAct({
        commitment: { ...base, derivedState: "EVIDENCE_SUBMITTED" },
        seat: "provider",
      })?.kind
    ).toBe("sendForConfirmation");
  });

  it("offers withdrawal to whoever made it, on either direction", () => {
    expect(
      selectCommitmentAct({ commitment: { ...base, derivedState: "OFFERED" }, seat: "provider" })
    ).toMatchObject({ kind: "withdraw", destructive: true });
    expect(
      selectCommitmentAct({ commitment: { ...base, derivedState: "REQUESTED" }, seat: "confirmer" })
    ).toMatchObject({ kind: "withdraw", destructive: true });
  });

  it("asks rather than takes when the garden reviews who takes things up", () => {
    expect(
      selectCommitmentAct({
        commitment: { ...base, derivedState: "OFFERED", claimMode: "APPROVAL_GATED" },
        seat: "bystander",
      })?.kind
    ).toBe("askToTakeUp");
    expect(
      selectCommitmentAct({
        commitment: { ...base, derivedState: "OFFERED" },
        seat: "bystander",
      })?.kind
    ).toBe("takeUp");
  });

  it("offers nothing once a commitment has stopped moving", () => {
    for (const derivedState of ["FULFILLED", "RECONCILED", "CANCELLED", "DISPUTED"] as const) {
      for (const seat of ["provider", "confirmer", "contributor", "bystander"] as const) {
        expect(selectCommitmentAct({ commitment: { ...base, derivedState }, seat })).toBeNull();
      }
    }
  });

  it("lets a lapsed commitment be offered again, but only by the person who made it", () => {
    expect(
      selectCommitmentAct({ commitment: { ...base, derivedState: "EXPIRED" }, seat: "provider" })
        ?.kind
    ).toBe("offerAgain");
    expect(
      selectCommitmentAct({ commitment: { ...base, derivedState: "EXPIRED" }, seat: "bystander" })
    ).toBeNull();
  });

  it("withholds the act while one is already waiting to send", () => {
    expect(
      selectCommitmentAct({ commitment: base, seat: "provider", hasPendingJob: true })
    ).toBeNull();
  });
});

describe("garden work with evidence submitted", () => {
  it("keeps adding proof rather than offering a send the chain refuses", () => {
    // submitForConfirmation reverts WorkApprovalRequired for every
    // DomainImpact commitment; the approvals move it on their own.
    const gardenWork = {
      ...base,
      derivedState: "EVIDENCE_SUBMITTED" as const,
      commitmentType: "DOMAIN_IMPACT" as const,
    };
    expect(selectCommitmentAct({ commitment: gardenWork, seat: "provider" })?.kind).toBe(
      "addProof"
    );
    expect(selectCommitmentAct({ commitment: gardenWork, seat: "contributor" })?.kind).toBe(
      "addProof"
    );
    const service = { ...gardenWork, commitmentType: "SUPPORT_SERVICE" as const };
    expect(selectCommitmentAct({ commitment: service, seat: "provider" })?.kind).toBe(
      "sendForConfirmation"
    );
  });
});

describe("canJoinTeam", () => {
  it("invites only an unrelated reader, and only while the team is open", () => {
    expect(canJoinTeam({ commitment: base, seat: "bystander", isGardenMember: true })).toBe(true);
    expect(canJoinTeam({ commitment: base, seat: "provider", isGardenMember: true })).toBe(false);
    expect(
      canJoinTeam({
        commitment: { ...base, contributorsFrozen: true },
        seat: "bystander",
        isGardenMember: true,
      })
    ).toBe(false);
    expect(
      canJoinTeam({
        commitment: { ...base, contributorPolicy: "LEAD_MANAGED" },
        seat: "bystander",
        isGardenMember: true,
      })
    ).toBe(false);
  });

  it("does not invite anyone onto a commitment that has already ended", () => {
    expect(
      canJoinTeam({
        commitment: { ...base, derivedState: "FULFILLED" },
        seat: "bystander",
        isGardenMember: true,
      })
    ).toBe(false);
  });

  it("does not invite anyone onto a full roster", () => {
    // The contract caps every roster at forty (TooManyContributors).
    expect(
      canJoinTeam({
        commitment: { ...base, contributorCount: 40 },
        seat: "bystander",
        isGardenMember: true,
      })
    ).toBe(false);
  });

  it("does not invite someone with no role in the garden doing the work", () => {
    // An open team is open to the garden's people. The contract refuses a
    // contributor from outside it, so the button never appears for them.
    expect(canJoinTeam({ commitment: base, seat: "bystander", isGardenMember: false })).toBe(false);
  });
});

describe("canLinkWork", () => {
  const gardenWork = {
    ...base,
    commitmentType: "DOMAIN_IMPACT" as const,
  };

  it("lets the team link work while garden work is still moving", () => {
    expect(canLinkWork({ commitment: gardenWork, seat: "provider", linkedCount: 0 })).toBe(true);
    expect(canLinkWork({ commitment: gardenWork, seat: "contributor", linkedCount: 39 })).toBe(
      true
    );
    expect(canLinkWork({ commitment: gardenWork, seat: "confirmer", linkedCount: 0 })).toBe(false);
    expect(
      canLinkWork({
        commitment: { ...gardenWork, commitmentType: "SUPPORT_SERVICE" },
        seat: "provider",
        linkedCount: 0,
      })
    ).toBe(false);
  });

  it("stops at the contract's ceiling, counting every active link", () => {
    // ProofLib.linkWork rejects the forty-first (TooManyLinkedWorks), and
    // pending or rejected submissions hold a slot as much as approved ones.
    expect(canLinkWork({ commitment: gardenWork, seat: "provider", linkedCount: 40 })).toBe(false);
  });
});

describe("selectStatusBand", () => {
  it("tells the provider they cannot confirm, rather than asking them to", () => {
    const band = selectStatusBand({
      commitment: { derivedState: "READY_FOR_CONFIRMATION" },
      seat: "provider",
    });
    expect(band?.titleId).toBe("app.commitment.band.provider.ready.t");
    expect(band?.titleId).not.toBe("app.commitment.band.confirmer.ready.t");
  });

  it("credits the confirmer with confirming, never with doing the work", () => {
    const confirmer = selectStatusBand({
      commitment: { derivedState: "FULFILLED" },
      seat: "confirmer",
    });
    const provider = selectStatusBand({
      commitment: { derivedState: "FULFILLED" },
      seat: "provider",
    });
    expect(confirmer?.titleId).toBe("app.commitment.band.confirmer.fulfilled.t");
    expect(provider?.titleId).toBe("app.commitment.band.provider.fulfilled.t");
    expect(confirmer?.titleId).not.toBe(provider?.titleId);
  });

  it("gives each seat its own sentence on the same stage", () => {
    const seen = new Set<string>();
    for (const seat of ["provider", "confirmer", "contributor"] as const) {
      const band = selectStatusBand({ commitment: { derivedState: "ACTIVE" }, seat });
      expect(band).not.toBeNull();
      seen.add(band?.titleId ?? "");
    }
    expect(seen.size).toBe(3);
  });

  it("falls back to a neutral fact rather than another seat's sentence", () => {
    const band = selectStatusBand({ commitment: { derivedState: "EXPIRED" }, seat: "contributor" });
    expect(band?.titleId).toBe("app.commitment.band.any.expired.t");
  });

  it("says nothing to an unauthenticated reader that claims a relationship", () => {
    const band = selectStatusBand({ commitment: { derivedState: "ACTIVE" }, seat: null });
    expect(band).toBeNull();
  });
});
