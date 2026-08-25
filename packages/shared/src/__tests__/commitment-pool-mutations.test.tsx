/** @vitest-environment jsdom */

import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "../config/query-keys";
import {
  type CommitmentPoolMutationInput,
  useCommitmentPoolMutation,
} from "../hooks/commitment-pooling/useCommitmentPoolMutations";
import { createTestQueryClient, renderHookWithProviders } from "./test-utils";

const MODULE = "0x6bb5b0fd70b6771b0e955fef37f8bd2ce911470a";

const mocks = await vi.hoisted(async () => ({
  capability: {
    deployment: "deployed",
    activation: "active",
    integration: "integrated",
    availability: "available",
    evidence: [],
    verified_at: "2026-08-16",
  } as unknown,
  moduleAddress: "0x6bb5b0fd70b6771b0e955fef37f8bd2ce911470a",
  senderAvailable: true,
  sender: (await import("@green-goods/shared/testing")).createMockTransactionSender(),
  mutationErrorHandler: vi.fn(),
  pinCommitmentReason: vi.fn(),
}));

vi.mock("../ontology/query", () => ({
  getOntologyChainMaturity: () => mocks.capability,
}));

vi.mock("../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 42161,
}));

vi.mock("../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => (mocks.senderAvailable ? mocks.sender : undefined),
}));

vi.mock("../utils/blockchain/contracts", () => ({
  CommitmentPoolingModuleABI: [],
  getNetworkContracts: () => ({ commitmentPoolingModule: mocks.moduleAddress }),
}));

vi.mock("../utils/errors/contract-errors", () => ({
  parseContractError: () => ({ name: "MockContractError" }),
}));

vi.mock("../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => mocks.mutationErrorHandler,
}));

vi.mock("../modules/commitment-pooling/reasons", async () => {
  const actual = await vi.importActual<typeof import("../modules/commitment-pooling/reasons")>(
    "../modules/commitment-pooling/reasons"
  );
  return { ...actual, pinCommitmentReason: mocks.pinCommitmentReason };
});

function setAvailable() {
  mocks.capability = {
    deployment: "deployed",
    activation: "active",
    integration: "integrated",
    availability: "available",
    evidence: [],
    verified_at: "2026-08-16",
  };
}

const MODEL_ONE = {
  gardeners: 6000,
  treasury: 1500,
  operator: 1000,
  evaluator: 500,
  community: 500,
  funder: 500,
};
const PROTOCOL_RECOGNITION = { equalParticipationBps: 2000, verifiedContributionBps: 8000 };

describe("useCommitmentPoolMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAvailable();
    mocks.senderAvailable = true;
    mocks.moduleAddress = MODULE;
    mocks.sender.sendContractCall.mockResolvedValue({ hash: "0xabc", sponsored: true });
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  const actions: Array<{ input: CommitmentPoolMutationInput; args: readonly unknown[] }> = [
    {
      input: { action: "setPoolCharter", poolId: 7n, charterCID: "bafy-charter" },
      args: [7n, "bafy-charter"],
    },
    {
      input: { action: "setProviderOpenCommitmentCap", poolId: 7n, cap: 24n },
      args: [7n, 24n],
    },
    { input: { action: "markPoolReady", poolId: 7n }, args: [7n] },
    { input: { action: "openPool", poolId: 7n }, args: [7n] },
    {
      input: { action: "pausePool", poolId: 7n, reasonCID: "bafy-reason" },
      args: [7n, "bafy-reason"],
    },
    { input: { action: "resumePool", poolId: 7n }, args: [7n] },
    { input: { action: "closePool", poolId: 7n }, args: [7n] },
    { input: { action: "compostPool", poolId: 7n }, args: [7n] },
    { input: { action: "reopenPool", poolId: 7n, toOpen: true }, args: [7n, true] },
    {
      input: {
        action: "seedCycle",
        poolId: 7n,
        cycleType: "SEASON",
        startTime: 1_755_000_000n,
        endTime: 1_757_000_000n,
        metadataCID: "bafy-season",
      },
      // CycleType.Season is 0 on chain; the hook encodes the vocabulary word.
      args: [7n, 0, 1_755_000_000n, 1_757_000_000n, "bafy-season"],
    },
    {
      input: {
        action: "seedCycle",
        poolId: 7n,
        cycleType: "CAMPAIGN",
        startTime: 1_755_000_000n,
        endTime: 1_757_000_000n,
        metadataCID: "bafy-campaign",
      },
      args: [7n, 1, 1_755_000_000n, 1_757_000_000n, "bafy-campaign"],
    },
    {
      input: {
        action: "openCycle",
        cycleId: 3n,
        allocation: MODEL_ONE,
        recognitionPolicy: PROTOCOL_RECOGNITION,
      },
      args: [3n, MODEL_ONE, PROTOCOL_RECOGNITION],
    },
    { input: { action: "closeCycle", cycleId: 3n }, args: [3n] },
    { input: { action: "compostCycle", cycleId: 3n }, args: [3n] },
    {
      input: { action: "cancelCycle", cycleId: 3n, reasonCID: "bafy-reason" },
      args: [3n, "bafy-reason"],
    },
  ];

  it("maps every pool and cycle lifecycle action to the exact contract function and arguments", async () => {
    const queryClient = createTestQueryClient();
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const { result } = renderHookWithProviders(
      () => useCommitmentPoolMutation({ chainId: 42161 }),
      { queryClient }
    );

    for (const testCase of actions) {
      await act(async () => {
        await result.current.mutateAsync(testCase.input);
      });
      expect(mocks.sender.sendContractCall).toHaveBeenLastCalledWith({
        address: MODULE,
        abi: [],
        functionName: testCase.input.action,
        args: testCase.args,
        chainId: 42161,
      });
    }
    expect(mocks.sender.sendContractCall).toHaveBeenCalledTimes(actions.length);
  });

  it("invalidates the chain prefix plus the pool or cycle that changed", async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const { result } = renderHookWithProviders(
      () => useCommitmentPoolMutation({ chainId: 42161 }),
      { queryClient }
    );

    await act(async () => {
      await result.current.mutateAsync({ action: "markPoolReady", poolId: 7n });
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.commitmentPooling.all(42161) });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.commitmentPooling.pool(42161, 7n),
    });

    invalidate.mockClear();
    await act(async () => {
      await result.current.mutateAsync({ action: "closeCycle", cycleId: 3n });
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.commitmentPooling.all(42161) });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.commitmentPooling.cycle(42161, 3n),
    });
  });

  it.each([
    {
      name: "missing sender",
      configure: () => {
        mocks.senderAvailable = false;
      },
      message: "Transaction sender is unavailable",
    },
    {
      name: "unavailable capability",
      configure: () => {
        mocks.capability = undefined;
      },
      message: "Commitment Pooling is unavailable on this chain",
    },
    {
      name: "zero module address",
      configure: () => {
        mocks.moduleAddress = "0x0000000000000000000000000000000000000000";
      },
      message: "Commitment Pooling is not deployed on this chain",
    },
    {
      // Demo mode answers every read from fixtures, availability included, but
      // the sender stays real: a lifecycle act composed against a fixture pool
      // id would otherwise reach whichever real pool carries that number.
      name: "demo pooling mode",
      configure: () => {
        window.sessionStorage.setItem("greengoods_dev_mock_pooling", "1");
      },
      message: "Commitment Pooling is in demo mode; this act is not sent",
    },
  ])("fails closed for $name and reports mutation context", async ({ configure, message }) => {
    configure();
    const { result } = renderHookWithProviders(() => useCommitmentPoolMutation({ chainId: 42161 }));
    const request = { action: "openPool", poolId: 7n } as const;

    await act(async () => {
      await expect(result.current.mutateAsync(request)).rejects.toThrow(message);
    });
    expect(mocks.sender.sendContractCall).not.toHaveBeenCalled();
    expect(mocks.mutationErrorHandler).toHaveBeenCalledWith(expect.any(Error), {
      metadata: {
        action: "openPool",
        chainId: 42161,
        parsedErrorName: "MockContractError",
      },
    });
  });

  describe("openCycle refuses a split that the contract would reject", () => {
    it.each([
      {
        name: "allocation under 10000",
        allocation: { ...MODEL_ONE, funder: 400 },
        recognitionPolicy: PROTOCOL_RECOGNITION,
      },
      {
        name: "allocation over 10000",
        allocation: { ...MODEL_ONE, gardeners: 6100 },
        recognitionPolicy: PROTOCOL_RECOGNITION,
      },
      {
        name: "recognition policy not summing to 10000",
        allocation: MODEL_ONE,
        recognitionPolicy: { equalParticipationBps: 3500, verifiedContributionBps: 6000 },
      },
      {
        name: "a non-integer share",
        allocation: { ...MODEL_ONE, gardeners: 5999.5, treasury: 1500.5 },
        recognitionPolicy: PROTOCOL_RECOGNITION,
      },
    ])("$name", async ({ allocation, recognitionPolicy }) => {
      const { result } = renderHookWithProviders(() =>
        useCommitmentPoolMutation({ chainId: 42161 })
      );

      await act(async () => {
        await expect(
          result.current.mutateAsync({
            action: "openCycle",
            cycleId: 3n,
            allocation,
            recognitionPolicy,
          })
        ).rejects.toThrow(/InvalidAllocation/);
      });
      expect(mocks.sender.sendContractCall).not.toHaveBeenCalled();
    });
  });

  describe("reasons are pinned before they are sent", () => {
    it.each([
      {
        input: { action: "pausePool", poolId: 7n, reason: "Flooding on the lower terraces" },
        args: [7n, "bafy-reason"],
      },
      {
        input: { action: "cancelCycle", cycleId: 3n, reason: "Started by mistake" },
        args: [3n, "bafy-reason"],
      },
    ] as const)("pins the $input.action reason and sends the CID, never the text", async ({
      input,
      args,
    }) => {
      mocks.pinCommitmentReason.mockResolvedValue("bafy-reason");
      const { result } = renderHookWithProviders(() =>
        useCommitmentPoolMutation({ chainId: 42161 })
      );

      await act(async () => {
        await result.current.mutateAsync(input as CommitmentPoolMutationInput);
      });

      expect(mocks.pinCommitmentReason).toHaveBeenCalledWith(
        expect.objectContaining({ reason: input.reason, source: input.action })
      );
      expect(mocks.sender.sendContractCall).toHaveBeenLastCalledWith({
        address: MODULE,
        abi: [],
        functionName: input.action,
        args,
        chainId: 42161,
      });
    });

    it("sends nothing when the reason could not be pinned", async () => {
      const { CommitmentReasonPinError } = await import("../modules/commitment-pooling/reasons");
      mocks.pinCommitmentReason.mockRejectedValue(
        new CommitmentReasonPinError(new Error("gateway down"))
      );
      const { result } = renderHookWithProviders(() =>
        useCommitmentPoolMutation({ chainId: 42161 })
      );

      await act(async () => {
        await expect(
          result.current.mutateAsync({ action: "pausePool", poolId: 7n, reason: "Flooding" })
        ).rejects.toBeInstanceOf(CommitmentReasonPinError);
      });
      expect(mocks.sender.sendContractCall).not.toHaveBeenCalled();
    });

    it("still accepts a CID a caller already holds", async () => {
      const { result } = renderHookWithProviders(() =>
        useCommitmentPoolMutation({ chainId: 42161 })
      );

      await act(async () => {
        await result.current.mutateAsync({
          action: "cancelCycle",
          cycleId: 3n,
          reasonCID: "bafy-held",
        });
      });

      expect(mocks.pinCommitmentReason).not.toHaveBeenCalled();
      expect(mocks.sender.sendContractCall).toHaveBeenLastCalledWith(
        expect.objectContaining({ functionName: "cancelCycle", args: [3n, "bafy-held"] })
      );
    });
  });
});
