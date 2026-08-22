/** @vitest-environment jsdom */

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCommitmentsToConfirm } from "../hooks/commitment-pooling/useCommitmentsToConfirm";
import { renderHookWithProviders } from "./test-utils";

const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const OTHER = "0x2222222222222222222222222222222222222222" as const;
const GARDEN_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const GARDEN_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const ROOT_GARDEN = "0xcccccccccccccccccccccccccccccccccccccccc" as const;
const CONTRIBUTOR = "0x3333333333333333333333333333333333333333" as const;

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
  getFallbackCandidates: vi.fn(),
  gardens: [] as unknown[],
  protocolPool: {
    rootGarden: "0xcccccccccccccccccccccccccccccccccccccccc",
    poolId: 1n,
    isRegistered: true,
    isLoading: false,
  } as Record<string, unknown>,
}));

vi.mock("../ontology/query", () => ({
  getOntologyChainMaturity: () => mocks.capability,
}));

vi.mock("../modules/commitment-pooling/data", () => ({
  getCommitments: mocks.getCommitments,
  getFallbackConfirmationCandidates: mocks.getFallbackCandidates,
}));

vi.mock("../hooks/commitment-pooling/useProtocolPool", () => ({
  useProtocolPool: () => mocks.protocolPool,
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
    counterpartyKind: "GARDEN",
    direction: "OFFER",
    confirmers: [],
    contributorCount: 1,
    contributorsFrozen: false,
    ...overrides,
  };
}

/**
 * The hook asks two different questions: what each stewarded garden must
 * confirm, and what the reader is already a party to. The fixture answers them
 * apart so a row cannot be filtered out by its own garden's reply.
 */
function answerWith(gardenRows: unknown[], ownRows: unknown[] = []) {
  mocks.getCommitments.mockImplementation(async (input: { account?: string }) =>
    input.account?.toLowerCase() === VIEWER.toLowerCase() ? ownRows : gardenRows
  );
}

async function toConfirm(options: { includeProtocolFallback?: boolean } = {}) {
  const { result } = renderHookWithProviders(() =>
    useCommitmentsToConfirm({ chainId: 42161, viewer: VIEWER, ...options })
  );
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result;
}

describe("useCommitmentsToConfirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.gardens = [];
    mocks.getFallbackCandidates.mockResolvedValue([]);
  });

  it("exists only for someone who stewards a garden, and asks each garden as the party", async () => {
    mocks.gardens = [
      garden(GARDEN_A, "Rocinha", { operators: [VIEWER] }),
      garden(GARDEN_B, "Awka", { owners: [OTHER] }),
    ];
    answerWith([commitment()]);

    const result = await toConfirm();

    expect(result.current.isSteward).toBe(true);
    // The stewarded garden, plus the reader's own set that keeps team rows out.
    expect(mocks.getCommitments).toHaveBeenCalledTimes(2);
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

  it("lists only what a steward can confirm for the garden", async () => {
    mocks.gardens = [garden(GARDEN_A, "Rocinha", { owners: [VIEWER] })];
    answerWith([
      // The garden took this up: its stewards confirm (CreditLib.isOrdinaryConfirmer).
      commitment(),
      // The garden offered this one; somebody else confirms it.
      commitment({
        id: "42161-10",
        commitmentId: 10n,
        creator: GARDEN_A,
        leadProvider: GARDEN_A,
        counterparty: OTHER,
        counterpartyKind: "INDIVIDUAL",
      }),
      // The garden's address is named to confirm: only the garden account
      // itself can, not a steward's own key, so it is not this person's act.
      commitment({
        id: "42161-11",
        commitmentId: 11n,
        counterparty: OTHER,
        counterpartyKind: "INDIVIDUAL",
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

    expect(result.current.groups[0]?.rows.map((row) => row.commitment.id)).toEqual(["42161-9"]);
    expect(result.current.groups[0]?.rows[0]?.seat).toBe("confirmer");
  });

  it("leaves out what already sits in the reader's own inbox", async () => {
    mocks.gardens = [garden(GARDEN_A, "Rocinha", { operators: [VIEWER] })];
    answerWith(
      [
        // The steward offered this to their own garden: they are the provider
        // and cannot confirm it, and it is already in Live.
        commitment({ creator: VIEWER, leadProvider: VIEWER }),
        // Named personally as well as through the garden: Live has it.
        commitment({ id: "42161-10", commitmentId: 10n, confirmers: [VIEWER] }),
        commitment({ id: "42161-11", commitmentId: 11n }),
        // On the team as well as a steward. Only the account-scoped set knows,
        // because the roster is not loaded at list scope — and the contract
        // refuses a contributor's confirmation with SelfConfirmation.
        commitment({ id: "42161-12", commitmentId: 12n }),
      ],
      [commitment({ id: "42161-12", commitmentId: 12n })]
    );

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

  it("treats the reader's own read failing as the tab failing", async () => {
    // Without the own set a steward on a team would be listed and offered a
    // confirmation that reverts, so its failure is the tab's failure, and its
    // retry rides the tab's retry.
    mocks.gardens = [garden(GARDEN_A, "Rocinha", { operators: [VIEWER] })];
    mocks.getCommitments.mockImplementation(async (input: { account?: string }) => {
      if (input.account?.toLowerCase() === VIEWER.toLowerCase()) throw new Error("own read failed");
      return [commitment()];
    });

    const result = await toConfirm();

    await waitFor(() => expect(result.current.isError).toBe(true));
    const before = mocks.getCommitments.mock.calls.length;
    await result.current.refetch();
    const ownCalls = mocks.getCommitments.mock.calls
      .slice(before)
      .filter(
        (call) => (call[0] as { account?: string }).account?.toLowerCase() === VIEWER.toLowerCase()
      );
    expect(ownCalls).toHaveLength(1);
  });
});

describe("useCommitmentsToConfirm fallback group", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.gardens = [garden(GARDEN_A, "Rocinha", { operators: [VIEWER] })];
    answerWith([]);
  });

  it("lists a row only a steward's garden fallback can still confirm, and names the garden", async () => {
    mocks.getFallbackCandidates.mockResolvedValue([
      {
        // Taken up by a person who then joined the team: the ordinary path is
        // unreachable, and the garden's steward may step in with a reason.
        commitment: commitment({
          counterparty: OTHER,
          counterpartyKind: "INDIVIDUAL",
          confirmationThreshold: 1,
          protocolFallbackEnabled: false,
        }),
        activeContributors: [OTHER],
      },
      {
        // Still reachable: the taker is not on the roster. No fallback.
        commitment: commitment({
          id: "42161-10",
          commitmentId: 10n,
          counterparty: OTHER,
          counterpartyKind: "INDIVIDUAL",
          confirmationThreshold: 1,
        }),
        activeContributors: [CONTRIBUTOR],
      },
    ]);

    const result = await toConfirm();

    expect(mocks.getFallbackCandidates).toHaveBeenCalledWith({
      chainId: 42161,
      garden: GARDEN_A,
    });
    expect(result.current.fallback).toHaveLength(1);
    expect(result.current.fallback[0]).toMatchObject({
      path: "POOL_FALLBACK",
      garden: GARDEN_A,
      gardenName: "Rocinha",
    });
    expect(result.current.fallback[0]?.commitment.id).toBe("42161-9");
    expect(result.current.count).toBe(1);
  });

  it("never offers a fallback to a steward who is on the roster", async () => {
    mocks.getFallbackCandidates.mockResolvedValue([
      {
        commitment: commitment({
          counterparty: OTHER,
          counterpartyKind: "INDIVIDUAL",
          confirmationThreshold: 1,
        }),
        activeContributors: [OTHER, VIEWER],
      },
    ]);

    const result = await toConfirm();

    expect(result.current.fallback).toEqual([]);
  });

  it("keeps a row out of the fallback group when the garden can confirm it ordinarily", async () => {
    const row = commitment({ counterparty: GARDEN_A, counterpartyKind: "GARDEN" });
    answerWith([row]);
    mocks.getFallbackCandidates.mockResolvedValue([{ commitment: row, activeContributors: [] }]);

    const result = await toConfirm();

    expect(result.current.groups[0]?.rows).toHaveLength(1);
    expect(result.current.fallback).toEqual([]);
    expect(result.current.count).toBe(1);
  });

  it("reads protocol-fallback rows only when asked to, and only for a root-garden steward", async () => {
    const optedIn = {
      commitment: commitment({
        id: "42161-11",
        commitmentId: 11n,
        counterparty: OTHER,
        counterpartyKind: "INDIVIDUAL",
        confirmationThreshold: 1,
        protocolFallbackEnabled: true,
      }),
      activeContributors: [OTHER],
    };
    mocks.getFallbackCandidates.mockImplementation(async (input: { garden?: string }) =>
      input.garden === undefined ? [optedIn] : []
    );

    const local = await toConfirm();
    expect(local.current.fallback).toEqual([]);
    expect(mocks.getFallbackCandidates).not.toHaveBeenCalledWith({
      chainId: 42161,
      protocolFallbackEnabled: true,
    });

    mocks.gardens = [
      garden(GARDEN_A, "Rocinha", { operators: [VIEWER] }),
      garden(ROOT_GARDEN, "Green Goods", { operators: [VIEWER] }),
    ];
    const protocol = await toConfirm({ includeProtocolFallback: true });
    expect(mocks.getFallbackCandidates).toHaveBeenCalledWith({
      chainId: 42161,
      protocolFallbackEnabled: true,
    });
    expect(protocol.current.fallback.map((row) => [row.commitment.id, row.path])).toEqual([
      ["42161-11", "PROTOCOL_FALLBACK"],
    ]);
    expect(protocol.current.fallback[0]?.garden).toBe(ROOT_GARDEN);
  });

  it("reports a failed fallback read as an error, not an empty group", async () => {
    mocks.getFallbackCandidates.mockRejectedValue(new Error("indexer unreachable"));

    const result = await toConfirm();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.fallback).toEqual([]);
  });
});
