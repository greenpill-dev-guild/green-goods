/**
 * useGardenJournal tests: Home's Highlights and Take Part read the garden's own pool the way
 * the garden page and its Pool tab do, so their seasons and promises are the Pool tab's, and
 * a chain without promises reads nothing at all (DL-127, decision 32).
 *
 * @vitest-environment happy-dom
 */

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGardenOpenCycles, useGardenOpenPromises } from "../../../hooks/garden/useGardenJournal";
import type { CommitmentReadModel } from "../../../modules/commitment-pooling/types-core";
import type { Address } from "../../../types/domain";
import {
  availableCapability,
  commitmentFixture,
  cycleFixture,
  poolFixture,
} from "../../test-utils/commitment-pooling-fixtures";
import { renderHookWithProviders } from "../../test-utils/render-helpers";

const READER = "0xa11ce00000000000000000000000000000000001" as Address;
const NEIGHBOUR = "0xb0b0000000000000000000000000000000000002" as Address;
const GARDEN = "0x5000000000000000000000000000000000000001";

const mocks = vi.hoisted(() => ({
  capability: null as unknown,
  getCommitmentPools: vi.fn(),
  getCommitmentCycles: vi.fn(),
  getCommitments: vi.fn(),
}));

// The ontology's chain maturity and the indexer reads are the edges; the pooling hooks, their
// cache keys and the journal's rules run for real.
vi.mock("../../../ontology/query", () => ({
  getOntologyChainMaturity: () => mocks.capability,
}));

vi.mock("../../../modules/commitment-pooling/data", () => ({
  getCommitmentPools: mocks.getCommitmentPools,
  getCommitmentCycles: mocks.getCommitmentCycles,
  getCommitments: mocks.getCommitments,
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => READER,
}));

const gardenPool = poolFixture({ poolId: 7n, garden: GARDEN as Address });

function promise(id: number, overrides: Partial<CommitmentReadModel> = {}): CommitmentReadModel {
  return commitmentFixture({
    id: `42161-${id}`,
    commitmentId: BigInt(id),
    poolId: 7n,
    direction: "OFFER",
    onchainState: "OFFERED",
    derivedState: "OFFERED",
    creator: NEIGHBOUR,
    leadProvider: NEIGHBOUR,
    counterparty: null,
    metadataCID: null,
    ...overrides,
  });
}

describe("useGardenJournal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.capability = availableCapability;
    mocks.getCommitmentPools.mockResolvedValue([gardenPool]);
    mocks.getCommitmentCycles.mockResolvedValue([]);
    mocks.getCommitments.mockResolvedValue([]);
  });

  it("reads the open seasons and campaigns from the garden's own pool, the season first", async () => {
    mocks.getCommitmentCycles.mockResolvedValue([
      cycleFixture({ id: "c-9", cycleId: 9n, cycleType: "CAMPAIGN", poolId: 7n }),
      cycleFixture({ id: "c-8", cycleId: 8n, cycleType: "CAMPAIGN", state: "RECONCILED" }),
      cycleFixture({ id: "c-7", cycleId: 7n, cycleType: "SEASON", poolId: 7n }),
    ]);

    const { result } = renderHookWithProviders(() => useGardenOpenCycles(GARDEN));

    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    const { state } = result.current;
    expect(state.status === "ready" && state.items.map((item) => item.cycle.id)).toEqual([
      "c-7",
      "c-9",
    ]);
    expect(mocks.getCommitmentPools).toHaveBeenCalledWith(42161, GARDEN);
    expect(mocks.getCommitmentCycles).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: 42161, poolId: 7n })
    );
  });

  it("finds no season in a garden without a pool, and reads no cycles for it", async () => {
    mocks.getCommitmentPools.mockResolvedValue([]);

    const { result } = renderHookWithProviders(() => useGardenOpenCycles(GARDEN));

    await waitFor(() => expect(result.current.state.status).toBe("empty"));
    expect(mocks.getCommitmentCycles).not.toHaveBeenCalled();
  });

  it("says a failed cycles read failed, so no season shows as read", async () => {
    mocks.getCommitmentCycles.mockRejectedValueOnce(new Error("indexer down"));

    const { result } = renderHookWithProviders(() => useGardenOpenCycles(GARDEN));

    await waitFor(() => expect(result.current.state.status).toBe("error"));
  });

  it("previews three open promises and keeps the newest ask for the carousel past them", async () => {
    mocks.getCommitments.mockResolvedValue([
      promise(14),
      promise(13, { creator: READER, leadProvider: READER }),
      promise(12),
      promise(11),
      promise(10),
      promise(9, { direction: "REQUEST", onchainState: "REQUESTED", derivedState: "REQUESTED" }),
    ]);

    const { result } = renderHookWithProviders(() => useGardenOpenPromises(GARDEN));

    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    const { state, ask } = result.current;
    expect(
      state.status === "ready" &&
        state.items.map((entry) => entry.kind === "single" && entry.row.commitment.commitmentId)
    ).toEqual([14n, 12n, 11n]);
    expect(ask?.kind === "single" && ask.row.commitment.commitmentId).toBe(9n);
    expect(mocks.getCommitments).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: 42161, poolId: 7n })
    );
  });

  it("lists no promise while the garden's pool is paused", async () => {
    mocks.getCommitmentPools.mockResolvedValue([{ ...gardenPool, state: "PAUSED" }]);
    mocks.getCommitments.mockResolvedValue([
      promise(9, { direction: "REQUEST", onchainState: "REQUESTED", derivedState: "REQUESTED" }),
    ]);

    const { result } = renderHookWithProviders(() => useGardenOpenPromises(GARDEN));

    await waitFor(() => expect(result.current.state.status).toBe("empty"));
    expect(result.current.ask).toBeNull();
  });

  it("reads nothing where promises do not run, and says so rather than none", async () => {
    mocks.capability = { ...availableCapability, availability: "unavailable" };

    const cycles = renderHookWithProviders(() => useGardenOpenCycles(GARDEN));
    const promises = renderHookWithProviders(() => useGardenOpenPromises(GARDEN));

    expect(cycles.result.current.state.status).toBe("unavailable");
    expect(promises.result.current.state.status).toBe("unavailable");
    expect(promises.result.current.ask).toBeNull();
    expect(mocks.getCommitmentPools).not.toHaveBeenCalled();
  });
});
