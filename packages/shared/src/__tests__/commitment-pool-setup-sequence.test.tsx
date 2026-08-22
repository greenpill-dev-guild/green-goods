/** @vitest-environment jsdom */

/**
 * A chain of pool writes needs per-step failure, and the retry must repeat
 * only the unlanded call (uiux-spec C.51). The sequence under test derives
 * what landed from the module, never from what it remembers sending, so a
 * write that was mined but reported as failed is recognised on retry and a
 * write that never went out is the only one sent again.
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  campaignSteps,
  firstRunSetupSteps,
  openSeasonSteps,
  type PoolChainReader,
  type PoolSetupStep,
} from "../modules/commitment-pooling/pool-setup";
import { useCommitmentPoolSetupSequence } from "../hooks/commitment-pooling/useCommitmentPoolSetupSequence";
import { createTestQueryClient, renderHookWithProviders } from "./test-utils";

const MODULE = "0x6bb5b0fd70b6771b0e955fef37f8bd2ce911470a";
const POOL_ID = 7n;

const mocks = vi.hoisted(() => ({
  capability: {
    deployment: "deployed",
    activation: "active",
    integration: "integrated",
    availability: "available",
    evidence: [],
    verified_at: "2026-08-16",
  } as unknown,
  sender: { sendContractCall: vi.fn() },
  mutationErrorHandler: vi.fn(),
}));

vi.mock("../ontology/query", () => ({
  getOntologyChainMaturity: () => mocks.capability,
}));
vi.mock("../hooks/blockchain/useChainConfig", () => ({ useCurrentChain: () => 42161 }));
vi.mock("../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => mocks.sender,
}));
vi.mock("../utils/blockchain/contracts", () => ({
  CommitmentPoolingModuleABI: [],
  CommitmentRegistryABI: [],
  getNetworkContracts: () => ({
    commitmentPoolingModule: "0x6bb5b0fd70b6771b0e955fef37f8bd2ce911470a",
    commitmentRegistry: "0x7bb5b0fd70b6771b0e955fef37f8bd2ce911470b",
  }),
}));
vi.mock("../utils/errors/contract-errors", () => ({
  parseContractError: () => ({ name: "MockContractError" }),
}));
vi.mock("../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => mocks.mutationErrorHandler,
}));

// On-chain enum codes (ICommitmentPoolingModule.sol).
const POOL = { NOT_READY: 1, READY: 2, OPEN: 3, PAUSED: 4 } as const;
const CYCLE = { SEEDED: 1, OPEN: 2 } as const;

const MODEL_ONE = {
  gardeners: 6000,
  treasury: 1500,
  operator: 1000,
  evaluator: 500,
  community: 500,
  funder: 500,
};
const RECOGNITION = { equalParticipationBps: 3500, verifiedContributionBps: 6500 };
const SEASON = {
  cycleType: "SEASON" as const,
  startTime: 1_755_000_000n,
  endTime: 1_757_000_000n,
  metadataCID: "bafy-season",
};

/**
 * A module in memory. Every successful send mutates it the way the contract
 * would, and the reader answers from it, so "what landed" is only ever what
 * the fake chain holds.
 */
function fakeChain(initial: {
  poolState: number;
  charterCID?: string;
  cap?: bigint;
  cycles?: Record<string, { state: number }>;
}) {
  const chain = {
    poolState: initial.poolState,
    charterCID: initial.charterCID ?? "",
    cap: initial.cap ?? 0n,
    cycles: new Map(Object.entries(initial.cycles ?? {})),
    nextCycleId: 40n,
    seededByHash: new Map<string, bigint>(),
    hashes: 0,
  };
  const reader: PoolChainReader = {
    readPool: async () => ({
      state: chain.poolState,
      charterCID: chain.charterCID,
      openSeasonCycleId: 0n,
      nonTerminalCycleCount: [...chain.cycles.values()].filter((cycle) => cycle.state <= 2).length,
    }),
    readProviderCap: async () => chain.cap,
    readCycle: async (cycleId: bigint) => {
      const cycle = chain.cycles.get(cycleId.toString());
      return { state: cycle?.state ?? 0, poolId: POOL_ID };
    },
    readSeededCycleId: async (hash: string) => chain.seededByHash.get(hash) ?? null,
  };
  const apply = (call: { functionName: string; args: readonly unknown[] }) => {
    const hash = `0xhash${++chain.hashes}`;
    switch (call.functionName) {
      case "setPoolCharter":
        chain.charterCID = String(call.args[1]);
        break;
      case "setProviderOpenCommitmentCap":
        chain.cap = call.args[1] as bigint;
        break;
      case "markPoolReady":
        chain.poolState = POOL.READY;
        break;
      case "openPool":
        chain.poolState = POOL.OPEN;
        break;
      case "seedCycle": {
        const cycleId = chain.nextCycleId++;
        chain.cycles.set(cycleId.toString(), { state: CYCLE.SEEDED });
        chain.seededByHash.set(hash, cycleId);
        break;
      }
      case "openCycle":
        chain.cycles.set(String(call.args[0]), { state: CYCLE.OPEN });
        break;
    }
    return { hash, sponsored: false };
  };
  return { chain, reader, apply };
}

function sentFunctions(): string[] {
  return mocks.sender.sendContractCall.mock.calls.map(
    (call) => (call[0] as { functionName: string }).functionName
  );
}

function renderSequence(reader: PoolChainReader) {
  const queryClient = createTestQueryClient();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
  const rendered = renderHookWithProviders(
    () => useCommitmentPoolSetupSequence({ chainId: 42161, reader }),
    { queryClient }
  );
  return { ...rendered, invalidate };
}

const FIRST_RUN: PoolSetupStep[] = firstRunSetupSteps({
  poolId: POOL_ID,
  charterCID: "bafy-charter",
  cap: 24n,
  cycle: SEASON,
  allocation: MODEL_ONE,
  recognitionPolicy: RECOGNITION,
});

describe("useCommitmentPoolSetupSequence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs the six first-run writes in order and reports every step landed", async () => {
    const { reader, apply, chain } = fakeChain({ poolState: POOL.NOT_READY });
    mocks.sender.sendContractCall.mockImplementation(async (call) => apply(call));
    const { result, invalidate } = renderSequence(reader);

    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined;
    await act(async () => {
      outcome = await result.current.run(FIRST_RUN);
    });

    expect(sentFunctions()).toEqual([
      "setPoolCharter",
      "setProviderOpenCommitmentCap",
      "markPoolReady",
      "seedCycle",
      "openPool",
      "openCycle",
    ]);
    // The seeded id came from the chain (the receipt), and openCycle used it.
    const openCycleCall = mocks.sender.sendContractCall.mock.calls[5]?.[0] as {
      args: readonly unknown[];
    };
    expect(openCycleCall.args[0]).toBe(40n);
    expect(outcome?.status).toBe("complete");
    expect(outcome?.cycleId).toBe(40n);
    expect(result.current.state.status).toBe("complete");
    expect(result.current.state.landed).toEqual([
      "setPoolCharter",
      "setProviderOpenCommitmentCap",
      "markPoolReady",
      "seedCycle",
      "openPool",
      "openCycle",
    ]);
    expect(chain.poolState).toBe(POOL.OPEN);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["greengoods", "commitment-pooling", 42161],
    });
  });

  it("stops at the step that failed, names what landed, and the retry sends exactly one call", async () => {
    const { reader, apply } = fakeChain({ poolState: POOL.NOT_READY });
    let calls = 0;
    mocks.sender.sendContractCall.mockImplementation(async (call) => {
      calls += 1;
      // The sixth write reverts: five landed, the season never opened.
      if (calls === 6) throw new Error("execution reverted: InvalidAllocation");
      return apply(call);
    });
    const { result } = renderSequence(reader);

    await act(async () => {
      await result.current.run(FIRST_RUN);
    });

    expect(result.current.state.status).toBe("failed");
    expect(result.current.state.failedStep).toBe("openCycle");
    expect(result.current.state.landed).toEqual([
      "setPoolCharter",
      "setProviderOpenCommitmentCap",
      "markPoolReady",
      "seedCycle",
      "openPool",
    ]);
    expect(result.current.state.cycleId).toBe(40n);
    expect(mocks.mutationErrorHandler).toHaveBeenCalledWith(expect.any(Error), {
      metadata: { action: "openCycle", chainId: 42161, parsedErrorName: "MockContractError" },
    });

    mocks.sender.sendContractCall.mockClear();
    await act(async () => {
      await result.current.retry();
    });

    expect(sentFunctions()).toEqual(["openCycle"]);
    expect(result.current.state.status).toBe("complete");
    expect(result.current.state.landed).toHaveLength(6);
  });

  it("recognises a write that was mined although the send reported failure, and does not send it twice", async () => {
    const { reader, apply } = fakeChain({ poolState: POOL.NOT_READY });
    let calls = 0;
    mocks.sender.sendContractCall.mockImplementation(async (call) => {
      calls += 1;
      if (calls === 3) {
        // markPoolReady lands on chain but the wallet reports a timeout.
        apply(call);
        throw new Error("Timed out waiting for the receipt");
      }
      return apply(call);
    });
    const { result } = renderSequence(reader);

    await act(async () => {
      await result.current.run(FIRST_RUN);
    });
    expect(result.current.state.failedStep).toBe("markPoolReady");
    expect(result.current.state.landed).toEqual(["setPoolCharter", "setProviderOpenCommitmentCap"]);

    mocks.sender.sendContractCall.mockClear();
    await act(async () => {
      await result.current.retry();
    });

    // Ready was already there, so the retry continued from seedCycle.
    expect(sentFunctions()).toEqual(["seedCycle", "openPool", "openCycle"]);
    expect(result.current.state.status).toBe("complete");
  });

  it("opens an existing Seeded season with openPool then openCycle, and only openCycle when the pool is already open", async () => {
    const seeded = fakeChain({ poolState: POOL.READY, cycles: { "12": { state: CYCLE.SEEDED } } });
    mocks.sender.sendContractCall.mockImplementation(async (call) => seeded.apply(call));
    const ready = renderSequence(seeded.reader);
    const plan = openSeasonSteps({
      poolId: POOL_ID,
      cycleId: 12n,
      allocation: MODEL_ONE,
      recognitionPolicy: RECOGNITION,
    });

    await act(async () => {
      await ready.result.current.run(plan);
    });
    expect(sentFunctions()).toEqual(["openPool", "openCycle"]);
    expect(ready.result.current.state.landed).toEqual(["openPool", "openCycle"]);

    mocks.sender.sendContractCall.mockClear();
    const open = fakeChain({ poolState: POOL.OPEN, cycles: { "13": { state: CYCLE.SEEDED } } });
    mocks.sender.sendContractCall.mockImplementation(async (call) => open.apply(call));
    const alreadyOpen = renderSequence(open.reader);

    await act(async () => {
      await alreadyOpen.result.current.run(
        openSeasonSteps({
          poolId: POOL_ID,
          cycleId: 13n,
          allocation: MODEL_ONE,
          recognitionPolicy: RECOGNITION,
        })
      );
    });
    expect(sentFunctions()).toEqual(["openCycle"]);
    // The pool was open before the run; the step is reported landed, not sent.
    expect(alreadyOpen.result.current.state.landed).toEqual(["openPool", "openCycle"]);
  });

  it("seeds and opens a campaign beside the open season", async () => {
    const { reader, apply } = fakeChain({
      poolState: POOL.OPEN,
      cycles: { "12": { state: CYCLE.OPEN } },
    });
    mocks.sender.sendContractCall.mockImplementation(async (call) => apply(call));
    const { result } = renderSequence(reader);

    await act(async () => {
      await result.current.run(
        campaignSteps({
          poolId: POOL_ID,
          cycle: { ...SEASON, cycleType: "CAMPAIGN", metadataCID: "bafy-campaign" },
          allocation: MODEL_ONE,
          recognitionPolicy: RECOGNITION,
        })
      );
    });

    expect(sentFunctions()).toEqual(["seedCycle", "openCycle"]);
    expect(result.current.state.cycleId).toBe(40n);
    expect(result.current.state.status).toBe("complete");
  });

  it("refuses a first-run seed when the pool already holds a live cycle, without sending", async () => {
    const { reader, apply } = fakeChain({
      poolState: POOL.READY,
      charterCID: "bafy-charter",
      cap: 24n,
      cycles: { "12": { state: CYCLE.SEEDED } },
    });
    mocks.sender.sendContractCall.mockImplementation(async (call) => apply(call));
    const { result } = renderSequence(reader);

    await act(async () => {
      await result.current.run(FIRST_RUN);
    });

    expect(result.current.state.status).toBe("failed");
    expect(result.current.state.failedStep).toBe("seedCycle");
    expect(result.current.state.failure).toBe("existing-cycle");
    // Charter, cap and ready were already on chain: nothing was re-sent.
    expect(mocks.sender.sendContractCall).not.toHaveBeenCalled();
    expect(result.current.state.landed).toEqual([
      "setPoolCharter",
      "setProviderOpenCommitmentCap",
      "markPoolReady",
    ]);
  });

  it("refuses a split the contract would reject before any write goes out", async () => {
    const { reader, apply } = fakeChain({ poolState: POOL.NOT_READY });
    mocks.sender.sendContractCall.mockImplementation(async (call) => apply(call));
    const { result } = renderSequence(reader);

    await act(async () => {
      await result.current.run(
        firstRunSetupSteps({
          poolId: POOL_ID,
          charterCID: "bafy-charter",
          cap: 24n,
          cycle: SEASON,
          allocation: { ...MODEL_ONE, funder: 400 },
          recognitionPolicy: RECOGNITION,
        })
      );
    });

    expect(result.current.state.status).toBe("failed");
    expect(result.current.state.failure).toBe("invalid-split");
    expect(mocks.sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("refuses to run while Commitment Pooling is unavailable on the chain", async () => {
    mocks.capability = undefined;
    const { reader } = fakeChain({ poolState: POOL.NOT_READY });
    const { result } = renderSequence(reader);

    await act(async () => {
      await result.current.run(FIRST_RUN);
    });

    expect(result.current.state.status).toBe("failed");
    expect(result.current.state.failure).toBe("unavailable");
    expect(mocks.sender.sendContractCall).not.toHaveBeenCalled();
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
