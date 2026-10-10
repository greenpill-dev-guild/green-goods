/**
 * The setup sequence judges what landed from the module, not from memory.
 * This is the reader it judges through: `getPool`, `getCycle`, the register's
 * cap, and the `CycleSeeded` log of the seeding receipt, which is the only
 * place a freshly seeded cycle's id exists before the indexer catches up.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeAbiParameters, encodeEventTopics, type Hex } from "viem";

const mocks = vi.hoisted(() => ({
  readContract: vi.fn(),
  getTransactionReceipt: vi.fn(),
}));

vi.mock("@wagmi/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@wagmi/core")>()),
  readContract: mocks.readContract,
  getTransactionReceipt: mocks.getTransactionReceipt,
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
      commitmentRegistry: "0x7bb5b0fd70b6771b0e955fef37f8bd2ce911470b",
    }),
  };
});

const { createPoolChainReader } = await import("../modules/commitment-pooling/pool-chain-reads");
const { CommitmentPoolingModuleABI } = await import("../utils/blockchain/contracts");

const MODULE = "0x6bb5b0fd70b6771b0e955fef37f8bd2ce911470a";
const REGISTRY = "0x7bb5b0fd70b6771b0e955fef37f8bd2ce911470b";

function cycleSeededLog(input: { cycleId: bigint; poolId: bigint; address?: string }) {
  const topics = encodeEventTopics({
    abi: CommitmentPoolingModuleABI,
    eventName: "CycleSeeded",
    args: { cycleId: input.cycleId, poolId: input.poolId },
  });
  const data = encodeAbiParameters(
    [{ type: "uint8" }, { type: "uint64" }, { type: "uint64" }, { type: "string" }],
    [0, 1_755_000_000n, 1_757_000_000n, "bafy-season"]
  );
  return {
    address: input.address ?? MODULE,
    topics,
    data,
    blockNumber: 1n,
    transactionHash: "0xhash" as Hex,
    logIndex: 0,
    blockHash: "0xblock" as Hex,
    transactionIndex: 0,
    removed: false,
  };
}

describe("createPoolChainReader", () => {
  beforeEach(() => {
    mocks.readContract.mockReset();
    mocks.getTransactionReceipt.mockReset();
  });

  it("reads the pool through the module's getPool", async () => {
    mocks.readContract.mockResolvedValue({
      state: 2,
      charterCID: "bafy-charter",
      openSeasonCycleId: 0n,
      nonTerminalCycleCount: 1,
    });

    const pool = await createPoolChainReader(42161).readPool(7n);

    expect(pool).toEqual({
      state: 2,
      charterCID: "bafy-charter",
      openSeasonCycleId: 0n,
      nonTerminalCycleCount: 1,
    });
    expect(mocks.readContract).toHaveBeenCalledWith(
      { mocked: true },
      expect.objectContaining({
        address: MODULE,
        functionName: "getPool",
        args: [7n],
        chainId: 42161,
      })
    );
  });

  it("reads the cap from the register, which owns it", async () => {
    mocks.readContract.mockResolvedValue(24n);

    expect(await createPoolChainReader(42161).readProviderCap(7n)).toBe(24n);
    expect(mocks.readContract).toHaveBeenCalledWith(
      { mocked: true },
      expect.objectContaining({
        address: REGISTRY,
        functionName: "providerOpenCommitmentCapOf",
        args: [7n],
      })
    );
  });

  it("reads the cycle through getCycle, snapshots and all", async () => {
    // An open cycle carries the allocation and recognition policy `openCycle`
    // stored; the sequence compares them before it calls the step landed.
    mocks.readContract.mockResolvedValue({
      state: 2,
      poolId: 7n,
      allocation: {
        gardeners: 6000,
        treasury: 1500,
        operator: 1000,
        evaluator: 500,
        community: 500,
        funder: 500,
      },
      recognitionPolicy: { equalParticipationBps: 2000, verifiedContributionBps: 8000 },
    });

    expect(await createPoolChainReader(42161).readCycle(12n)).toEqual({
      state: 2,
      poolId: 7n,
      allocation: {
        gardeners: 6000,
        treasury: 1500,
        operator: 1000,
        evaluator: 500,
        community: 500,
        funder: 500,
      },
      recognitionPolicy: { equalParticipationBps: 2000, verifiedContributionBps: 8000 },
    });
    expect(mocks.readContract).toHaveBeenCalledWith(
      { mocked: true },
      expect.objectContaining({ address: MODULE, functionName: "getCycle", args: [12n] })
    );
  });

  it("reads a seeded cycle's empty snapshots as zeroes", async () => {
    mocks.readContract.mockResolvedValue({ state: 1, poolId: 7n });

    expect(await createPoolChainReader(42161).readCycle(12n)).toEqual({
      state: 1,
      poolId: 7n,
      allocation: {
        gardeners: 0,
        treasury: 0,
        operator: 0,
        evaluator: 0,
        community: 0,
        funder: 0,
      },
      recognitionPolicy: { equalParticipationBps: 0, verifiedContributionBps: 0 },
    });
  });

  it("finds the seeded cycle id in the receipt's CycleSeeded log for this pool", async () => {
    mocks.getTransactionReceipt.mockResolvedValue({
      logs: [
        // Another module's log with the same shape must not be trusted.
        cycleSeededLog({ cycleId: 99n, poolId: 7n, address: REGISTRY }),
        cycleSeededLog({ cycleId: 40n, poolId: 7n }),
      ],
    });

    expect(await createPoolChainReader(42161).readSeededCycleId("0xhash", 7n)).toBe(40n);
    expect(mocks.getTransactionReceipt).toHaveBeenCalledWith(
      { mocked: true },
      { hash: "0xhash", chainId: 42161 }
    );
  });

  it("returns null when the receipt carries no CycleSeeded for the pool", async () => {
    mocks.getTransactionReceipt.mockResolvedValue({
      logs: [cycleSeededLog({ cycleId: 40n, poolId: 8n })],
    });

    expect(await createPoolChainReader(42161).readSeededCycleId("0xhash", 7n)).toBeNull();
  });
});
