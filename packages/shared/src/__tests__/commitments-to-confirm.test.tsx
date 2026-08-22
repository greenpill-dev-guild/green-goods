/** @vitest-environment jsdom */

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCommitmentsToConfirm } from "../hooks/commitment-pooling/useCommitmentsToConfirm";
import { renderHookWithProviders } from "./test-utils";

const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const OTHER = "0x2222222222222222222222222222222222222222" as const;
const GARDEN_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const GARDEN_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;

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
  gardens: [] as unknown[],
}));

vi.mock("../ontology/query", () => ({
  getOntologyChainMaturity: () => mocks.capability,
}));

vi.mock("../modules/commitment-pooling/data", () => ({
  getCommitments: mocks.getCommitments,
}));

vi.mock("../hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: mocks.gardens }),
}));

vi.mock("../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => VIEWER }));

function garden(id: string, name: string, overrides: Record<string, unknown> = {}) {
  return { id, name, operators: [], owners: [], evaluators: [], gardeners: [], ...overrides };
}

function commitment(overrides: Record<string, unknown> = {}) {
  return {
    id: "42161-9",
    chainId: 42161,
    commitmentId: 9n,
    creationSeen: true,
    onchainState: "READY_FOR_CONFIRMATION",
    derivedState: "READY_FOR_CONFIRMATION",
    state: "READY_FOR_CONFIRMATION",
    approvedUnits: 0n,
    evidenceCount: 1,
    cycleId: null,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 1n,
    creator: OTHER,
    leadProvider: OTHER,
    counterparty: GARDEN_A,
    direction: "OFFER",
    confirmers: [],
    contributorCount: 1,
    contributorsFrozen: false,
    ...overrides,
  };
}

async function toConfirm() {
  const { result } = renderHookWithProviders(() =>
    useCommitmentsToConfirm({ chainId: 42161, viewer: VIEWER })
  );
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result;
}

describe("useCommitmentsToConfirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.gardens = [];
  });

  it("exists only for someone who stewards a garden, and asks each garden as the party", async () => {
    mocks.gardens = [
      garden(GARDEN_A, "Rocinha", { operators: [VIEWER] }),
      garden(GARDEN_B, "Awka", { owners: [OTHER] }),
    ];
    mocks.getCommitments.mockResolvedValue([commitment()]);

    const result = await toConfirm();

    expect(result.current.isSteward).toBe(true);
    expect(mocks.getCommitments).toHaveBeenCalledTimes(1);
    expect(mocks.getCommitments).toHaveBeenCalledWith({
      chainId: 42161,
      account: GARDEN_A,
      state: "READY_FOR_CONFIRMATION",
    });
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0]?.gardenName).toBe("Rocinha");
    expect(result.current.groups[0]?.rows[0]?.seat).toBe("confirmer");
    expect(result.current.groups[0]?.rows[0]?.needsYou).toBe(true);
    expect(result.current.count).toBe(1);
  });

  it("is empty for a plain member, without asking the indexer", async () => {
    mocks.gardens = [garden(GARDEN_A, "Rocinha", { gardeners: [VIEWER] })];

    const result = await toConfirm();

    expect(result.current.isSteward).toBe(false);
    expect(result.current.groups).toEqual([]);
    expect(mocks.getCommitments).not.toHaveBeenCalled();
  });

  it("lists only what the garden itself must confirm", async () => {
    mocks.gardens = [garden(GARDEN_A, "Rocinha", { owners: [VIEWER] })];
    mocks.getCommitments.mockResolvedValue([
      // The garden took this up: its confirmation.
      commitment(),
      // The garden offered this one; somebody else confirms it.
      commitment({
        id: "42161-10",
        commitmentId: 10n,
        creator: GARDEN_A,
        leadProvider: GARDEN_A,
        counterparty: OTHER,
      }),
      // Named to confirm, which is the garden's turn too.
      commitment({
        id: "42161-11",
        commitmentId: 11n,
        counterparty: OTHER,
        confirmers: [GARDEN_A],
      }),
      // Still being worked: nothing to confirm yet, whatever the query returned.
      commitment({
        id: "42161-12",
        commitmentId: 12n,
        onchainState: "ACCEPTED",
        derivedState: "ACTIVE",
        state: "ACCEPTED",
      }),
    ]);

    const result = await toConfirm();

    expect(result.current.groups[0]?.rows.map((row) => row.commitment.id)).toEqual([
      "42161-11",
      "42161-9",
    ]);
  });

  it("leaves out what already sits in the reader's own inbox", async () => {
    mocks.gardens = [garden(GARDEN_A, "Rocinha", { operators: [VIEWER] })];
    mocks.getCommitments.mockResolvedValue([
      // The steward offered this to their own garden: they are the provider
      // and cannot confirm it, and it is already in Live.
      commitment({ creator: VIEWER, leadProvider: VIEWER }),
      // Named personally as well as through the garden: Live has it.
      commitment({ id: "42161-10", commitmentId: 10n, confirmers: [VIEWER] }),
      commitment({ id: "42161-11", commitmentId: 11n }),
    ]);

    const result = await toConfirm();

    expect(result.current.groups[0]?.rows.map((row) => row.commitment.id)).toEqual(["42161-11"]);
    expect(result.current.count).toBe(1);
  });

  it("reports a read that failed rather than an empty queue", async () => {
    mocks.gardens = [garden(GARDEN_A, "Rocinha", { operators: [VIEWER] })];
    mocks.getCommitments.mockRejectedValue(new Error("indexer unreachable"));

    const result = await toConfirm();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.groups).toEqual([]);
  });
});
