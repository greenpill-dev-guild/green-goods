/** @vitest-environment node */
import { describe, it, expect, vi } from "vitest";
import type { SmartAccountClient } from "permissionless";
import { PasskeySender } from "../passkey-sender";
import type { ContractCall } from "../types";
const operation = `0x${"cd".repeat(32)}` as const;
const transaction = `0x${"ab".repeat(32)}` as const;
const call: ContractCall = {
  address: "0x1111111111111111111111111111111111111111",
  abi: [
    { type: "function", name: "doWork", stateMutability: "nonpayable", inputs: [], outputs: [] },
  ],
  functionName: "doWork",
  args: [],
};
function fixture(success: boolean) {
  const client = {
    account: { address: "0x2222222222222222222222222222222222222222" },
    chain: { id: 11155111 },
    sendTransaction: vi.fn().mockResolvedValue(transaction),
    sendUserOperation: vi.fn().mockResolvedValue(operation),
    waitForUserOperationReceipt: vi
      .fn()
      .mockResolvedValue({ success, receipt: { status: "success", transactionHash: transaction } }),
  };
  return {
    client,
    sender: new PasskeySender(client as unknown as SmartAccountClient, {
      assertWriteSafety: async () => {},
    }),
  };
}
describe("Passkey execution confirmation", () => {
  it("retains failure when the enclosing transaction succeeded", async () => {
    const { sender } = fixture(false);
    await expect(sender.sendContractCall(call)).rejects.toThrow();
  });
  it("persists the operation before waiting and reserves hash callbacks for transactions", async () => {
    const { client, sender } = fixture(true);
    const broadcast = vi.fn();
    const onBroadcastReference = vi.fn(async () => {
      expect(client.waitForUserOperationReceipt).not.toHaveBeenCalled();
    });
    const result = await sender.sendContractCall(call, {
      onBroadcast: broadcast,
      onBroadcastReference,
    } as Parameters<PasskeySender["sendContractCall"]>[1]);
    expect(onBroadcastReference).toHaveBeenCalledWith({ kind: "user-operation", hash: operation });
    expect(broadcast).toHaveBeenCalledWith(transaction);
    expect(result.hash).toBe(transaction);
  });
  it("does not wait for a receipt when saving the operation fails", async () => {
    const { client, sender } = fixture(true);
    await expect(
      sender.sendContractCall(call, {
        onBroadcastReference: async () => {
          throw new Error("quota");
        },
      } as Parameters<PasskeySender["sendContractCall"]>[1])
    ).rejects.toThrow("quota");
    expect(client.waitForUserOperationReceipt).not.toHaveBeenCalled();
  });
});
