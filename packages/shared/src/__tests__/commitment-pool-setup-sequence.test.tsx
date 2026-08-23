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
import { useCommitmentPoolSetupSequence } from "../hooks/commitment-pooling/useCommitmentPoolSetupSequence";
import {
  campaignSteps,
  firstRunSetupSteps,
  isRetriablePoolSetupFailure,
  openSeasonSteps,
  type PoolChainReader,
  type PoolSetupStep,
} from "../modules/commitment-pooling/pool-setup";
import { createTestQueryClient, renderHookWithProviders } from "./test-utils";

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
  parseContractError: (error: unknown) => ({
    name: String(error instanceof Error ? error.message : error)
      .toLowerCase()
      .includes("user rejected")
      ? "UserRejected"
      : "MockContractError",
  }),
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
  steward: 1000,
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
type FakeCycle = {
  state: number;
  allocation?: typeof MODEL_ONE;
  recognitionPolicy?: typeof RECOGNITION;
};

/** A cycle that has not opened carries zeroed snapshots, as the struct does. */
const NO_ALLOCATION = {
  gardeners: 0,
  treasury: 0,
  steward: 0,
  evaluator: 0,
  community: 0,
  funder: 0,
};
const NO_RECOGNITION = { equalParticipationBps: 0, verifiedContributionBps: 0 };

function fakeChain(initial: {
  poolState: number;
  charterCID?: string;
  cap?: bigint;
  cycles?: Record<string, FakeCycle>;
}) {
  const chain = {
    poolState: initial.poolState,
    charterCID: initial.charterCID ?? "",
    cap: initial.cap ?? 0n,
    cycles: new Map<string, FakeCycle>(Object.entries(initial.cycles ?? {})),
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
      return {
        state: cycle?.state ?? 0,
        poolId: POOL_ID,
        allocation: cycle?.allocation ?? NO_ALLOCATION,
        recognitionPolicy: cycle?.recognitionPolicy ?? NO_RECOGNITION,
      };
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
        // The contract snapshots both structs here and never lets them move.
        chain.cycles.set(String(call.args[0]), {
          state: CYCLE.OPEN,
          allocation: call.args[1] as typeof MODEL_ONE,
          recognitionPolicy: call.args[2] as typeof RECOGNITION,
        });
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

const CAMPAIGN_PLAN = campaignSteps({
  poolId: POOL_ID,
  cycle: { ...SEASON, cycleType: "CAMPAIGN", metadataCID: "bafy-campaign" },
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

  it("refuses an open cycle whose stored terms are not the ones this run planned", async () => {
    // Another steward opened the same seeded season on a different split while
    // this flow was up. Both snapshots are fixed at open, so reading OPEN is
    // not this step landing: the planned terms were never stored and never can be.
    const other = fakeChain({
      poolState: POOL.OPEN,
      cycles: {
        "13": {
          state: CYCLE.OPEN,
          allocation: { ...MODEL_ONE, gardeners: 5000, treasury: 2500 },
          recognitionPolicy: RECOGNITION,
        },
      },
    });
    mocks.sender.sendContractCall.mockImplementation(async (call) => other.apply(call));
    const { result } = renderSequence(other.reader);

    await act(async () => {
      await result.current.run(
        openSeasonSteps({
          poolId: POOL_ID,
          cycleId: 13n,
          allocation: MODEL_ONE,
          recognitionPolicy: RECOGNITION,
        })
      );
    });

    expect(result.current.state.status).toBe("failed");
    expect(result.current.state.failedStep).toBe("openCycle");
    expect(result.current.state.failure).toBe("cycle-terms-mismatch");
    // The pool was open already, so that step is landed; nothing was sent, and
    // no retry is offered because no repeat can rewrite an opened cycle.
    expect(result.current.state.landed).toEqual(["openPool"]);
    expect(mocks.sender.sendContractCall).not.toHaveBeenCalled();
    expect(isRetriablePoolSetupFailure(result.current.state.failure)).toBe(false);

    // The recognition policy is half of the snapshot and refuses on its own.
    const policy = fakeChain({
      poolState: POOL.OPEN,
      cycles: {
        "14": {
          state: CYCLE.OPEN,
          allocation: MODEL_ONE,
          recognitionPolicy: { equalParticipationBps: 2000, verifiedContributionBps: 8000 },
        },
      },
    });
    const second = renderSequence(policy.reader);
    await act(async () => {
      await second.result.current.run(
        openSeasonSteps({
          poolId: POOL_ID,
          cycleId: 14n,
          allocation: MODEL_ONE,
          recognitionPolicy: RECOGNITION,
        })
      );
    });
    expect(second.result.current.state.failure).toBe("cycle-terms-mismatch");
  });

  it("still reports an open cycle landed when it carries exactly the planned terms", async () => {
    // The other half of the guard: a cycle this run already opened, judged
    // again on a retry, must not be refused as somebody else's.
    const { reader, apply } = fakeChain({
      poolState: POOL.OPEN,
      cycles: {
        "13": { state: CYCLE.OPEN, allocation: MODEL_ONE, recognitionPolicy: RECOGNITION },
      },
    });
    mocks.sender.sendContractCall.mockImplementation(async (call) => apply(call));
    const { result } = renderSequence(reader);

    await act(async () => {
      await result.current.run(
        openSeasonSteps({
          poolId: POOL_ID,
          cycleId: 13n,
          allocation: MODEL_ONE,
          recognitionPolicy: RECOGNITION,
        })
      );
    });

    expect(result.current.state.status).toBe("complete");
    expect(result.current.state.landed).toEqual(["openPool", "openCycle"]);
    expect(mocks.sender.sendContractCall).not.toHaveBeenCalled();
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

  it("stops with a retriable read failure when a chain read throws, and keeps what landed", async () => {
    const { reader, apply } = fakeChain({ poolState: POOL.NOT_READY });
    mocks.sender.sendContractCall.mockImplementation(async (call) => apply(call));
    let poolReads = 0;
    const flaky: PoolChainReader = {
      ...reader,
      readPool: async (poolId) => {
        poolReads += 1;
        // The charter and the cap are on chain; the read before markPoolReady
        // is the one that cannot reach the node.
        if (poolReads === 3) throw new Error("HTTP request failed");
        return reader.readPool(poolId);
      },
    };
    const { result } = renderSequence(flaky);

    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined;
    await act(async () => {
      // The regression this guards: the throw used to escape `run`, leaving the
      // sequence stuck on "running" with the console unable to close.
      outcome = await result.current.run(FIRST_RUN);
    });

    expect(outcome?.status).toBe("failed");
    expect(outcome?.failure).toBe("read-failed");
    expect(outcome?.landed).toEqual(["setPoolCharter", "setProviderOpenCommitmentCap"]);
    expect(result.current.state.status).toBe("failed");
    expect(result.current.state.failedStep).toBe("markPoolReady");
    expect(isRetriablePoolSetupFailure(result.current.state.failure)).toBe(true);

    mocks.sender.sendContractCall.mockClear();
    await act(async () => {
      await result.current.retry();
    });

    // The reader answers again, so the run resumes at the step it stopped on.
    expect(sentFunctions()).toEqual(["markPoolReady", "seedCycle", "openPool", "openCycle"]);
    expect(result.current.state.status).toBe("complete");
  });

  it("does not seed a second cycle after a seed whose outcome it never learned", async () => {
    const { reader, apply, chain } = fakeChain({
      poolState: POOL.OPEN,
      cycles: { "12": { state: CYCLE.OPEN } },
    });
    mocks.sender.sendContractCall.mockImplementation(async (call) => {
      if (call.functionName === "seedCycle") {
        // Mined, then the wallet gave up waiting for the receipt: the campaign
        // exists on chain but this run never learned its id.
        apply(call);
        throw new Error("Timed out waiting for the receipt");
      }
      return apply(call);
    });
    const { result } = renderSequence(reader);

    await act(async () => {
      await result.current.run(CAMPAIGN_PLAN);
    });

    expect(result.current.state.status).toBe("failed");
    expect(result.current.state.failure).toBe("seed-unconfirmed");
    expect(result.current.state.failedStep).toBe("seedCycle");
    // Not retriable: the console offers no "try again" that would seed twice.
    expect(isRetriablePoolSetupFailure(result.current.state.failure)).toBe(false);
    expect(chain.cycles.size).toBe(2);

    mocks.sender.sendContractCall.mockClear();
    await act(async () => {
      await result.current.retry();
    });

    expect(mocks.sender.sendContractCall).not.toHaveBeenCalled();
    expect(result.current.state.failure).toBe("seed-unconfirmed");
    // Still one orphan beside the open season, never two.
    expect(chain.cycles.size).toBe(2);
  });

  it("fails closed the same way when the seeding receipt cannot be read", async () => {
    const { reader, apply, chain } = fakeChain({
      poolState: POOL.OPEN,
      cycles: { "12": { state: CYCLE.OPEN } },
    });
    mocks.sender.sendContractCall.mockImplementation(async (call) => apply(call));
    const noReceipt: PoolChainReader = {
      ...reader,
      readSeededCycleId: async () => {
        throw new Error("Transaction receipt not found");
      },
    };
    const { result } = renderSequence(noReceipt);

    await act(async () => {
      await result.current.run(CAMPAIGN_PLAN);
    });

    expect(result.current.state.failure).toBe("seed-unconfirmed");
    expect(sentFunctions()).toEqual(["seedCycle"]);

    mocks.sender.sendContractCall.mockClear();
    await act(async () => {
      await result.current.retry();
    });
    expect(mocks.sender.sendContractCall).not.toHaveBeenCalled();
    expect(chain.cycles.size).toBe(2);
  });

  it("still seeds again when the wallet reports the steward refused the seed", async () => {
    const { reader, apply } = fakeChain({
      poolState: POOL.OPEN,
      cycles: { "12": { state: CYCLE.OPEN } },
    });
    let refused = false;
    mocks.sender.sendContractCall.mockImplementation(async (call) => {
      if (call.functionName === "seedCycle" && !refused) {
        refused = true;
        // Nothing was signed, so there is no cycle to orphan.
        throw new Error("User rejected the request");
      }
      return apply(call);
    });
    const { result } = renderSequence(reader);

    await act(async () => {
      await result.current.run(CAMPAIGN_PLAN);
    });
    expect(result.current.state.failure).toBe("send-failed");
    expect(isRetriablePoolSetupFailure(result.current.state.failure)).toBe(true);

    mocks.sender.sendContractCall.mockClear();
    await act(async () => {
      await result.current.retry();
    });
    expect(sentFunctions()).toEqual(["seedCycle", "openCycle"]);
    expect(result.current.state.status).toBe("complete");
  });

  it("refuses to run while demo pooling stands in for the ledger", async () => {
    // The reads are fixtures there but the sender is real, so a fixture pool id
    // must never reach the deployed module.
    window.sessionStorage.setItem("greengoods_dev_mock_pooling", "1");
    const { reader } = fakeChain({ poolState: POOL.NOT_READY });
    const { result } = renderSequence(reader);

    try {
      await act(async () => {
        await result.current.run(FIRST_RUN);
      });

      expect(result.current.state.status).toBe("failed");
      expect(result.current.state.failure).toBe("unavailable");
      expect(mocks.sender.sendContractCall).not.toHaveBeenCalled();
    } finally {
      window.sessionStorage.clear();
    }
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
