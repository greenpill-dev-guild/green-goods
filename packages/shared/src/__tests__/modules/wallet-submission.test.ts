/**
 * Tests for wallet submission module
 *
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Must mock before imports
vi.mock("@wagmi/core", () => ({
  getAccount: vi.fn(),
  getBlock: vi.fn(),
  getWalletClient: vi.fn(),
  getPublicClient: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
}));

vi.mock("../../config/appkit", () => ({
  getWagmiConfig: () => ({}),
}));

vi.mock("../../config/blockchain", () => ({
  getEASConfig: () => ({
    EAS_CONTRACT: "0xEASAddress",
    EAS: { address: "0x" + "e".repeat(40) },
    WORK: { uid: "0x" + "1".repeat(64) },
    WORK_APPROVAL: { uid: "0x" + "2".repeat(64) },
  }),
}));

vi.mock("../../config/chains", () => ({
  getChain: (chainId: number) => ({ id: chainId, name: "Test Chain" }),
}));

const mockEnsureWagmiWalletChain = vi.fn();
vi.mock("../../modules/transactions/chain-guard", () => ({
  ensureWagmiWalletChain: (...args: unknown[]) => mockEnsureWagmiWalletChain(...args),
}));

const mockAssertLocalArbitrumForkWallet = vi.fn();
vi.mock("../../modules/transactions/local-fork-safety", () => ({
  assertLocalArbitrumForkWallet: () => mockAssertLocalArbitrumForkWallet(),
}));

vi.mock("../../utils/eas/encoders", () => ({
  encodeWorkData: vi.fn(),
  encodeWorkApprovalData: vi.fn(),
  simulateWorkData: vi.fn(),
}));

vi.mock("../../utils/eas/transaction-builder", () => ({
  buildWorkAttestTx: vi.fn(() => ({
    to: "0xEASAddress" as `0x${string}`,
    data: "0xWorkTxData" as `0x${string}`,
    value: 0n,
  })),
  buildApprovalAttestTx: vi.fn(() => ({
    to: "0xEASAddress" as `0x${string}`,
    data: "0xApprovalTxData" as `0x${string}`,
    value: 0n,
  })),
  buildBatchApprovalAttestTx: vi.fn(() => ({
    to: "0xEASAddress" as `0x${string}`,
    data: "0xBatchApprovalTxData" as `0x${string}`,
    value: 0n,
  })),
}));

vi.mock("../../utils/blockchain/polling", () => ({
  pollQueriesAfterTransaction: vi.fn(),
  TX_RECEIPT_TIMEOUT_MS: 120_000,
}));

vi.mock("../../utils/debug", () => ({
  DEBUG_ENABLED: false,
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

vi.mock("../../config/query-keys", () => ({
  queryKeys: {
    works: {
      all: ["greengoods", "works"],
      mine: (userAddress?: string) => ["greengoods", "works", "mine", userAddress],
      mineByUser: (userAddress: string) => ["greengoods", "works", "mine", userAddress],
      online: (gardenId: string, chainId: number) => [
        "greengoods",
        "works",
        "online",
        gardenId,
        chainId,
      ],
      offline: (gardenId: string) => ["greengoods", "works", "offline", gardenId],
      merged: (gardenId: string, chainId: number) => [
        "greengoods",
        "works",
        "merged",
        gardenId,
        chainId,
      ],
    },
    workApprovals: {
      all: ["greengoods", "workApprovals"],
      byAttester: (address?: string, chainId?: number) => [
        "greengoods",
        "workApprovals",
        "byAttester",
        address,
        chainId,
      ],
      offline: (address?: string) => ["greengoods", "workApprovals", "offline", address],
    },
  },
}));

import * as wagmiCore from "@wagmi/core";
import { encodeEventTopics, type WalletClient } from "viem";
import { worksKeys } from "../../config/query-keys/work";
import { queryClient } from "../../config/react-query";
import type { WorkApprovalDraft, WorkDraft } from "../../types/domain";
import type { EASWork } from "../../types/eas-responses";
import { EASABI } from "../../utils/blockchain/contracts";
import * as polling from "../../utils/blockchain/polling";

import {
  submitApprovalDirectly,
  submitBatchApprovalsDirectly,
  submitWorkDirectly,
} from "../../modules/work/wallet-submission";
import { WorkSubmissionError } from "../../modules/work/wallet-submission/types";
import * as encoders from "../../utils/eas/encoders";
import { mock } from "../test-utils/render-helpers";

describe("wallet-submission", () => {
  const mockWalletClient: Partial<WalletClient> = {
    sendTransaction: vi.fn(),
    chain: { id: 11155111 } as any,
    account: { address: "0xUserAddress" } as any,
  };

  const mockChainId = 11155111;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureWagmiWalletChain.mockResolvedValue(undefined);
    mockAssertLocalArbitrumForkWallet.mockResolvedValue(undefined);
    mock(wagmiCore.getAccount).mockReturnValue({ address: "0xUserAddress" } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("submitWorkDirectly", () => {
    const mockWorkDraft: WorkDraft = {
      actionUID: 123,
      title: "Test Work",
      feedback: "Test feedback",
      timeSpentMinutes: 10,
      details: { plantSelection: ["plant1", "plant2"], plantCount: 10 },
      media: [],
    };

    const mockImages = [
      new File(["image1"], "image1.jpg", { type: "image/jpeg" }),
      new File(["image2"], "image2.jpg", { type: "image/jpeg" }),
    ];

    it("reconciles an already broadcast transaction before uploading or sending again", async () => {
      mock(wagmiCore.waitForTransactionReceipt).mockResolvedValue({ status: "success" } as any);
      await expect(
        submitWorkDirectly(
          mockWorkDraft,
          "0xGardenAddress",
          123,
          "Test Action",
          mockChainId,
          mockImages,
          {
            checkpoint: {
              submittedAt: "2026-09-09T00:00:00Z",
              files: {},
              transactionHash: "0x1234",
            },
          }
        )
      ).rejects.toThrow("awaiting-confirmation");
      expect(encoders.encodeWorkData).not.toHaveBeenCalled();
      expect(mockWalletClient.sendTransaction).not.toHaveBeenCalled();
    });
    it("should successfully submit work when wallet is connected", async () => {
      // Setup mocks
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkData).mockResolvedValue("0xEncodedWorkData" as `0x${string}`);
      mock(mockWalletClient.sendTransaction!).mockResolvedValue(
        "0xTransactionHash" as `0x${string}`
      );
      mock(wagmiCore.waitForTransactionReceipt).mockResolvedValue({} as any);

      // Execute
      const result = await submitWorkDirectly(
        mockWorkDraft,
        "0xGardenAddress",
        123,
        "Test Action",
        mockChainId,
        mockImages
      );

      // Verify
      expect(result).toBe("0xTransactionHash");
      expect(wagmiCore.getWalletClient).toHaveBeenCalledWith({}, { chainId: mockChainId });
      expect(mockEnsureWagmiWalletChain).toHaveBeenCalledWith({}, mockChainId);
      // The wallet's network is checked before the upload and again after it: an
      // upload can outlast the wallet staying on the network.
      const [beforeUpload, beforeSend] = mockEnsureWagmiWalletChain.mock.invocationCallOrder;
      const upload = vi.mocked(encoders.encodeWorkData).mock.invocationCallOrder[0];
      const send = vi.mocked(mockWalletClient.sendTransaction!).mock.invocationCallOrder[0];
      expect(beforeUpload).toBeLessThan(upload);
      expect(beforeSend).toBeGreaterThan(upload);
      expect(beforeSend).toBeLessThan(send);
      expect(encoders.encodeWorkData).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Test Work",
          feedback: "Test feedback",
          actionUID: 123,
          media: mockImages,
        }),
        mockChainId,
        expect.objectContaining({
          authMode: "wallet",
          gardenAddress: "0xGardenAddress",
        })
      );
      expect(mockWalletClient.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "0xEASAddress",
          value: 0n,
          chain: expect.objectContaining({ id: mockChainId }),
        })
      );
      expect(wagmiCore.waitForTransactionReceipt).toHaveBeenCalledWith(
        {},
        { hash: "0xTransactionHash", chainId: mockChainId }
      );
    });

    it("lists the sent work under the attestation id its receipt names, and adds no row without one", async () => {
      const garden = "0x1111111111111111111111111111111111111111";
      const workUID = `0x${"ab".repeat(32)}`;
      const attested = (emitter: string, schemaUID: string) => ({
        address: emitter,
        topics: encodeEventTopics({
          abi: EASABI,
          eventName: "Attested",
          args: { recipient: garden, attester: `0x${"3".repeat(40)}`, schemaUID },
        }),
        data: workUID,
      });
      const eas = `0x${"e".repeat(40)}`;
      const workSchema = `0x${"1".repeat(64)}`;
      const keys = [worksKeys.online(garden, mockChainId), worksKeys.merged(garden, mockChainId)];
      const listed = () =>
        keys.map((key) => queryClient.getQueryData<EASWork[]>(key)?.map((work) => work.id));
      const send = (logs: unknown[]) => {
        mock(wagmiCore.waitForTransactionReceipt).mockResolvedValue({ logs } as any);
        return submitWorkDirectly(mockWorkDraft, garden, 123, "Test Action", mockChainId, []);
      };
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkData).mockResolvedValue("0xEncodedWorkData" as `0x${string}`);
      mock(mockWalletClient.sendTransaction!).mockResolvedValue("0xHash" as `0x${string}`);

      const uploaded = {
        media: ["cid-photo-one", "cid-photo-two"],
        metadata: {
          clientWorkId: "sent",
          details: { trees: 4 },
          timeSpentMinutes: 30,
          attachments: [
            { cid: "cid-photo-one", type: "image/jpeg" },
            { cid: "cid-photo-two", type: "image/png" },
          ],
        },
      };
      mock(encoders.encodeWorkData).mockImplementation(async (_draft, _chain, options) => {
        options?.onEncoded?.(uploaded);
        return "0xEncodedWorkData" as `0x${string}`;
      });

      // What the send tells its wait for the indexer to watch for.
      const arrived = () => vi.mocked(polling.pollQueriesAfterTransaction).mock.lastCall![0].until;

      try {
        // Another contract's event, or EAS attesting under another schema, is not this work.
        await send([
          attested(`0x${"d".repeat(40)}`, workSchema),
          attested(eas, `0x${"2".repeat(64)}`),
        ]);
        expect(listed()).toEqual([undefined, undefined]);
        // With no row standing in, the lists growing is the sign the work arrived.
        expect(arrived()).toBeUndefined();

        await send([attested(eas, workSchema)]);
        expect(listed()).toEqual([[workUID], [workUID]]);
        expect(queryClient.getQueryData<EASWork[]>(keys[0])?.[0]).toMatchObject({
          media: uploaded.media,
          metadata: JSON.stringify(uploaded.metadata),
        });
        // The indexed work takes the row's place one for one, so the wait watches for the
        // read's own row instead of a longer list.
        expect(arrived()?.()).toBe(false);
        queryClient.setQueryData(keys[0], [{ id: workUID, media: ["cid"] }]);
        expect(arrived()?.()).toBe(true);

        // A read that already returned the work keeps its row: the same id is not listed twice.
        await send([attested(eas, workSchema)]);
        expect(queryClient.getQueryData(keys[0])).toEqual([{ id: workUID, media: ["cid"] }]);
        expect(listed()).toEqual([[workUID], [workUID]]);
        expect(arrived()?.()).toBe(true);
      } finally {
        keys.forEach((queryKey) => queryClient.removeQueries({ queryKey }));
      }
    });

    it.each([
      ["during the upload", "upload"],
      ["while its networks were being read after the upload", "read"],
    ])("refuses a wallet swapped in %s before asking it to change network", async (_when, moment) => {
      // Another account takes over the connection.
      const swapIn = () =>
        mock(wagmiCore.getAccount).mockReturnValue({ address: "0xAnotherWallet" } as any);
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkData).mockImplementation(async () => {
        if (moment === "upload") swapIn();
        return "0xEncodedWorkData" as `0x${string}`;
      });
      // As the guard does for a wallet on another network: it reads the wallet,
      // asks who the switch is for, then switches.
      const switched = vi.fn();
      mockEnsureWagmiWalletChain.mockImplementation(
        async (_config, _chainId, _reason, beforeSwitch?: () => Promise<void>) => {
          if (!beforeSwitch) return;
          if (moment === "read") swapIn();
          await beforeSwitch();
          switched();
        }
      );

      await expect(
        submitWorkDirectly(
          mockWorkDraft,
          "0xGardenAddress",
          123,
          "Test Action",
          mockChainId,
          mockImages
        )
      ).rejects.toThrow("submission-ownership-changed");

      expect(switched).not.toHaveBeenCalled();
      expect(mockWalletClient.sendTransaction).not.toHaveBeenCalled();
    });

    it("keeps the chain's head with the intent it records before the wallet prompt, and never a stale one", async () => {
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkData).mockResolvedValue("0xEncodedWorkData" as `0x${string}`);
      mock(mockWalletClient.sendTransaction!).mockResolvedValue(
        "0xTransactionHash" as `0x${string}`
      );
      mock(wagmiCore.waitForTransactionReceipt).mockResolvedValue({} as any);
      const onCheckpoint = vi.fn(async (_checkpoint: object) => undefined);
      const send = (draft: WorkDraft) =>
        submitWorkDirectly(draft, "0xGardenAddress", 123, "Test Action", mockChainId, mockImages, {
          onCheckpoint,
        });

      // A lost answer is then timed on the chain's clock, whatever the device's does.
      mock(wagmiCore.getBlock).mockResolvedValue({ number: 100n, timestamp: 1_234n } as any);
      await send({ ...mockWorkDraft, uploadCheckpoint: undefined });
      expect(onCheckpoint).toHaveBeenCalledWith(
        expect.objectContaining({
          broadcastPending: true,
          intentBlock: 100n,
          intentChainTime: 1_234,
        })
      );

      // A head kept from an earlier try never stands in for one the chain cannot give now.
      onCheckpoint.mockClear();
      mock(wagmiCore.getBlock).mockRejectedValue(new Error("rpc unavailable"));
      await send({
        ...mockWorkDraft,
        uploadCheckpoint: {
          submittedAt: "2026-09-09T00:00:00Z",
          files: {},
          intentBlock: 7n,
          intentChainTime: 1,
          idleBlock: 5n,
        },
      });
      const intent = onCheckpoint.mock.calls[0]?.[0];
      expect(intent).toMatchObject({ broadcastPending: true });
      expect(intent).not.toHaveProperty("intentChainTime");
      expect(intent).not.toHaveProperty("intentBlock");
      expect(intent).not.toHaveProperty("idleBlock");
    });

    it("should throw error when wallet is not connected", async () => {
      // Setup: no wallet client
      mock(wagmiCore.getWalletClient).mockResolvedValue(null as any);

      // Execute & Verify
      await expect(
        submitWorkDirectly(
          mockWorkDraft,
          "0xGardenAddress",
          123,
          "Test Action",
          mockChainId,
          mockImages
        )
      ).rejects.toThrow("Wallet not connected");
    });

    // The wallet-submission boundary module preserves the raw error message and
    // attaches the original via `cause`. Classification into user-friendly copy
    // now happens downstream in useWorkMutation.onError via parseContractError —
    // this avoids the dead-work pattern where pre-formatted messages were
    // discarded by the unwrap+reclassify in the mutation.
    it("should preserve user rejection error message and cause", async () => {
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkData).mockResolvedValue("0xEncodedWorkData" as `0x${string}`);
      const original = new Error("User rejected the request");
      mock(mockWalletClient.sendTransaction!).mockRejectedValue(original);

      try {
        await submitWorkDirectly(
          mockWorkDraft,
          "0xGardenAddress",
          123,
          "Test Action",
          mockChainId,
          mockImages
        );
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(WorkSubmissionError);
        expect((error as WorkSubmissionError).phase).toBe("transaction");
        expect((error as Error).message).toBe("User rejected the request");
        expect((error as Error).cause).toBe(original);
      }
    });

    it("should preserve insufficient funds error message and cause", async () => {
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkData).mockResolvedValue("0xEncodedWorkData" as `0x${string}`);
      const original = new Error("insufficient funds for gas");
      mock(mockWalletClient.sendTransaction!).mockRejectedValue(original);

      try {
        await submitWorkDirectly(
          mockWorkDraft,
          "0xGardenAddress",
          123,
          "Test Action",
          mockChainId,
          mockImages
        );
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toBe("insufficient funds for gas");
        expect((error as Error).cause).toBe(original);
      }
    });

    it("should preserve network error message during transaction phase", async () => {
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkData).mockResolvedValue("0xEncodedWorkData" as `0x${string}`);
      const original = new Error("network connection failed");
      mock(mockWalletClient.sendTransaction!).mockRejectedValue(original);

      try {
        await submitWorkDirectly(
          mockWorkDraft,
          "0xGardenAddress",
          123,
          "Test Action",
          mockChainId,
          mockImages
        );
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(WorkSubmissionError);
        expect((error as WorkSubmissionError).phase).toBe("transaction");
        expect((error as Error).message).toBe("network connection failed");
        expect((error as Error).cause).toBe(original);
      }
    });

    it("should wrap IPFS upload failure with phase 'upload'", async () => {
      // Setup: wallet connected, but IPFS upload fails
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      const ipfsError = new Error("Failed to verify Pinata gateway: 504 Gateway Timeout");
      mock(encoders.encodeWorkData).mockRejectedValue(ipfsError);

      // Execute & Verify
      try {
        await submitWorkDirectly(
          mockWorkDraft,
          "0xGardenAddress",
          123,
          "Test Action",
          mockChainId,
          mockImages
        );
        expect.fail("Should have thrown");
      } catch (error) {
        // The error should be a WorkSubmissionError with phase "upload"
        expect(error).toBeInstanceOf(WorkSubmissionError);
        expect((error as WorkSubmissionError).phase).toBe("upload");
        // The original IPFS error should be preserved as the cause
        expect((error as Error).cause).toBe(ipfsError);
      }
    });

    it("should preserve nonce conflict error message and cause", async () => {
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkData).mockResolvedValue("0xEncodedWorkData" as `0x${string}`);
      const original = new Error("nonce too low");
      mock(mockWalletClient.sendTransaction!).mockRejectedValue(original);

      try {
        await submitWorkDirectly(
          mockWorkDraft,
          "0xGardenAddress",
          123,
          "Test Action",
          mockChainId,
          mockImages
        );
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toBe("nonce too low");
        expect((error as Error).cause).toBe(original);
      }
    });
  });

  describe("submitApprovalDirectly", () => {
    const mockApprovalDraft: WorkApprovalDraft = {
      workUID: "0xWorkUID",
      actionUID: 456,
      approved: true,
      feedback: "Great work!",
      confidence: 2,
      verificationMethod: 1,
    };

    it("should successfully submit approval when wallet is connected", async () => {
      // Setup mocks
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkApprovalData).mockReturnValue(
        "0xEncodedApprovalData" as `0x${string}`
      );
      mock(mockWalletClient.sendTransaction!).mockResolvedValue(
        "0xApprovalTxHash" as `0x${string}`
      );
      mock(wagmiCore.waitForTransactionReceipt).mockResolvedValue({} as any);
      const onLifecycle = vi.fn();

      // Execute
      const result = await submitApprovalDirectly(
        mockApprovalDraft,
        "0xGardenAddress",
        "0xGardenerAddress",
        mockChainId,
        { onLifecycle } as any
      );

      // Verify
      expect(result).toEqual({ hash: "0xApprovalTxHash", confirmed: true });
      expect(wagmiCore.getWalletClient).toHaveBeenCalledWith({}, { chainId: mockChainId });
      expect(mockEnsureWagmiWalletChain).toHaveBeenCalledWith({}, mockChainId);
      expect(encoders.encodeWorkApprovalData).toHaveBeenCalledWith(mockApprovalDraft, mockChainId);
      expect(mockWalletClient.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "0xEASAddress",
          value: 0n,
          chain: expect.objectContaining({ id: mockChainId }),
        })
      );
      expect(wagmiCore.waitForTransactionReceipt).toHaveBeenCalledWith(
        {},
        { hash: "0xApprovalTxHash", chainId: mockChainId }
      );
      expect(onLifecycle.mock.calls).toEqual([
        [{ stage: "handoff" }],
        [{ stage: "broadcast", txHash: "0xApprovalTxHash" }],
        [{ stage: "confirmed", txHash: "0xApprovalTxHash" }],
      ]);
    });

    it("reports an unconfirmed submission when the receipt helper times out", async () => {
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkApprovalData).mockReturnValue(
        "0xEncodedApprovalData" as `0x${string}`
      );
      mock(mockWalletClient.sendTransaction!).mockResolvedValue(
        "0xApprovalTxHash" as `0x${string}`
      );
      mock(wagmiCore.waitForTransactionReceipt).mockImplementation(() => new Promise(() => {}));
      const onLifecycle = vi.fn();

      const result = await submitApprovalDirectly(
        mockApprovalDraft,
        "0xGardenAddress",
        "0xGardenerAddress",
        mockChainId,
        { onLifecycle, txTimeout: 0 }
      );

      expect(result).toEqual({ hash: "0xApprovalTxHash", confirmed: false });
      expect(onLifecycle).toHaveBeenLastCalledWith({
        stage: "broadcast",
        txHash: "0xApprovalTxHash",
        reason: "receipt-timeout",
      });
    });

    it("rethrows receipt failures instead of recording an optimistic approval", async () => {
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkApprovalData).mockReturnValue(
        "0xEncodedApprovalData" as `0x${string}`
      );
      mock(mockWalletClient.sendTransaction!).mockResolvedValue(
        "0xApprovalTxHash" as `0x${string}`
      );
      const receiptError = new Error("Transaction execution reverted");
      mock(wagmiCore.waitForTransactionReceipt).mockRejectedValue(receiptError);

      try {
        await submitApprovalDirectly(
          mockApprovalDraft,
          "0xGardenAddress",
          "0xGardenerAddress",
          mockChainId
        );
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toBe("Transaction execution reverted");
        expect((error as Error).cause).toBe(receiptError);
      }
    });

    it("rejects a mined-but-reverted receipt instead of reporting it confirmed", async () => {
      // waitForTransactionReceipt resolves with the receipt on revert rather
      // than throwing, so "a receipt arrived" is not proof the write landed.
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkApprovalData).mockReturnValue(
        "0xEncodedApprovalData" as `0x${string}`
      );
      mock(mockWalletClient.sendTransaction!).mockResolvedValue(
        "0xApprovalTxHash" as `0x${string}`
      );
      mock(wagmiCore.waitForTransactionReceipt).mockResolvedValue({ status: "reverted" } as any);

      await expect(
        submitApprovalDirectly(
          mockApprovalDraft,
          "0xGardenAddress",
          "0xGardenerAddress",
          mockChainId
        )
      ).rejects.toThrow(/reverted on chain/i);
    });

    it("should throw error when wallet is not connected", async () => {
      // Setup: no wallet client
      mock(wagmiCore.getWalletClient).mockResolvedValue(null as any);

      // Execute & Verify
      await expect(
        submitApprovalDirectly(
          mockApprovalDraft,
          "0xGardenAddress",
          "0xGardenerAddress",
          mockChainId
        )
      ).rejects.toThrow("Wallet not connected");
    });

    it("should preserve user rejection error message and cause for approval", async () => {
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkApprovalData).mockReturnValue(
        "0xEncodedApprovalData" as `0x${string}`
      );
      const original = new Error("User rejected the request");
      mock(mockWalletClient.sendTransaction!).mockRejectedValue(original);

      try {
        await submitApprovalDirectly(
          mockApprovalDraft,
          "0xGardenAddress",
          "0xGardenerAddress",
          mockChainId
        );
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toBe("User rejected the request");
        expect((error as Error).cause).toBe(original);
      }
    });
  });

  describe("submitBatchApprovalsDirectly", () => {
    const mockApprovalDraft: WorkApprovalDraft = {
      workUID: "0xWorkUID",
      actionUID: 456,
      approved: true,
      feedback: "Great work!",
      confidence: 2,
      verificationMethod: 1,
    };

    it("switches to the target chain and submits with the target chain", async () => {
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkApprovalData).mockReturnValue(
        "0xEncodedApprovalData" as `0x${string}`
      );
      mock(mockWalletClient.sendTransaction!).mockResolvedValue(
        "0xBatchApprovalTxHash" as `0x${string}`
      );
      mock(wagmiCore.waitForTransactionReceipt).mockResolvedValue({} as any);

      const result = await submitBatchApprovalsDirectly(
        [
          {
            draft: mockApprovalDraft,
            gardenAddress: "0xGardenAddress",
            gardenerAddress: "0xGardenerAddress",
          },
        ],
        mockChainId
      );

      expect(result).toBe("0xBatchApprovalTxHash");
      expect(mockEnsureWagmiWalletChain).toHaveBeenCalledWith({}, mockChainId);
      expect(wagmiCore.getWalletClient).toHaveBeenCalledWith({}, { chainId: mockChainId });
      expect(mockWalletClient.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "0xEASAddress",
          value: 0n,
          chain: expect.objectContaining({ id: mockChainId }),
        })
      );
    });
  });
});
