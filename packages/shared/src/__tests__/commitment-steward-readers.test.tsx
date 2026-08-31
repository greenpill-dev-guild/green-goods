/** @vitest-environment jsdom */

/**
 * The steward's reads that no surface had yet: the protocol pool's identity
 * from the module, every pending claim across a pool (the claim entity has no
 * pool field, so it is a join through the commitment), and the
 * ready-for-confirmation rows of a pool with their active rosters, which is
 * what the Confirm stage needs to tell an ordinary-reachable row from one
 * that only a steward's fallback can still confirm.
 */

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "../config/query-keys";
import { renderHookWithProviders } from "./test-utils";

const mocks = vi.hoisted(() => ({
  capability: {
    deployment: "deployed",
    activation: "active",
    integration: "integrated",
    availability: "available",
    evidence: [],
    verified_at: "2026-08-16",
  } as unknown,
  query: vi.fn(),
  readContract: vi.fn(),
}));

vi.mock("../ontology/query", () => ({ getOntologyChainMaturity: () => mocks.capability }));
vi.mock("../modules/data/graphql-client", () => ({
  greenGoodsIndexer: { query: (...args: unknown[]) => mocks.query(...args) },
}));
vi.mock("@wagmi/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@wagmi/core")>()),
  readContract: mocks.readContract,
}));
vi.mock("../config/appkit", () => ({ getWagmiConfig: () => ({ mocked: true }) }));
vi.mock("../utils/blockchain/contracts", async () => {
  const actual = await vi.importActual<typeof import("../utils/blockchain/contracts")>(
    "../utils/blockchain/contracts"
  );
  return {
    ...actual,
    getNetworkContracts: () => ({
      commitmentPoolingModule: "0x6bb5b0fd70b6771b0e955fef37f8bd2ce911470a",
    }),
  };
});

const { getFallbackConfirmationCandidates, getPoolClaimRequests } = await import(
  "../modules/commitment-pooling/data"
);
const { useProtocolPool } = await import("../hooks/commitment-pooling/useProtocolPool");
const { usePoolClaimRequests } = await import("../hooks/commitment-pooling/usePoolClaimRequests");

const ROOT_GARDEN = "0xf401f34378384713222d1d21f63359cc4E8a858a";
const CLAIMANT = "0x2222222222222222222222222222222222222222";
const CONTRIBUTOR = "0x3333333333333333333333333333333333333333";

function commitmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "42161-9",
    chainId: 42161,
    commitmentId: "9",
    creationSeen: true,
    poolId: "7",
    cycleId: null,
    state: "OFFERED",
    direction: "OFFER",
    confirmers: [],
    confirmationThreshold: 1,
    confirmationCount: 0,
    protocolFallbackEnabled: true,
    approvedUnits: "0",
    evidenceCount: 0,
    targetUnits: "1",
    contributorCount: 1,
    contributorsFrozen: false,
    dueDate: "1755000000",
    ...overrides,
  };
}

function claimRow(overrides: Record<string, unknown> = {}) {
  return {
    id: `42161-9-${CLAIMANT}`,
    chainId: 42161,
    commitmentId: "9",
    claimant: CLAIMANT,
    requestSeen: true,
    requestedBy: CLAIMANT,
    claimType: "INDIVIDUAL",
    gardenContext: null,
    state: "PENDING",
    reasonCID: null,
    resolutionCode: null,
    requestedAt: 1_700_000_000,
    resolvedAt: null,
    updatedAt: 1_700_000_100,
    ...overrides,
  };
}

describe("getPoolClaimRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("joins pending claims to the pool through its pre-acceptance commitments", async () => {
    mocks.query
      .mockResolvedValueOnce({ data: { Commitment: [commitmentRow()] } })
      .mockResolvedValueOnce({ data: { CommitmentClaimRequest: [claimRow()] } });

    const rows = await getPoolClaimRequests({ chainId: 42161, poolId: 7n, state: "PENDING" });

    const [commitmentQuery, commitmentVariables] = mocks.query.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(commitmentQuery).toContain("poolId: { _eq: $poolId }");
    // Pending claims exist only before acceptance: the join stays bounded.
    expect(commitmentQuery).toContain("state: { _in: [OFFERED, REQUESTED] }");
    expect(commitmentVariables).toMatchObject({ chainId: 42161, poolId: "7" });
    const [claimQuery, claimVariables] = mocks.query.mock.calls[1] as [
      string,
      Record<string, unknown>,
    ];
    expect(claimQuery).toContain("commitmentEntityId: { _in: $ids }");
    expect(claimQuery).toContain("state: { _eq: $state }");
    expect(claimVariables).toMatchObject({ ids: ["42161-9"], state: "PENDING" });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.claim.claimant).toBe(CLAIMANT);
    expect(rows[0]?.claim.state).toBe("PENDING");
    expect(rows[0]?.commitment.commitmentId).toBe(9n);
    // dueDate now travels typed, not only through the row spread.
    expect(rows[0]?.commitment.dueDate).toBe(1_755_000_000n);
  });

  it("asks nothing more when the pool has no commitment a claim could sit on", async () => {
    mocks.query.mockResolvedValueOnce({ data: { Commitment: [] } });

    const rows = await getPoolClaimRequests({ chainId: 42161, poolId: 7n, state: "PENDING" });

    expect(rows).toEqual([]);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
});

describe("getFallbackConfirmationCandidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the pool's ready-for-confirmation rows with their active rosters", async () => {
    mocks.query
      .mockResolvedValueOnce({
        data: {
          Commitment: [
            commitmentRow({ state: "READY_FOR_CONFIRMATION", counterparty: CLAIMANT }),
            commitmentRow({
              id: "42161-10",
              commitmentId: "10",
              state: "READY_FOR_CONFIRMATION",
              counterparty: CLAIMANT,
            }),
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          CommitmentContributor: [
            { commitmentEntityId: "42161-9", contributor: CONTRIBUTOR, active: true },
            { commitmentEntityId: "42161-9", contributor: CLAIMANT, active: true },
          ],
        },
      });

    const candidates = await getFallbackConfirmationCandidates({ chainId: 42161, poolId: 7n });

    const [commitmentQuery, variables] = mocks.query.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(commitmentQuery).toContain("poolId: { _eq: $poolId }");
    expect(variables).toMatchObject({ state: "READY_FOR_CONFIRMATION" });
    const [rosterQuery, rosterVariables] = mocks.query.mock.calls[1] as [
      string,
      Record<string, unknown>,
    ];
    expect(rosterQuery).toContain("active: { _eq: true }");
    expect(rosterVariables).toMatchObject({ ids: ["42161-9", "42161-10"] });
    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.activeContributors).toEqual([CONTRIBUTOR, CLAIMANT]);
    expect(candidates[1]?.activeContributors).toEqual([]);
  });
});

describe("useProtocolPool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads the protocol pool id and root garden from the module", async () => {
    mocks.readContract.mockImplementation(async (_config, call: { functionName: string }) =>
      call.functionName === "protocolPoolId" ? 1n : ROOT_GARDEN
    );

    const { result } = renderHookWithProviders(() => useProtocolPool({ chainId: 42161 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.poolId).toBe(1n);
    expect(result.current.rootGarden).toBe(ROOT_GARDEN.toLowerCase());
    expect(result.current.isRegistered).toBe(true);
    expect(mocks.readContract).toHaveBeenCalledWith(
      { mocked: true },
      expect.objectContaining({ functionName: "protocolPoolId", chainId: 42161 })
    );
    expect(mocks.readContract).toHaveBeenCalledWith(
      { mocked: true },
      expect.objectContaining({ functionName: "rootGarden", chainId: 42161 })
    );
  });

  it("reports an unregistered protocol pool as exactly that", async () => {
    mocks.readContract.mockImplementation(async (_config, call: { functionName: string }) =>
      call.functionName === "protocolPoolId" ? 0n : ROOT_GARDEN
    );

    const { result } = renderHookWithProviders(() => useProtocolPool({ chainId: 42161 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.poolId).toBeNull();
    expect(result.current.isRegistered).toBe(false);
  });

  it("does not read while pooling is unavailable on the chain", () => {
    mocks.capability = undefined;

    const { result } = renderHookWithProviders(() => useProtocolPool({ chainId: 42161 }));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRegistered).toBe(false);
    expect(mocks.readContract).not.toHaveBeenCalled();
    mocks.capability = {
      deployment: "deployed",
      activation: "active",
      integration: "integrated",
      availability: "available",
      evidence: [],
      verified_at: "2026-08-16",
    };
  });
});

describe("usePoolClaimRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads under its own registry key and exposes the joined rows", async () => {
    mocks.query
      .mockResolvedValueOnce({ data: { Commitment: [commitmentRow()] } })
      .mockResolvedValueOnce({ data: { CommitmentClaimRequest: [claimRow()] } });

    const { result } = renderHookWithProviders(() =>
      usePoolClaimRequests({ chainId: 42161, poolId: 7n, state: "PENDING" })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]?.claim.claimant).toBe(CLAIMANT);
    expect(queryKeys.commitmentPooling.poolClaims(42161, 7n, "PENDING")).toEqual([
      "greengoods",
      "commitment-pooling",
      42161,
      "pool-claims",
      "7",
      "PENDING",
    ]);
  });
});
