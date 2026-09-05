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
import {
  createFakeSmartAccountClient,
  createMockContractCall,
  MOCK_TX_HASH,
} from "@green-goods/shared/testing";
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
  let mockSendTransaction: ReturnType<typeof createFakeSmartAccountClient>["sendTransaction"];

  beforeEach(() => {
    vi.clearAllMocks();
    const client = createFakeSmartAccountClient();
    mockSendTransaction = client.sendTransaction;
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
    it("sends transaction via smartAccountClient.sendTransaction", async () => {
      const result = await sender.sendContractCall(TEST_CALL);

      expect(result.hash).toBe(MOCK_TX_HASH);
      expect(result.sponsored).toBe(true);
      expect(mockSendTransaction).toHaveBeenCalledOnce();
    });

    it("encodes function data and passes correct parameters", async () => {
      await sender.sendContractCall(TEST_CALL);

      const sendTxArgs = mockSendTransaction.mock.calls[0][0] as {
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

      const sendTxArgs = mockSendTransaction.mock.calls[0][0] as { value: bigint };
      expect(sendTxArgs.value).toBe(1000000n);
    });

    it("propagates errors from sendTransaction", async () => {
      mockSendTransaction.mockRejectedValueOnce(new Error("UserOp failed"));

      await expect(sender.sendContractCall(TEST_CALL)).rejects.toThrow("UserOp failed");
    });
  });

  describe("sendBatch", () => {
    it("sends multiple calls sequentially and returns the last hash", async () => {
      const hash1 = `0x${"a".repeat(64)}` as `0x${string}`;
      const hash2 = `0x${"b".repeat(64)}` as `0x${string}`;
      mockSendTransaction.mockResolvedValueOnce(hash1).mockResolvedValueOnce(hash2);

      const calls: ContractCall[] = [TEST_CALL, { ...TEST_CALL, args: [VALID_RECIPIENT, 2000n] }];
      const result = await sender.sendBatch(calls);

      expect(result.hash).toBe(hash2);
      expect(result.sponsored).toBe(true);
      expect(mockSendTransaction).toHaveBeenCalledTimes(2);
    });

    it("throws on empty batch", async () => {
      await expect(sender.sendBatch([])).rejects.toThrow("Cannot send empty batch");
    });
  });
});

describe("passkey chain routing", () => {
  it("rejects a quoted account that differs from the passkey account", async () => {
    const primary = createFakeSmartAccountClient();
    const sender = new PasskeySender(primary);
    await expect(
      sender.sendContractCall({ ...TEST_CALL, account: VALID_RECIPIENT })
    ).rejects.toMatchObject({ code: "address_mismatch" });
    expect(primary.sendTransaction).not.toHaveBeenCalled();
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
    expect(primary.sendTransaction).not.toHaveBeenCalled();
  });

  it("resolves explicitly requested Celo without submitting on the primary chain", async () => {
    const primary = createFakeSmartAccountClient();
    const celo = createFakeSmartAccountClient({ chain: celoChain });
    const resolveSmartAccountClient = vi.fn().mockResolvedValue(celo);
    const sender = new PasskeySender(primary, { resolveSmartAccountClient });
    await sender.sendContractCall({ ...TEST_CALL, chainId: 42220 });
    expect(resolveSmartAccountClient).toHaveBeenCalledWith(42220);
    expect(primary.sendTransaction).not.toHaveBeenCalled();
    expect(celo.sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ chain: celo.chain, account: celo.account })
    );
  });

  it("requires a resolver for every explicit chain, including the primary chain", async () => {
    const primary = createFakeSmartAccountClient();
    const sender = new PasskeySender(primary);
    await expect(
      sender.sendContractCall({ ...TEST_CALL, chainId: primary.chain!.id })
    ).rejects.toMatchObject({ code: "resolver_unavailable" });
    expect(primary.sendTransaction).not.toHaveBeenCalled();
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
    expect(primary.sendTransaction).not.toHaveBeenCalled();
    expect(client.sendTransaction).not.toHaveBeenCalled();
  });

  it("uses the primary chain for calls without a chain ID", async () => {
    const primary = createFakeSmartAccountClient();
    const resolveSmartAccountClient = vi.fn().mockResolvedValue(primary);
    await new PasskeySender(primary, { resolveSmartAccountClient }).sendContractCall(TEST_CALL);
    expect(resolveSmartAccountClient).toHaveBeenCalledWith(primary.chain!.id);
    expect(primary.sendTransaction).toHaveBeenCalledOnce();
  });
});
