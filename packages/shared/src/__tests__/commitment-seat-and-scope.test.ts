import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Address } from "../types/domain";
import { selectCommitmentSeat } from "../modules/commitment-pooling";
import { getCommitments } from "../modules/commitment-pooling/data";
import { mapCommitment } from "../modules/commitment-pooling/data-core";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("../modules/data/graphql-client", () => ({
  greenGoodsIndexer: { query: (...args: unknown[]) => mocks.query(...args) },
}));

const ASKER = "0x1111111111111111111111111111111111111111" as Address;
const OFFERER = "0x2222222222222222222222222222222222222222" as Address;
const TAKER = "0x3333333333333333333333333333333333333333" as Address;
const HELPER = "0x4444444444444444444444444444444444444444" as Address;
const STRANGER = "0x5555555555555555555555555555555555555555" as Address;
const ZERO = "0x0000000000000000000000000000000000000000" as Address;

// Pre-acceptance the contract has written neither party address, so the
// indexer stores both as absent (commitment-pool-factories.ts:170-171).
const offerUnclaimed = {
  creator: OFFERER,
  leadProvider: null,
  counterparty: null,
  direction: "OFFER",
} as const;

// At acceptance an Offer's creator becomes the lead and the taker becomes the
// counterparty (AcceptanceLib.sol:142,172-174).
const offerAccepted = {
  creator: OFFERER,
  leadProvider: OFFERER,
  counterparty: TAKER,
  direction: "OFFER",
} as const;

const requestUnclaimed = {
  creator: ASKER,
  leadProvider: null,
  counterparty: null,
  direction: "REQUEST",
} as const;

// On a Request the taker becomes BOTH lead and counterparty; the asker appears
// in no party field but `creator` (AcceptanceLib.sol:146,172-174).
const requestAccepted = {
  creator: ASKER,
  leadProvider: TAKER,
  counterparty: TAKER,
  direction: "REQUEST",
} as const;

describe("selectCommitmentSeat", () => {
  it("returns null without a viewer, and never a default seat", () => {
    expect(selectCommitmentSeat({ commitment: offerAccepted, contributors: [] })).toBeNull();
    expect(selectCommitmentSeat({ commitment: requestAccepted, contributors: [TAKER] })).toBeNull();
  });

  it("seats the creator by direction before anyone has taken it up", () => {
    expect(
      selectCommitmentSeat({ commitment: offerUnclaimed, contributors: [], viewer: OFFERER })
    ).toBe("provider");
    expect(
      selectCommitmentSeat({ commitment: requestUnclaimed, contributors: [], viewer: ASKER })
    ).toBe("confirmer");
  });

  it("seats a stranger as a bystander on either direction", () => {
    expect(
      selectCommitmentSeat({ commitment: offerUnclaimed, contributors: [], viewer: STRANGER })
    ).toBe("bystander");
    expect(
      selectCommitmentSeat({ commitment: offerAccepted, contributors: [TAKER], viewer: STRANGER })
    ).toBe("bystander");
  });

  it("seats both sides of an accepted Offer", () => {
    expect(
      selectCommitmentSeat({ commitment: offerAccepted, contributors: [OFFERER], viewer: OFFERER })
    ).toBe("provider");
    expect(
      selectCommitmentSeat({ commitment: offerAccepted, contributors: [OFFERER], viewer: TAKER })
    ).toBe("confirmer");
  });

  it("keeps the asker on an accepted Request a confirmer, not a bystander", () => {
    // The regression this rung exists for: the contract stores the taker in
    // `counterparty` on a Request, so a counterparty-only test loses the asker
    // on their own request and every *-ready-confirmer state with them.
    expect(
      selectCommitmentSeat({ commitment: requestAccepted, contributors: [TAKER], viewer: ASKER })
    ).toBe("confirmer");
    expect(
      selectCommitmentSeat({ commitment: requestAccepted, contributors: [TAKER], viewer: TAKER })
    ).toBe("provider");
  });

  it("seats a team member who is not the lead as a contributor", () => {
    expect(
      selectCommitmentSeat({
        commitment: offerAccepted,
        contributors: [OFFERER, HELPER],
        viewer: HELPER,
      })
    ).toBe("contributor");
  });

  it("seats the lead as provider even though the lead is also on the roster", () => {
    // Order regression guard: acceptance seeds the lead as contributor #1, so a
    // contributors-first test would seat every provider as a contributor.
    expect(
      selectCommitmentSeat({
        commitment: offerAccepted,
        contributors: [OFFERER, HELPER],
        viewer: OFFERER,
      })
    ).toBe("provider");
  });

  it("treats a zero address as nobody rather than as a match", () => {
    expect(
      selectCommitmentSeat({
        commitment: { ...offerUnclaimed, leadProvider: ZERO, counterparty: ZERO },
        contributors: [ZERO],
        viewer: ZERO,
      })
    ).toBe("bystander");
  });

  it("compares accounts without regard to address casing", () => {
    expect(
      selectCommitmentSeat({
        commitment: offerAccepted,
        contributors: [],
        viewer: TAKER.toUpperCase() as Address,
      })
    ).toBe("confirmer");
  });
});

describe("commitment read model relationships", () => {
  it("normalizes the nine relationship fields the seat and team surfaces need", () => {
    const commitment = mapCommitment({
      id: "42161-9",
      chainId: "42161",
      commitmentId: "9",
      creationSeen: true,
      state: "ACCEPTED",
      approvedUnits: "0",
      evidenceCount: "0",
      targetUnits: "1",
      creator: OFFERER.toUpperCase(),
      leadProvider: OFFERER.toUpperCase(),
      counterparty: TAKER.toUpperCase(),
      recordedBy: HELPER.toUpperCase(),
      direction: "OFFER",
      commitmentType: "DOMAIN_IMPACT",
      claimMode: "APPROVAL_GATED",
      contributorPolicy: "OPEN",
      confirmers: [TAKER.toUpperCase()],
      contributorCount: "2",
      contributorsFrozen: true,
    });

    expect(commitment.counterparty).toBe(TAKER.toLowerCase());
    expect(commitment.recordedBy).toBe(HELPER.toLowerCase());
    expect(commitment.direction).toBe("OFFER");
    expect(commitment.commitmentType).toBe("DOMAIN_IMPACT");
    expect(commitment.claimMode).toBe("APPROVAL_GATED");
    expect(commitment.contributorPolicy).toBe("OPEN");
    expect(commitment.confirmers).toEqual([TAKER.toLowerCase()]);
    expect(commitment.contributorCount).toBe(2);
    expect(commitment.contributorsFrozen).toBe(true);
  });

  it("leaves both party fields absent before anyone has taken it up", () => {
    const commitment = mapCommitment({
      id: "42161-9",
      chainId: "42161",
      commitmentId: "9",
      creationSeen: true,
      state: "OFFERED",
      approvedUnits: "0",
      evidenceCount: "0",
      targetUnits: "1",
      creator: OFFERER,
      direction: "OFFER",
      contributorCount: "0",
      contributorsFrozen: false,
    });

    expect(commitment.leadProvider).toBeNull();
    expect(commitment.counterparty).toBeNull();
    expect(commitment.confirmers).toEqual([]);
    expect(commitment.contributorCount).toBe(0);
    expect(selectCommitmentSeat({ commitment, contributors: [], viewer: OFFERER })).toBe(
      "provider"
    );
  });
});

describe("account-scoped commitment reads", () => {
  function lastCommitmentQuery(): { document: string; variables: Record<string, unknown> } {
    const call = mocks.query.mock.calls.find((args) => args[2] === "getCommitments");
    if (!call) throw new Error("no getCommitments call recorded");
    return { document: String(call[0]), variables: call[1] as Record<string, unknown> };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockImplementation(
      async (_document: string, _variables: unknown, operation: string) => ({
        data: {
          [operation === "getCommitmentMembership" ? "CommitmentContributor" : "Commitment"]: [],
        },
      })
    );
  });

  it("asks for every commitment the account is a party to, not only its rostered ones", async () => {
    await getCommitments({ chainId: 42161, account: ASKER });

    const { document, variables } = lastCommitmentQuery();
    expect(document).toContain("creator: { _eq: $account }");
    expect(document).toContain("leadProvider: { _eq: $account }");
    expect(document).toContain("counterparty: { _eq: $account }");
    expect(variables.account).toBe(ASKER.toLowerCase());
  });

  it("still queries when the account is on no roster at all", async () => {
    // A commitment nobody has taken up has no roster, and a confirmer is never
    // put on one. An empty membership result is not an empty answer.
    await getCommitments({ chainId: 42161, account: ASKER });

    const { document, variables } = lastCommitmentQuery();
    expect(document).not.toContain("$ids");
    expect(variables.ids).toBeUndefined();
  });

  it("finds a commitment that names the reader as a confirmer", async () => {
    // Seating them as confirmer is no use if their own sheet never lists it.
    await getCommitments({ chainId: 42161, account: ASKER });

    const { document } = lastCommitmentQuery();
    expect(document).toContain("confirmers: { _contains: [$account] }");
  });

  it("adds roster membership as one more way in, never as the only one", async () => {
    mocks.query.mockImplementation(
      async (_document: string, _variables: unknown, operation: string) => {
        if (operation === "getCommitmentMembership") {
          return { data: { CommitmentContributor: [{ commitmentEntityId: "42161-9" }] } };
        }
        return { data: { Commitment: [] } };
      }
    );

    await getCommitments({ chainId: 42161, account: HELPER });

    const { document, variables } = lastCommitmentQuery();
    expect(document).toContain("id: { _in: $ids }");
    expect(document).toContain("creator: { _eq: $account }");
    expect(variables.ids).toEqual(["42161-9"]);
  });

  it("leaves an unscoped read free of any account filter", async () => {
    await getCommitments({ chainId: 42161, poolId: 9n });

    const { document } = lastCommitmentQuery();
    expect(document).not.toContain("_or:");
    expect(document).not.toContain("$account");
  });
});

describe("named confirmers", () => {
  it("seats someone named to confirm as the confirmer, not a bystander", () => {
    // setConfirmerRule can name people who are neither party. Without this rung
    // they read as bystanders and are never offered the one act they exist for.
    expect(
      selectCommitmentSeat({
        commitment: { ...offerAccepted, confirmers: [HELPER] },
        contributors: [],
        viewer: HELPER,
      })
    ).toBe("confirmer");
  });

  it("keeps someone on the team a contributor even when also named to confirm", () => {
    // The contract refuses a contributor's confirmation whatever else they are:
    // ConfirmLib reverts SelfConfirmation before it asks about the confirmer
    // list. Seating them as confirmer would offer an act the chain rejects.
    expect(
      selectCommitmentSeat({
        commitment: { ...offerAccepted, confirmers: [HELPER] },
        contributors: [HELPER],
        viewer: HELPER,
      })
    ).toBe("contributor");
  });

  it("still lets the lead outrank a confirmer list they also appear on", () => {
    expect(
      selectCommitmentSeat({
        commitment: { ...offerAccepted, confirmers: [OFFERER] },
        contributors: [],
        viewer: OFFERER,
      })
    ).toBe("provider");
  });

  it("leaves everyone else a bystander when the list does not name them", () => {
    expect(
      selectCommitmentSeat({
        commitment: { ...offerAccepted, confirmers: [HELPER] },
        contributors: [],
        viewer: STRANGER,
      })
    ).toBe("bystander");
  });
});
