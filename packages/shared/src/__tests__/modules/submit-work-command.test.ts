/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest";

const defaultAdapters = vi.hoisted(() => ({
  simulate: vi.fn(),
  enqueue: vi.fn(),
  process: vi.fn(),
  direct: vi.fn(),
}));

vi.mock("../../modules/work/simulate", () => ({
  simulateWorkSubmission: defaultAdapters.simulate,
}));
vi.mock("../../modules/work/work-submission", () => ({
  submitWorkToQueue: defaultAdapters.enqueue,
}));
vi.mock("../../modules/job-queue", () => ({
  jobQueue: { processJob: defaultAdapters.process },
}));
vi.mock("../../modules/work/wallet-submission", () => ({
  submitWorkDirectly: defaultAdapters.direct,
}));

import {
  buildOptimisticWork,
  createDefaultSubmitWorkPorts,
  isNetworkError,
  submitWork,
  type SubmitWorkCommand,
  type SubmitWorkPorts,
} from "../../modules/work/submit-work-command";
import { WorkSubmissionError } from "../../modules/work/wallet-submission/types";
import {
  createMockAction,
  createMockWorkDraft,
  MOCK_ADDRESSES,
} from "../test-utils/mock-factories";
import { createMockTransactionSender } from "../test-utils/transaction-fakes";

const DIRECT_HASH = "0x1111" as const;
const QUEUED_HASH = "0xoffline_job-1" as const;
const PROCESSED_HASH = "0x2222" as const;

const baseCommand: SubmitWorkCommand = {
  authMode: "wallet",
  gardenAddress: MOCK_ADDRESSES.garden,
  actionUID: 1,
  actions: [createMockAction({ id: "1", title: "Repair paths" })],
  userAddress: MOCK_ADDRESSES.user,
  chainId: 11155111,
  draft: createMockWorkDraft({ feedback: "Repaired the north path" }),
  images: [],
  allowOfflineQueue: true,
};

type PortOverrides = {
  online?: boolean;
  sender?: SubmitWorkPorts["sender"];
  simulate?: SubmitWorkPorts["simulate"];
  enqueue?: SubmitWorkPorts["queue"]["enqueue"];
  process?: SubmitWorkPorts["queue"]["process"];
  direct?: SubmitWorkPorts["direct"]["submitWork"];
};

function createPorts(overrides: PortOverrides = {}) {
  const simulate = overrides.simulate ?? vi.fn<SubmitWorkPorts["simulate"]>().mockResolvedValue();
  const enqueue =
    overrides.enqueue ??
    vi.fn<SubmitWorkPorts["queue"]["enqueue"]>().mockResolvedValue({
      txHash: QUEUED_HASH,
      jobId: "job-1",
      clientWorkId: "client-work-1",
    });
  const process =
    overrides.process ??
    vi.fn<SubmitWorkPorts["queue"]["process"]>().mockResolvedValue({
      success: true,
      txHash: PROCESSED_HASH,
      skipped: false,
    });
  const direct =
    overrides.direct ??
    vi.fn<SubmitWorkPorts["direct"]["submitWork"]>().mockResolvedValue(DIRECT_HASH);
  const onWalletStage = vi.fn<NonNullable<SubmitWorkPorts["onWalletStage"]>>();
  const onQueueFallback = vi.fn<NonNullable<SubmitWorkPorts["onQueueFallback"]>>();
  const ports: SubmitWorkPorts = {
    connectivity: { isOnline: () => overrides.online ?? true },
    clock: { now: () => 1_756_000_123_456 },
    simulate,
    queue: { enqueue, process },
    direct: { submitWork: direct },
    sender:
      overrides.sender === undefined
        ? createMockTransactionSender({ result: { hash: PROCESSED_HASH, sponsored: true } })
        : overrides.sender,
    onWalletStage,
    onQueueFallback,
  };
  return { ports, simulate, enqueue, process, direct, onWalletStage, onQueueFallback };
}

describe("submitWork", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultAdapters.simulate.mockResolvedValue(undefined);
    defaultAdapters.enqueue.mockResolvedValue({
      txHash: QUEUED_HASH,
      jobId: "job-default",
      clientWorkId: "client-default",
    });
    defaultAdapters.process.mockResolvedValue({ success: true, txHash: PROCESSED_HASH });
    defaultAdapters.direct.mockResolvedValue(DIRECT_HASH);
  });

  it.each([
    ["gardenAddress", null, "Garden must be selected before submitting work"],
    ["actionUID", null, "Action must be selected before submitting work"],
    ["userAddress", null, "User address is required for work submission"],
  ] as const)("validates %s before using any port", async (field, value, message) => {
    const { ports, simulate, enqueue, direct } = createPorts();
    await expect(submitWork({ ...baseCommand, [field]: value }, ports)).rejects.toThrow(message);
    expect(simulate).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect(direct).not.toHaveBeenCalled();
  });

  it("rejects an offline wallet before enqueue when queue fallback is disabled", async () => {
    const { ports, enqueue } = createPorts({ online: false });
    await expect(submitWork({ ...baseCommand, allowOfflineQueue: false }, ports)).rejects.toThrow(
      "Offline queue is disabled for this submission surface"
    );
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("queues an offline wallet without simulation or inline processing", async () => {
    const { ports, simulate, enqueue, process, direct } = createPorts({ online: false });
    const outcome = await submitWork(baseCommand, ports);
    expect(outcome).toMatchObject({ kind: "queued", txHash: QUEUED_HASH });
    expect(simulate).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledOnce();
    expect(process).not.toHaveBeenCalled();
    expect(direct).not.toHaveBeenCalled();
  });

  it("submits an online wallet directly and forwards wallet stages", async () => {
    const direct = vi.fn<SubmitWorkPorts["direct"]["submitWork"]>(async (_input, onStage) => {
      onStage?.("confirming", "Confirm in your wallet...");
      return DIRECT_HASH;
    });
    const { ports, enqueue, onWalletStage } = createPorts({ direct });
    await expect(submitWork(baseCommand, ports)).resolves.toMatchObject({
      kind: "direct",
      txHash: DIRECT_HASH,
    });
    expect(onWalletStage).toHaveBeenCalledWith("confirming", "Confirm in your wallet...");
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("never queues upload-phase failures even when their message looks like a network error", async () => {
    const error = new WorkSubmissionError(
      "Gateway timeout",
      "upload",
      "batch-1",
      new Error("network gateway timeout")
    );
    const { ports, enqueue } = createPorts({
      direct: vi.fn<SubmitWorkPorts["direct"]["submitWork"]>().mockRejectedValue(error),
    });
    await expect(submitWork(baseCommand, ports)).rejects.toBe(error);
    expect(enqueue).not.toHaveBeenCalled();
    expect(isNetworkError(error)).toBe(false);
  });

  it("keeps expired wallet requests on the direct retry path", async () => {
    const error = new WorkSubmissionError(
      "Wallet request expired",
      "transaction",
      "batch-2",
      new Error("request expired")
    );
    const { ports, enqueue } = createPorts({
      direct: vi.fn<SubmitWorkPorts["direct"]["submitWork"]>().mockRejectedValue(error),
    });
    await expect(submitWork(baseCommand, ports)).rejects.toBe(error);
    expect(enqueue).not.toHaveBeenCalled();
    expect(isNetworkError(error)).toBe(false);
  });

  it.each([
    "fetch",
    "timeout",
    "socket",
    "connection",
    "gateway",
  ])("classifies %s failures as queue-eligible connectivity errors", (message) => {
    expect(isNetworkError(new Error(message))).toBe(true);
  });

  it("rejects unrelated non-Error values as connectivity failures", () => {
    expect(isNetworkError("permission denied")).toBe(false);
  });

  it("rethrows an online wallet network error when queue fallback is disabled", async () => {
    const error = new Error("network connection failed");
    const { ports, enqueue, onQueueFallback } = createPorts({
      direct: vi.fn<SubmitWorkPorts["direct"]["submitWork"]>().mockRejectedValue(error),
    });
    await expect(submitWork({ ...baseCommand, allowOfflineQueue: false }, ports)).rejects.toBe(
      error
    );
    expect(enqueue).not.toHaveBeenCalled();
    expect(onQueueFallback).not.toHaveBeenCalled();
  });

  it("publishes one optimistic row before queueing an online wallet network failure", async () => {
    const error = new Error("network connection failed");
    const { ports, enqueue, onQueueFallback } = createPorts({
      direct: vi.fn<SubmitWorkPorts["direct"]["submitWork"]>().mockRejectedValue(error),
    });
    await expect(submitWork(baseCommand, ports)).resolves.toMatchObject({
      kind: "queued",
      txHash: QUEUED_HASH,
    });
    expect(onQueueFallback).toHaveBeenCalledWith(buildOptimisticWork(baseCommand, ports.clock));
    expect(onQueueFallback.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(enqueue).mock.invocationCallOrder[0]!
    );
  });

  it.each([
    "passkey",
    "embedded",
    null,
  ] as const)("rejects %s mode before simulation when queue fallback is disabled", async (authMode) => {
    const { ports, simulate, enqueue } = createPorts();
    await expect(
      submitWork({ ...baseCommand, authMode, allowOfflineQueue: false }, ports)
    ).rejects.toThrow("Offline queue is disabled for this submission surface");
    expect(simulate).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("queues a non-wallet offline submission without simulation or processing", async () => {
    const { ports, simulate, process } = createPorts({ online: false });
    await expect(submitWork({ ...baseCommand, authMode: "passkey" }, ports)).resolves.toMatchObject(
      { kind: "queued", txHash: QUEUED_HASH }
    );
    expect(simulate).not.toHaveBeenCalled();
    expect(process).not.toHaveBeenCalled();
  });

  it("simulates, queues, and returns the inline processed hash for an online sender", async () => {
    const { ports, simulate, enqueue, process } = createPorts();
    await expect(submitWork({ ...baseCommand, authMode: "passkey" }, ports)).resolves.toMatchObject(
      { kind: "processed", txHash: PROCESSED_HASH, sponsored: true }
    );
    expect(simulate).toHaveBeenCalledOnce();
    expect(enqueue).toHaveBeenCalledOnce();
    expect(process).toHaveBeenCalledWith("job-1", ports.sender);
  });

  it("uses the action id fallback when simulation has no action title", async () => {
    const { ports, simulate } = createPorts();
    await submitWork(
      {
        ...baseCommand,
        authMode: "passkey",
        actions: [createMockAction({ id: "1", title: "" })],
      },
      ports
    );
    expect(simulate).toHaveBeenCalledWith(expect.objectContaining({ actionTitle: "Action 1" }));
  });

  it("builds an empty-title optimistic row for a draft without optional text", () => {
    const { ports } = createPorts();
    expect(
      buildOptimisticWork(
        {
          ...baseCommand,
          actions: [createMockAction({ id: "1", title: "" })],
          draft: createMockWorkDraft({ feedback: undefined, details: undefined }),
        },
        ports.clock
      )
    ).toMatchObject({ title: "", feedback: "" });
  });

  it("surfaces an inline processing error that was not skipped", async () => {
    const { ports } = createPorts({
      process: vi.fn<SubmitWorkPorts["queue"]["process"]>().mockResolvedValue({
        success: false,
        error: "relayer unavailable",
        skipped: false,
      }),
    });
    await expect(submitWork({ ...baseCommand, authMode: "embedded" }, ports)).rejects.toThrow(
      "relayer unavailable"
    );
  });

  it("keeps the queued hash when inline processing is skipped", async () => {
    const { ports } = createPorts({
      process: vi.fn<SubmitWorkPorts["queue"]["process"]>().mockResolvedValue({
        success: false,
        error: "offline",
        skipped: true,
      }),
    });
    await expect(submitWork({ ...baseCommand, authMode: null }, ports)).resolves.toMatchObject({
      kind: "queued",
      txHash: QUEUED_HASH,
    });
  });

  it("keeps the queued hash when no inline sender is available", async () => {
    const { ports, process } = createPorts({ sender: null });
    await expect(submitWork({ ...baseCommand, authMode: "passkey" }, ports)).resolves.toMatchObject(
      { kind: "queued", txHash: QUEUED_HASH, sponsored: false }
    );
    expect(process).not.toHaveBeenCalled();
  });

  it("binds the lazy default adapters without changing their call contracts", async () => {
    Object.defineProperty(globalThis.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    const sender = createMockTransactionSender();
    const onWalletStage = vi.fn();
    const onQueueFallback = vi.fn();
    const ports = createDefaultSubmitWorkPorts({ sender, onWalletStage, onQueueFallback });
    const resolved = {
      ...baseCommand,
      gardenAddress: MOCK_ADDRESSES.garden,
      actionUID: 1,
      userAddress: MOCK_ADDRESSES.user,
    };

    expect(ports.connectivity.isOnline()).toBe(false);
    expect(ports.clock.now()).toBeGreaterThan(0);
    expect(ports.sender).toBe(sender);
    expect(ports.onWalletStage).toBe(onWalletStage);
    expect(ports.onQueueFallback).toBe(onQueueFallback);

    await ports.simulate({
      draft: resolved.draft,
      gardenAddress: resolved.gardenAddress,
      actionUID: resolved.actionUID,
      actionTitle: "Repair paths",
      chainId: resolved.chainId,
      images: resolved.images,
      accountAddress: resolved.userAddress,
    });
    await expect(ports.queue.enqueue(resolved)).resolves.toMatchObject({ jobId: "job-default" });
    await expect(ports.queue.process("job-default", sender)).resolves.toMatchObject({
      txHash: PROCESSED_HASH,
    });
    await expect(ports.direct.submitWork(resolved, onWalletStage)).resolves.toBe(DIRECT_HASH);

    expect(defaultAdapters.simulate).toHaveBeenCalledOnce();
    expect(defaultAdapters.enqueue).toHaveBeenCalledWith(
      resolved.draft,
      resolved.gardenAddress,
      resolved.actionUID,
      resolved.actions,
      resolved.chainId,
      resolved.images,
      resolved.userAddress
    );
    expect(defaultAdapters.process).toHaveBeenCalledWith("job-default", {
      transactionSender: sender,
    });
    expect(defaultAdapters.direct).toHaveBeenCalledWith(
      resolved.draft,
      resolved.gardenAddress,
      resolved.actionUID,
      "Repair paths",
      resolved.chainId,
      resolved.images,
      { onProgress: onWalletStage }
    );
  });
});
