/**
 * The steward's read questions, answered from the record the way the contract
 * answers them: who may still confirm on the ordinary path
 * (CreditLib.sol:206-230), which live commitments are past due
 * (TerminalLib.sol:62-72), and who counts as a pool steward.
 */

import { describe, expect, it } from "vitest";

import {
  isPoolSteward,
  selectDueLiveCommitments,
  selectNextDueBoundary,
  selectOrdinaryConfirmationReachable,
} from "../modules/commitment-pooling/steward-selectors";

const CREATOR = "0x1111111111111111111111111111111111111111" as const;
const TAKER = "0x2222222222222222222222222222222222222222" as const;
const NAMED_A = "0x3333333333333333333333333333333333333333" as const;
const NAMED_B = "0x4444444444444444444444444444444444444444" as const;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

describe("selectOrdinaryConfirmationReachable", () => {
  it("counts named confirmers who are not on the active roster against the threshold", () => {
    expect(
      selectOrdinaryConfirmationReachable({
        confirmers: [NAMED_A, NAMED_B],
        confirmationThreshold: 2,
        direction: "OFFER",
        counterpartyKind: "INDIVIDUAL",
        creator: CREATOR,
        counterparty: TAKER,
        activeContributors: [NAMED_B],
      })
    ).toBe(false);
    expect(
      selectOrdinaryConfirmationReachable({
        confirmers: [NAMED_A, NAMED_B],
        confirmationThreshold: 1,
        direction: "OFFER",
        counterpartyKind: "INDIVIDUAL",
        creator: CREATOR,
        counterparty: TAKER,
        activeContributors: [NAMED_B],
      })
    ).toBe(true);
  });

  it("compares addresses case-insensitively, the way the index stores them", () => {
    expect(
      selectOrdinaryConfirmationReachable({
        confirmers: [NAMED_A.toUpperCase() as typeof NAMED_A],
        confirmationThreshold: 1,
        direction: "OFFER",
        counterpartyKind: "INDIVIDUAL",
        creator: CREATOR,
        counterparty: TAKER,
        activeContributors: [NAMED_A],
      })
    ).toBe(false);
  });

  it("on a Request with no named group, the creator confirms unless they joined the team", () => {
    const request = {
      confirmers: [],
      confirmationThreshold: 1,
      direction: "REQUEST" as const,
      counterpartyKind: "INDIVIDUAL" as const,
      creator: CREATOR,
      counterparty: TAKER,
    };
    expect(selectOrdinaryConfirmationReachable({ ...request, activeContributors: [TAKER] })).toBe(
      true
    );
    expect(
      selectOrdinaryConfirmationReachable({ ...request, activeContributors: [TAKER, CREATOR] })
    ).toBe(false);
  });

  it("on an Offer taken up by a garden, the garden's stewards always can", () => {
    expect(
      selectOrdinaryConfirmationReachable({
        confirmers: [],
        confirmationThreshold: 1,
        direction: "OFFER",
        counterpartyKind: "GARDEN",
        creator: CREATOR,
        counterparty: GARDEN,
        activeContributors: [CREATOR, TAKER],
      })
    ).toBe(true);
  });

  it("on an Offer taken up by a person, that person confirms unless they are on the roster", () => {
    const offer = {
      confirmers: [],
      confirmationThreshold: 1,
      direction: "OFFER" as const,
      counterpartyKind: "INDIVIDUAL" as const,
      creator: CREATOR,
      counterparty: TAKER,
    };
    expect(selectOrdinaryConfirmationReachable({ ...offer, activeContributors: [CREATOR] })).toBe(
      true
    );
    expect(
      selectOrdinaryConfirmationReachable({ ...offer, activeContributors: [CREATOR, TAKER] })
    ).toBe(false);
  });

  it("is unreachable before anyone has taken the commitment up", () => {
    expect(
      selectOrdinaryConfirmationReachable({
        confirmers: [],
        confirmationThreshold: 1,
        direction: "OFFER",
        counterpartyKind: null,
        creator: CREATOR,
        counterparty: null,
        activeContributors: [],
      })
    ).toBe(false);
  });
});

describe("selectDueLiveCommitments", () => {
  const base = {
    id: "42161-1",
    chainId: 42161,
    commitmentId: 1n,
    creationSeen: true,
    onchainState: "ACCEPTED" as const,
    derivedState: "ACTIVE" as const,
    state: "ACCEPTED" as const,
    approvedUnits: 0n,
    evidenceCount: 0,
    cycleId: null,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 1n,
    confirmers: [],
    contributorCount: 1,
    contributorsFrozen: false,
    dueDate: null,
  };
  const now = 1_756_000_000n;

  it("lists live commitments whose own due date has passed, strictly", () => {
    const rows = selectDueLiveCommitments({
      commitments: [
        { ...base, commitmentId: 1n, dueDate: now - 1n },
        { ...base, id: "42161-2", commitmentId: 2n, dueDate: now },
        { ...base, id: "42161-3", commitmentId: 3n, dueDate: now + 1n },
      ],
      cycleEndTimes: new Map(),
      now,
    });
    expect(rows.map((row) => row.commitmentId)).toEqual([1n]);
  });

  it("falls back to the cycle's end when the commitment carries no due date", () => {
    const rows = selectDueLiveCommitments({
      commitments: [
        { ...base, commitmentId: 1n, cycleId: 12n },
        { ...base, id: "42161-2", commitmentId: 2n, cycleId: 13n },
        // Cycle-less and undated: never due.
        { ...base, id: "42161-3", commitmentId: 3n },
      ],
      cycleEndTimes: new Map([
        ["12", now - 10n],
        ["13", now + 10n],
      ]),
      now,
    });
    expect(rows.map((row) => row.commitmentId)).toEqual([1n]);
  });

  it("includes only the four states expireCommitment accepts", () => {
    const states = [
      "OFFERED",
      "REQUESTED",
      "ACCEPTED",
      "READY_FOR_CONFIRMATION",
      "FULFILLED",
      "CANCELLED",
      "EXPIRED",
      "DISPUTED",
    ] as const;
    const rows = selectDueLiveCommitments({
      commitments: states.map((state, index) => ({
        ...base,
        id: `42161-${index}`,
        commitmentId: BigInt(index),
        onchainState: state,
        state,
        dueDate: now - 1n,
      })),
      cycleEndTimes: new Map(),
      now,
    });
    expect(rows.map((row) => row.onchainState)).toEqual([
      "OFFERED",
      "REQUESTED",
      "ACCEPTED",
      "READY_FOR_CONFIRMATION",
    ]);
  });
});

describe("isPoolSteward", () => {
  it("is the garden's steward or owner Hat, nothing else", () => {
    expect(isPoolSteward(["steward"])).toBe(true);
    expect(isPoolSteward(["owner"])).toBe(true);
    expect(isPoolSteward(["gardener", "owner"])).toBe(true);
    expect(isPoolSteward(["gardener"])).toBe(false);
    expect(isPoolSteward(["evaluator"])).toBe(false);
    expect(isPoolSteward([])).toBe(false);
  });
});

describe("selectNextDueBoundary", () => {
  const live = (dueDate: bigint | null, cycleId: bigint | null = null) => ({
    onchainState: "ACCEPTED" as const,
    cycleId,
    dueDate,
  });

  it("names the earliest moment a live row falls due", () => {
    expect(
      selectNextDueBoundary({
        commitments: [live(400n), live(200n), live(900n)],
        cycleEndTimes: new Map(),
        now: 100n,
      })
    ).toBe(200n);
  });

  it("falls back to the cycle end for a row with no date of its own", () => {
    expect(
      selectNextDueBoundary({
        commitments: [live(null, 7n)],
        cycleEndTimes: new Map([["7", 500n]]),
        now: 100n,
      })
    ).toBe(500n);
  });

  it("is null once nothing live is still ahead of now", () => {
    expect(
      selectNextDueBoundary({
        commitments: [live(50n), { onchainState: "FULFILLED", cycleId: null, dueDate: 900n }],
        cycleEndTimes: new Map(),
        now: 100n,
      })
    ).toBeNull();
  });
});
