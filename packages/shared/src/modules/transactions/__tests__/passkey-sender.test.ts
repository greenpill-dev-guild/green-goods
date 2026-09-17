/**
 * PasskeySender Tests
 * @vitest-environment jsdom
 *
 * Tests the passkey transaction sender that uses a SmartAccountClient
 * to send UserOperations via a bundler.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { entryPoint07Address, getUserOperationHash } from "viem/account-abstraction";
import { sepolia } from "viem/chains";
import {
  createFakeSmartAccountClient,
  createMockContractCall,
  MOCK_TX_HASH,
} from "@green-goods/shared/testing";
import { fakePreparedUserOperation } from "../../../__tests__/test-utils/transaction-fakes";
import type { ContractCall } from "../types";

// ============================================
// Import after mocks
// ============================================

import { PasskeySender } from "../passkey-sender";

// ============================================
// Test fixtures
// ============================================

const VALID_RECIPIENT = "0x1111111111111111111111111111111111111111" as const;
const TEST_CALL = createMockContractCall({ chainId: undefined });

// ============================================
// Tests
// ============================================

describe("PasskeySender", () => {
  let sender: PasskeySender;
  let mockSendUserOperation: ReturnType<typeof createFakeSmartAccountClient>["sendUserOperation"];

  beforeEach(() => {
    vi.clearAllMocks();
    const client = createFakeSmartAccountClient();
    mockSendUserOperation = client.sendUserOperation;
    sender = new PasskeySender(client);
  });

  describe("properties", () => {
    it("reports supportsSponsorship as true", () => {
      expect(sender.supportsSponsorship).toBe(true);
    });

    it("reports supportsBatching as false", () => {
      expect(sender.supportsBatching).toBe(false);
    });

    it("reports authMode as passkey", () => {
      expect(sender.authMode).toBe("passkey");
    });
  });

  describe("sendContractCall", () => {
    it("sends transaction via smartAccountClient.sendUserOperation", async () => {
      const result = await sender.sendContractCall(TEST_CALL);

      expect(result.hash).toBe(MOCK_TX_HASH);
      expect(result.sponsored).toBe(true);
      expect(mockSendUserOperation).toHaveBeenCalledOnce();
    });

    it("encodes function data and passes correct parameters", async () => {
      await sender.sendContractCall(TEST_CALL);

      const sendTxArgs = (
        mockSendUserOperation.mock.calls[0][0] as {
          calls: Array<{ to: string; value: bigint; data: string }>;
        }
      ).calls[0] as {
        to: string;
        value: bigint;
        data: string;
      };
      expect(sendTxArgs.to).toBe(TEST_CALL.address);
      expect(sendTxArgs.value).toBe(0n);
      // data should be hex-encoded calldata
      expect(sendTxArgs.data).toMatch(/^0x/);
    });

    it("passes value when specified in call", async () => {
      const callWithValue: ContractCall = {
        ...TEST_CALL,
        value: 1000000n,
      };
      await sender.sendContractCall(callWithValue);

      const sendTxArgs = (
        mockSendUserOperation.mock.calls[0][0] as {
          calls: Array<{ to: string; value: bigint; data: string }>;
        }
      ).calls[0] as { value: bigint };
      expect(sendTxArgs.value).toBe(1000000n);
    });

    it("reports the signed operation's hash just before broadcasting it", async () => {
      const client = createFakeSmartAccountClient();
      const trace: string[] = [];
      vi.mocked(client.account!.signUserOperation).mockImplementation(async () => {
        trace.push("sign");
        return "0x5555" as `0x${string}`;
      });
      const onBeforeBroadcast = vi.fn(async () => {
        trace.push("intent");
      });
      const onBroadcastReference = vi.fn(async () => {
        trace.push("broadcast");
      });

      await new PasskeySender(client).sendContractCall(TEST_CALL, {
        onBeforeBroadcast,
        onBroadcastReference,
      });

      expect(trace).toEqual(["sign", "intent", "broadcast"]);
      expect(onBeforeBroadcast).toHaveBeenCalledWith({
        kind: "user-operation",
        hash: getUserOperationHash({
          chainId: sepolia.id,
          entryPointAddress: entryPoint07Address,
          entryPointVersion: "0.7",
          userOperation: fakePreparedUserOperation(client.account!.address),
        }),
      });
    });

    it("never reports a send when the passkey prompt is declined", async () => {
      const client = createFakeSmartAccountClient();
      const declined = new DOMException(
        "The operation either timed out or was not allowed.",
        "NotAllowedError"
      );
      vi.mocked(client.account!.signUserOperation).mockRejectedValue(declined);
      const onBeforeBroadcast = vi.fn();
      const onBroadcastReference = vi.fn();

      await expect(
        new PasskeySender(client).sendContractCall(TEST_CALL, {
          onBeforeBroadcast,
          onBroadcastReference,
        })
      ).rejects.toBe(declined);
      expect(onBeforeBroadcast).not.toHaveBeenCalled();
      expect(onBroadcastReference).not.toHaveBeenCalled();
    });

    it("propagates errors from sendUserOperation", async () => {
      mockSendUserOperation.mockRejectedValueOnce(new Error("UserOp failed"));

      await expect(sender.sendContractCall(TEST_CALL)).rejects.toThrow("UserOp failed");
    });
  });

  describe("sendBatch", () => {
    it("sends multiple calls sequentially and returns the last hash", async () => {
      const hash1 = `0x${"a".repeat(64)}` as `0x${string}`;
      const hash2 = `0x${"b".repeat(64)}` as `0x${string}`;
      mockSendUserOperation.mockResolvedValueOnce(hash1).mockResolvedValueOnce(hash2);

      const calls: ContractCall[] = [TEST_CALL, { ...TEST_CALL, args: [VALID_RECIPIENT, 2000n] }];
      const result = await sender.sendBatch(calls);

      expect(result.hash).toBe(hash2);
      expect(result.sponsored).toBe(true);
      expect(mockSendUserOperation).toHaveBeenCalledTimes(2);
    });

    it("throws on empty batch", async () => {
      await expect(sender.sendBatch([])).rejects.toThrow("Cannot send empty batch");
    });
  });
});
