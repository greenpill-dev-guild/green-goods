/**
 * useContractTxSender Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the contract transaction sender that branches between
 * passkey (smart account) and wallet (wagmi) auth modes.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MOCK_ADDRESSES, MOCK_TX_HASH } from "../../test-utils/mock-factories";
import { MOCK_CONTRACT_ABI } from "../../test-utils/transaction-fakes";

// ============================================
// Mocks
// ============================================

const mockWriteContractAsync = vi.fn();
const mockSendUserOperation = vi.fn();
const mockWaitForUserOperationReceipt = vi.fn();
const mockWaitForTransactionReceipt = vi.fn().mockResolvedValue({ status: "success" });

const mockSmartAccountClient = {
  account: { address: MOCK_ADDRESSES.smartAccount },
  chain: { id: 11155111, name: "Sepolia" },
  sendUserOperation: mockSendUserOperation,
  waitForUserOperationReceipt: mockWaitForUserOperationReceipt,
};

let mockAuthMode: "wallet" | "passkey" | "embedded" | null = "passkey";
let mockSmartAccountRef: typeof mockSmartAccountClient | null = mockSmartAccountClient;

// Mock useUser
vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({
    authMode: mockAuthMode,
    smartAccountClient: mockSmartAccountRef,
  }),
}));

// Mock wagmi
vi.mock("wagmi", () => ({
  useWriteContract: () => ({
    writeContractAsync: mockWriteContractAsync,
  }),
  useConfig: () => ({}),
}));

// Mock @wagmi/core (waitForTransactionReceipt used in wallet mode)
vi.mock("@wagmi/core", () => ({
  waitForTransactionReceipt: (...args: unknown[]) => mockWaitForTransactionReceipt(...args),
  getAccount: () => ({
    chainId: 42161,
    isConnected: true,
  }),
  switchChain: vi.fn().mockResolvedValue({ id: 42161, name: "Arbitrum One" }),
}));

// Mock appkit config (needed by wagmi internals)
vi.mock("../../../config/appkit", () => ({
  getWagmiConfig: () => ({}),
}));

import { useContractTxSender } from "../../../hooks/blockchain/useContractTxSender";

// ============================================
// Test helpers
// ============================================

// Use a valid 20-byte hex address for ABI encoding (viem validates address args)
const VALID_RECIPIENT = "0x1111111111111111111111111111111111111111" as const;

const TEST_REQUEST = {
  address: "0x3333333333333333333333333333333333333333" as `0x${string}`,
  abi: MOCK_CONTRACT_ABI,
  functionName: "transfer",
  args: [VALID_RECIPIENT, 1000n] as readonly unknown[],
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ============================================
// Tests
// ============================================

describe("useContractTxSender", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthMode = "passkey";
    mockSmartAccountRef = mockSmartAccountClient;
    mockSendUserOperation.mockResolvedValue(MOCK_TX_HASH);
    mockWaitForUserOperationReceipt.mockResolvedValue({
      success: true,
      receipt: { transactionHash: MOCK_TX_HASH },
    });
    mockWriteContractAsync.mockResolvedValue(MOCK_TX_HASH);
    mockWaitForTransactionReceipt.mockResolvedValue({ status: "success" });
  });

  it("returns a function", () => {
    const { result } = renderHook(() => useContractTxSender(), {
      wrapper: createWrapper(),
    });
    expect(typeof result.current).toBe("function");
  });

  // ------------------------------------------
  // Passkey mode (smart account)
  // ------------------------------------------

  describe("passkey mode", () => {
    beforeEach(() => {
      mockAuthMode = "passkey";
      mockSmartAccountRef = mockSmartAccountClient;
    });

    it("sends transaction via smart account client", async () => {
      const { result } = renderHook(() => useContractTxSender(), {
        wrapper: createWrapper(),
      });

      let txHash: string;
      await act(async () => {
        txHash = await result.current(TEST_REQUEST);
      });

      expect(txHash!).toBe(MOCK_TX_HASH);
      expect(mockSendUserOperation).toHaveBeenCalledOnce();
      expect(mockWriteContractAsync).not.toHaveBeenCalled();
    });

    it("encodes function data and passes correct parameters", async () => {
      const { result } = renderHook(() => useContractTxSender(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current(TEST_REQUEST);
      });

      const sendTxArgs = mockSendUserOperation.mock.calls[0][0];
      expect(sendTxArgs.account).toEqual(mockSmartAccountClient.account);
      expect(sendTxArgs.calls[0].to).toBe(TEST_REQUEST.address);
      expect(sendTxArgs.calls[0].value).toBe(0n);
      // data should be a hex-encoded calldata string
      expect(sendTxArgs.calls[0].data).toMatch(/^0x/);
    });

    it("propagates errors from smart account sendTransaction", async () => {
      const error = new Error("Smart account rejected");
      mockSendUserOperation.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useContractTxSender(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current(TEST_REQUEST);
        })
      ).rejects.toThrow("Smart account rejected");
    });
  });

  // ------------------------------------------
  // Wallet mode (wagmi writeContractAsync)
  // ------------------------------------------

  describe("wallet mode", () => {
    beforeEach(() => {
      mockAuthMode = "wallet";
      mockSmartAccountRef = null;
    });

    it("sends transaction via wagmi writeContractAsync", async () => {
      const { result } = renderHook(() => useContractTxSender(), {
        wrapper: createWrapper(),
      });

      let txHash: string;
      await act(async () => {
        txHash = await result.current(TEST_REQUEST);
      });

      expect(txHash!).toBe(MOCK_TX_HASH);
      expect(mockWriteContractAsync).toHaveBeenCalledOnce();
      expect(mockSendUserOperation).not.toHaveBeenCalled();
    });

    it("passes correct parameters to writeContractAsync", async () => {
      const { result } = renderHook(() => useContractTxSender(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current(TEST_REQUEST);
      });

      expect(mockWriteContractAsync).toHaveBeenCalledWith({
        address: TEST_REQUEST.address,
        abi: TEST_REQUEST.abi,
        functionName: TEST_REQUEST.functionName,
        args: TEST_REQUEST.args,
        chainId: 42161,
      });
    });

    it("waits for transaction receipt when hash is canonical", async () => {
      const { result } = renderHook(() => useContractTxSender(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current(TEST_REQUEST);
      });

      expect(mockWaitForTransactionReceipt).toHaveBeenCalledOnce();
      expect(mockWaitForTransactionReceipt).toHaveBeenCalledWith(
        {},
        { hash: MOCK_TX_HASH, chainId: 42161 }
      );
    });

    it("skips receipt wait for non-canonical hash (Safe-style hash)", async () => {
      const safeStyleHash = `0x${"a".repeat(130)}` as `0x${string}`;
      mockWriteContractAsync.mockResolvedValueOnce(safeStyleHash);

      const { result } = renderHook(() => useContractTxSender(), {
        wrapper: createWrapper(),
      });

      let txHash: string;
      await act(async () => {
        txHash = await result.current(TEST_REQUEST);
      });

      expect(txHash!).toBe(safeStyleHash);
      expect(mockWaitForTransactionReceipt).not.toHaveBeenCalled();
    });

    it("propagates errors from writeContractAsync", async () => {
      const error = new Error("User rejected the request");
      mockWriteContractAsync.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useContractTxSender(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current(TEST_REQUEST);
        })
      ).rejects.toThrow("User rejected the request");
    });
  });

  // ------------------------------------------
  // Edge cases: passkey auth but no smart account
  // ------------------------------------------

  describe("passkey mode without smart account", () => {
    // The factory fails closed rather than reaching for wagmi: signing a passkey
    // user's transaction with a connected wallet would send it from a different
    // address. useTransactionSender turns that throw into a null sender, so this
    // deprecated wrapper reports uninitialized auth instead of sending.
    it("fails closed when smartAccountClient is null", async () => {
      mockAuthMode = "passkey";
      mockSmartAccountRef = null;

      const { result } = renderHook(() => useContractTxSender(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current(TEST_REQUEST);
        })
      ).rejects.toThrow("TransactionSender not available — auth not initialized");

      expect(mockWriteContractAsync).not.toHaveBeenCalled();
      expect(mockSendUserOperation).not.toHaveBeenCalled();
    });

    it("fails closed when smartAccountClient has no account", async () => {
      mockAuthMode = "passkey";
      mockSmartAccountRef = { ...mockSmartAccountClient, account: undefined } as any;

      const { result } = renderHook(() => useContractTxSender(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current(TEST_REQUEST);
        })
      ).rejects.toThrow("TransactionSender not available — auth not initialized");

      expect(mockWriteContractAsync).not.toHaveBeenCalled();
      expect(mockSendUserOperation).not.toHaveBeenCalled();
    });
  });
});
