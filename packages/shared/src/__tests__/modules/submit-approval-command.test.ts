import { describe, expect, it, vi } from "vitest";
import {
  type BatchApprovalItem,
  submitApproval,
  submitBatchApprovals,
  type SubmitApprovalCommand,
  type SubmitApprovalPorts,
} from "../../modules/work/submit-approval-command";
import {
  createMockTransactionSender,
  createMockWork,
  createMockWorkApprovalDraft,
  MOCK_ADDRESSES,
  MOCK_TX_HASH,
} from "../test-utils";

const OFFLINE_HASH = "0xoffline_job-1" as `0x${string}`;

function command(overrides: Partial<SubmitApprovalCommand> = {}): SubmitApprovalCommand {
  return {
    authMode: "wallet",
    draft: createMockWorkApprovalDraft(),
    work: createMockWork(),
    chainId: 11155111,
    userAddress: MOCK_ADDRESSES.user,
    ...overrides,
  };
}

function ports(overrides: Partial<SubmitApprovalPorts> = {}): SubmitApprovalPorts {
  return {
    connectivity: { isOnline: () => true },
    direct: vi.fn().mockResolvedValue({ hash: MOCK_TX_HASH, confirmed: true }),
    queue: {
      enqueue: vi.fn().mockResolvedValue({ txHash: OFFLINE_HASH, jobId: "job-1" }),
      process: vi.fn().mockResolvedValue({ success: true, txHash: MOCK_TX_HASH }),
    },
    sender: createMockTransactionSender(),
    ...overrides,
  };
}

describe("submitApproval", () => {
  it("routes wallet approval through the direct port", async () => {
    const dependencies = ports();

    await expect(submitApproval(command(), dependencies)).resolves.toEqual({
      hash: MOCK_TX_HASH,
      confirmed: true,
      kind: "direct",
    });
    expect(dependencies.direct).toHaveBeenCalledOnce();
    expect(dependencies.queue.enqueue).not.toHaveBeenCalled();
  });

  it("queues and processes sponsored approval through injected ports", async () => {
    const dependencies = ports();

    await expect(submitApproval(command({ authMode: "passkey" }), dependencies)).resolves.toEqual({
      hash: MOCK_TX_HASH,
      kind: "processed",
    });
    expect(dependencies.queue.enqueue).toHaveBeenCalledOnce();
    expect(dependencies.queue.process).toHaveBeenCalledWith("job-1", dependencies.sender);
  });

  it("returns the durable queue result while offline", async () => {
    const dependencies = ports({ connectivity: { isOnline: () => false } });

    await expect(submitApproval(command({ authMode: "passkey" }), dependencies)).resolves.toEqual({
      hash: OFFLINE_HASH,
      kind: "queued",
    });
    expect(dependencies.queue.process).not.toHaveBeenCalled();
  });

  it("rejects terminal work before calling a port", async () => {
    const dependencies = ports();

    await expect(
      submitApproval(command({ work: createMockWork({ status: "approved" }) }), dependencies)
    ).rejects.toThrow("already been approved");
    expect(dependencies.direct).not.toHaveBeenCalled();
  });
});

describe("submitBatchApprovals", () => {
  const items: BatchApprovalItem[] = [
    { draft: createMockWorkApprovalDraft(), work: createMockWork() },
  ];

  it("routes wallet and sponsored batches through separate ports", async () => {
    const direct = vi.fn().mockResolvedValue(MOCK_TX_HASH);
    const sponsored = vi.fn().mockResolvedValue(MOCK_TX_HASH);

    await expect(
      submitBatchApprovals({ authMode: "wallet", items, chainId: 11155111 }, { direct, sponsored })
    ).resolves.toEqual({ hash: MOCK_TX_HASH, count: 1 });
    await expect(
      submitBatchApprovals({ authMode: "passkey", items, chainId: 11155111 }, { direct, sponsored })
    ).resolves.toEqual({ hash: MOCK_TX_HASH, count: 1 });

    expect(direct).toHaveBeenCalledOnce();
    expect(sponsored).toHaveBeenCalledOnce();
  });
});
