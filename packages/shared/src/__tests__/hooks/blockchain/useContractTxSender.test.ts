/**
 * useContractTxSender Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the contract transaction sender that branches between
 * passkey (smart account) and wallet (wagmi) auth modes.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Abi } from "viem";
import { MOCK_ADDRESSES, MOCK_TX_HASH } from "../../test-utils/mock-factories";

// ============================================
// Mocks
// ============================================

const mockWriteContractAsync = vi.fn();
const mockSendTransaction = vi.fn();

const mockSmartAccountClient = {
  account: { address: MOCK_ADDRESSES.smartAccount },
  chain: { id: 11155111, name: "Sepolia" },
  sendTransaction: mockSendTransaction,
};

let mockAuthMode: "wallet" | "passkey" | null = "passkey";
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
}));

// Mock appkit config (needed by wagmi internals)
vi.mock("../../../config/appkit", () => ({
  wagmiConfig: {},
}));

import { useContractTxSender } from "../../../hooks/blockchain/useContractTxSender";

// ============================================
// Test helpers
// ============================================

const TEST_ABI: Abi = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
];

// Use a valid 20-byte hex address for ABI encoding (viem validates address args)
const VALID_RECIPIENT = "0x1111111111111111111111111111111111111111" as const;

const TEST_REQUEST = {
  address: "0x3333333333333333333333333333333333333333" as `0x${string}`,
  abi: TEST_ABI,
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
    mockSendTransaction.mockResolvedValue(MOCK_TX_HASH);
    mockWriteContractAsync.mockResolvedValue(MOCK_TX_HASH);
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
      expect(mockSendTransaction).toHaveBeenCalledOnce();
      expect(mockWriteContractAsync).not.toHaveBeenCalled();
    });

    it("encodes function data and passes correct parameters", async () => {
      const { result } = renderHook(() => useContractTxSender(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current(TEST_REQUEST);
      });

      const sendTxArgs = mockSendTransaction.mock.calls[0][0];
      expect(sendTxArgs.account).toEqual(mockSmartAccountClient.account);
      expect(sendTxArgs.chain).toEqual(mockSmartAccountClient.chain);
      expect(sendTxArgs.to).toBe(TEST_REQUEST.address);
      expect(sendTxArgs.value).toBe(0n);
      // data should be a hex-encoded calldata string
      expect(sendTxArgs.data).toMatch(/^0x/);
    });

    it("propagates errors from smart account sendTransaction", async () => {
      const error = new Error("Smart account rejected");
      mockSendTransaction.mockRejectedValueOnce(error);

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
      expect(mockSendTransaction).not.toHaveBeenCalled();
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
      });
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
    it("falls back to wagmi when smartAccountClient is null", async () => {
      mockAuthMode = "passkey";
      mockSmartAccountRef = null;

      const { result } = renderHook(() => useContractTxSender(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current(TEST_REQUEST);
      });

      expect(mockWriteContractAsync).toHaveBeenCalledOnce();
      expect(mockSendTransaction).not.toHaveBeenCalled();
    });

    it("falls back to wagmi when smartAccountClient has no account", async () => {
      mockAuthMode = "passkey";
      mockSmartAccountRef = { ...mockSmartAccountClient, account: undefined } as any;

      const { result } = renderHook(() => useContractTxSender(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current(TEST_REQUEST);
      });

      expect(mockWriteContractAsync).toHaveBeenCalledOnce();
      expect(mockSendTransaction).not.toHaveBeenCalled();
    });
  });
});
