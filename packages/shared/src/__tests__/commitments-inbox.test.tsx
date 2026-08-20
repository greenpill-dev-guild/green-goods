/** @vitest-environment jsdom */

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCommitmentsInbox } from "../hooks/commitment-pooling/useCommitmentsInbox";
import { renderHookWithProviders } from "./test-utils";

const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const OTHER = "0x2222222222222222222222222222222222222222" as const;

const mocks = vi.hoisted(() => ({
  capability: {
    deployment: "deployed",
    activation: "active",
    integration: "integrated",
    availability: "available",
    evidence: [],
    verified_at: "2026-08-16",
  } as unknown,
  getCommitments: vi.fn(),
}));

vi.mock("../ontology/query", () => ({
  getOntologyChainMaturity: () => mocks.capability,
}));

vi.mock("../modules/commitment-pooling/data", () => ({
  getCommitments: mocks.getCommitments,
}));

function commitment(overrides: Record<string, unknown> = {}) {
  return {
    id: "42161-9",
    chainId: 42161,
    commitmentId: 9n,
    creationSeen: true,
    onchainState: "ACCEPTED",
    derivedState: "ACTIVE",
    state: "ACCEPTED",
    approvedUnits: 0n,
    evidenceCount: 0,
    cycleId: null,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 1n,
    creator: VIEWER,
    leadProvider: VIEWER,
    counterparty: OTHER,
    direction: "OFFER",
    confirmers: [],
    contributorCount: 1,
    contributorsFrozen: false,
    ...overrides,
  };
}

async function inboxFor(rows: ReturnType<typeof commitment>[]) {
  mocks.getCommitments.mockResolvedValue(rows);
  const { result } = renderHookWithProviders(() =>
    useCommitmentsInbox({ chainId: 42161, viewer: VIEWER })
  );
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result;
}

describe("useCommitmentsInbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("splits by tense, so a kept commitment leaves the live list entirely", async () => {
    const result = await inboxFor([
      commitment(),
      commitment({ id: "42161-10", commitmentId: 10n, derivedState: "FULFILLED" }),
      commitment({ id: "42161-11", commitmentId: 11n, derivedState: "EXPIRED" }),
      commitment({ id: "42161-12", commitmentId: 12n, derivedState: "DISPUTED" }),
    ]);

    expect(result.current.live.map((row) => row.commitment.id)).toEqual(["42161-9", "42161-12"]);
    expect(result.current.settled.map((row) => row.commitment.id)).toEqual([
      "42161-11",
      "42161-10",
    ]);
  });

  it("counts what needs an act, never what is merely present", async () => {
    const result = await inboxFor([
      // Waiting on this provider to get on with it.
      commitment(),
      // Waiting on somebody else to confirm, so it needs nothing from them.
      commitment({ id: "42161-10", commitmentId: 10n, derivedState: "READY_FOR_CONFIRMATION" }),
      commitment({ id: "42161-11", commitmentId: 11n, derivedState: "FULFILLED" }),
    ]);

    expect(result.current.live).toHaveLength(2);
    expect(result.current.liveActCount).toBe(1);
    expect(result.current.settledActCount).toBe(0);
    expect(result.current.totalActCount).toBe(1);
  });

  it("keeps the header count equal to the tabs' sum", async () => {
    const result = await inboxFor([
      commitment(),
      commitment({ id: "42161-10", commitmentId: 10n }),
    ]);

    expect(result.current.totalActCount).toBe(
      result.current.liveActCount + result.current.settledActCount
    );
  });

  it("asks the confirmer to act only when it is actually their turn", async () => {
    const asConfirmer = {
      creator: OTHER,
      leadProvider: OTHER,
      counterparty: VIEWER,
      direction: "OFFER",
    };

    const result = await inboxFor([
      commitment({ ...asConfirmer, derivedState: "READY_FOR_CONFIRMATION" }),
      commitment({ ...asConfirmer, id: "42161-10", commitmentId: 10n, derivedState: "ACTIVE" }),
    ]);

    const ready = result.current.live.find((row) => row.commitment.id === "42161-9");
    const active = result.current.live.find((row) => row.commitment.id === "42161-10");
    expect(ready?.seat).toBe("confirmer");
    expect(ready?.needsYou).toBe(true);
    expect(active?.needsYou).toBe(false);
    expect(result.current.liveActCount).toBe(1);
  });

  it("puts what needs you at the top of its list", async () => {
    const result = await inboxFor([
      commitment({ id: "42161-20", commitmentId: 20n, derivedState: "READY_FOR_CONFIRMATION" }),
      commitment({ id: "42161-9", commitmentId: 9n, derivedState: "ACTIVE" }),
    ]);

    expect(result.current.live[0]?.commitment.id).toBe("42161-9");
    expect(result.current.live[0]?.needsYou).toBe(true);
  });

  it("reads a row it only matched through the team as a contributor, not a stranger", async () => {
    // The account query returns a commitment when the reader is a party OR on
    // its team, so a row naming neither of their addresses is one they joined.
    const result = await inboxFor([
      commitment({ creator: OTHER, leadProvider: OTHER, counterparty: null, contributorCount: 3 }),
    ]);

    expect(result.current.live[0]?.seat).toBe("contributor");
  });

  it("reads nothing at all when nobody is signed in", async () => {
    // An absent account does not narrow the query, it removes the filter, so a
    // signed-out reader would otherwise be handed every commitment on the chain.
    mocks.getCommitments.mockResolvedValue([commitment()]);
    const { result } = renderHookWithProviders(() =>
      useCommitmentsInbox({ chainId: 42161, viewer: undefined })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocks.getCommitments).not.toHaveBeenCalled();
    expect(result.current.live).toEqual([]);
    expect(result.current.settled).toEqual([]);
    expect(result.current.totalActCount).toBe(0);
  });
});
