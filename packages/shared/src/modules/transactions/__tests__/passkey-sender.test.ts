/**
 * PasskeySender Tests
 * @vitest-environment jsdom
 *
 * Tests the passkey transaction sender that uses a SmartAccountClient
 * to send UserOperations via a bundler.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { P256Credential } from "viem/account-abstraction";
import {
  createSmartAccountClientResolver,
  invalidateSmartAccountClientResolver,
} from "../../auth/smartAccountClientResolver";
import { arbitrum, celo as celoChain } from "viem/chains";
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
  let client: ReturnType<typeof createFakeSmartAccountClient>;
  let mockSendUserOperation: ReturnType<typeof createFakeSmartAccountClient>["sendUserOperation"];

  beforeEach(() => {
    vi.clearAllMocks();
    client = createFakeSmartAccountClient();
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

describe("passkey chain routing", () => {
  it.each([
    "userOpHash",
    "sender",
  ] as const)("rejects a receipt for a different %s", async (field) => {
    const client = createFakeSmartAccountClient();
    const hash = await client.sendUserOperation({ account: client.account!, calls: [] });
    const receipt = await client.waitForUserOperationReceipt({ hash });
    client.waitForUserOperationReceipt.mockResolvedValue({
      ...receipt,
      [field]: field === "sender" ? VALID_RECIPIENT : `0x${"e".repeat(64)}`,
    });
    await expect(new PasskeySender(client).sendContractCall(TEST_CALL)).rejects.toThrow(
      "UserOperation receipt does not match"
    );
  });

  it("propagates receipt failures without resubmitting", async () => {
    const client = createFakeSmartAccountClient();
    client.waitForUserOperationReceipt.mockRejectedValue(new Error("receipt unavailable"));
    await expect(new PasskeySender(client).sendContractCall(TEST_CALL)).rejects.toThrow(
      "receipt unavailable"
    );
    expect(client.sendUserOperation).toHaveBeenCalledOnce();
  });

  it("stops a sequential batch at a failed UserOperation", async () => {
    const client = createFakeSmartAccountClient();
    const receipt = await client.waitForUserOperationReceipt({ hash: MOCK_TX_HASH });
    client.waitForUserOperationReceipt.mockResolvedValue({ ...receipt, success: false });
    await expect(new PasskeySender(client).sendBatch([TEST_CALL, TEST_CALL])).rejects.toThrow(
      "UserOperation execution reverted"
    );
    expect(client.sendUserOperation).toHaveBeenCalledOnce();
  });

  it("rejects a failed UserOperation inside a successful outer transaction", async () => {
    const client = createFakeSmartAccountClient();
    const receipt = await client.waitForUserOperationReceipt({ hash: MOCK_TX_HASH });
    client.waitForUserOperationReceipt.mockResolvedValue({ ...receipt, success: false });
    await expect(new PasskeySender(client).sendContractCall(TEST_CALL)).rejects.toThrow(
      "UserOperation execution reverted"
    );
  });

  it("rejects a quoted account that differs from the passkey account", async () => {
    const primary = createFakeSmartAccountClient();
    const sender = new PasskeySender(primary);
    await expect(
      sender.sendContractCall({ ...TEST_CALL, account: VALID_RECIPIENT })
    ).rejects.toMatchObject({ code: "address_mismatch" });
    expect(primary.sendUserOperation).not.toHaveBeenCalled();
  });

  it("blocks an in-flight send when sign-out occurs after client resolution", async () => {
    const primary = createFakeSmartAccountClient();
    const resolveSmartAccountClient = createSmartAccountClientResolver({
      credential: {
        id: "session",
        publicKey: "0x1234",
        raw: undefined as unknown as P256Credential["raw"],
      },
      primaryClient: primary,
      primaryChainId: primary.chain!.id,
      expectedAddress: primary.account!.address,
      buildSmartAccount: vi.fn(),
    });
    const pending = new PasskeySender(primary, { resolveSmartAccountClient }).sendContractCall(
      TEST_CALL
    );
    await Promise.resolve();
    await Promise.resolve();
    invalidateSmartAccountClientResolver(resolveSmartAccountClient);
    await expect(pending).rejects.toMatchObject({ code: "session_expired" });
    expect(primary.sendUserOperation).not.toHaveBeenCalled();
  });

  it("resolves explicitly requested Celo without submitting on the primary chain", async () => {
    const primary = createFakeSmartAccountClient();
    const celo = createFakeSmartAccountClient({ chain: celoChain });
    const resolveSmartAccountClient = vi.fn().mockResolvedValue(celo);
    const sender = new PasskeySender(primary, { resolveSmartAccountClient });
    await sender.sendContractCall({ ...TEST_CALL, chainId: 42220 });
    expect(resolveSmartAccountClient).toHaveBeenCalledWith(42220);
    expect(primary.sendUserOperation).not.toHaveBeenCalled();
    expect(celo.sendUserOperation).toHaveBeenCalledWith(
      expect.objectContaining({ account: celo.account, calls: expect.any(Array) })
    );
  });

  it("requires a resolver for every explicit chain, including the primary chain", async () => {
    const primary = createFakeSmartAccountClient();
    const sender = new PasskeySender(primary);
    await expect(
      sender.sendContractCall({ ...TEST_CALL, chainId: primary.chain!.id })
    ).rejects.toMatchObject({ code: "resolver_unavailable" });
    expect(primary.sendUserOperation).not.toHaveBeenCalled();
  });

  it.each([
    ["chain_mismatch", { chain: arbitrum }],
    ["address_mismatch", { chain: celoChain, accountAddress: VALID_RECIPIENT }],
  ])("rejects %s before submission", async (code, overrides) => {
    const primary = createFakeSmartAccountClient();
    const client = createFakeSmartAccountClient(overrides);
    const sender = new PasskeySender(primary, {
      resolveSmartAccountClient: vi.fn().mockResolvedValue(client),
    });
    await expect(sender.sendContractCall({ ...TEST_CALL, chainId: 42220 })).rejects.toMatchObject({
      code,
    });
    expect(primary.sendUserOperation).not.toHaveBeenCalled();
    expect(client.sendUserOperation).not.toHaveBeenCalled();
  });

  it("uses the primary chain for calls without a chain ID", async () => {
    const primary = createFakeSmartAccountClient();
    const resolveSmartAccountClient = vi.fn().mockResolvedValue(primary);
    await new PasskeySender(primary, { resolveSmartAccountClient }).sendContractCall(TEST_CALL);
    expect(resolveSmartAccountClient).toHaveBeenCalledWith(primary.chain!.id);
    expect(primary.sendUserOperation).toHaveBeenCalledOnce();
  });
});
