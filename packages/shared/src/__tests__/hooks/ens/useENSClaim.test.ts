/**
 * useENSClaim Hook Tests
 *
 * Tests the ENS subdomain claim mutation hook for passkey-sponsored and
 * wallet-funded registration paths.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSendTransaction = vi.fn();
const mockWriteContract = vi.fn();
const mockReadContract = vi.fn();
const mockGetBalance = vi.fn();
const mockWaitForTransactionReceipt = vi.fn();

let mockAuthMode: "passkey" | "wallet" | "embedded" | null = null;
let mockWalletAddress: string | undefined = "0x1234567890123456789012345678901234567890";
let mockWalletClientData: { writeContract: ReturnType<typeof vi.fn> } | undefined = {
  writeContract: mockWriteContract,
};

const mockSmartAccountClient = {
  account: { address: "0xSmartAccount1234567890123456789012345678" },
  chain: { id: 11155111 },
  sendTransaction: mockSendTransaction,
};
let mockSmartAccountClientValue: typeof mockSmartAccountClient | null = mockSmartAccountClient;

vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({
    address: mockWalletAddress,
  })),
  useWalletClient: vi.fn(() => ({
    data: mockWalletClientData,
  })),
}));

vi.mock("../../../hooks/auth/useAuth", () => ({
  useAuth: vi.fn(() => ({
    authMode: mockAuthMode,
    smartAccountClient: mockAuthMode === "passkey" ? mockSmartAccountClientValue : null,
  })),
}));

const ENS_ADDRESS = "0xENSContract000000000000000000000000000001" as const;
const L1_RECEIVER_ADDRESS = "0xReceiver0000000000000000000000000000000001" as const;

vi.mock("../../../utils/blockchain/contracts", () => ({
  GreenGoodsENSABI: [
    { name: "claimNameSponsored", type: "function", inputs: [{ name: "slug", type: "string" }] },
    { name: "claimName", type: "function", inputs: [{ name: "slug", type: "string" }] },
    { name: "available", type: "function", inputs: [{ name: "slug", type: "string" }] },
    { name: "l1Receiver", type: "function", inputs: [] },
    { name: "totalPendingRefunds", type: "function", inputs: [] },
    {
      name: "getRegistrationFee",
      type: "function",
      inputs: [
        { name: "slug", type: "string" },
        { name: "sender", type: "address" },
        { name: "nameType", type: "uint8" },
      ],
    },
  ],
  getNetworkContracts: vi.fn(() => ({
    greenGoodsENS: ENS_ADDRESS,
  })),
  createClients: vi.fn(() => ({
    publicClient: {
      readContract: mockReadContract,
      getBalance: mockGetBalance,
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
    },
  })),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../components/toast", () => ({
  toastService: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../../../utils/errors/contract-errors", () => ({
  parseContractError: vi.fn((error: Error) => ({
    name: error.message,
    message: error.message,
  })),
}));

import { toastService } from "../../../components/toast";
import { useENSClaim } from "../../../hooks/ens/useENSClaim";
import { queryKeys } from "../../../config/query-keys";
import { logger } from "../../../modules/app/logger";

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

const MOCK_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

function mockDefaultReadContract() {
  mockReadContract.mockImplementation(({ functionName }) => {
    if (functionName === "available") return Promise.resolve(true);
    if (functionName === "l1Receiver") return Promise.resolve(L1_RECEIVER_ADDRESS);
    if (functionName === "getRegistrationFee") return Promise.resolve(100000n);
    if (functionName === "totalPendingRefunds") return Promise.resolve(0n);
    return Promise.resolve(undefined);
  });
}

describe("useENSClaim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthMode = null;
    mockSmartAccountClientValue = mockSmartAccountClient;
    mockWalletAddress = "0x1234567890123456789012345678901234567890";
    mockWalletClientData = { writeContract: mockWriteContract };
    mockGetBalance.mockResolvedValue(200000n);
    mockWaitForTransactionReceipt.mockResolvedValue({ logs: [] });
    mockDefaultReadContract();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("passkey user flow (sponsored)", () => {
    beforeEach(() => {
      mockAuthMode = "passkey";
    });

    it("preflights funding and calls claimNameSponsored via smart account", async () => {
      mockSendTransaction.mockResolvedValue(MOCK_TX_HASH);

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSClaim(), { wrapper });

      result.current.mutate({ slug: "alice" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "getRegistrationFee",
          args: ["alice", mockSmartAccountClient.account.address, 0],
        })
      );
      expect(mockGetBalance).toHaveBeenCalledWith({ address: ENS_ADDRESS });
      expect(mockSendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          account: mockSmartAccountClient.account,
          chain: mockSmartAccountClient.chain,
          to: ENS_ADDRESS,
        })
      );
      expect(result.current.data?.slug).toBe("alice");
    });

    it("fails before submitting when the sponsored ENS fund is underfunded", async () => {
      mockGetBalance.mockResolvedValue(1n);

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSClaim(), { wrapper });

      result.current.mutate({ slug: "alice" });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("InsufficientSponsoredBalance");
      expect(mockSendTransaction).not.toHaveBeenCalled();
      expect(toastService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          description:
            "The sponsored username fund needs more ETH before passkey users can claim names.",
        })
      );
    });

    it("does not fall back to wallet when the passkey smart account is unavailable", async () => {
      mockSmartAccountClientValue = null;

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSClaim(), { wrapper });

      result.current.mutate({ slug: "alice" });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("Passkey smart account not ready");
      expect(mockWriteContract).not.toHaveBeenCalled();
    });
  });

  describe("wallet user flow (user-funded)", () => {
    beforeEach(() => {
      mockAuthMode = "wallet";
    });

    it("reads fee and calls claimName with value", async () => {
      const mockFee = 123456n;
      mockReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "available") return Promise.resolve(true);
        if (functionName === "l1Receiver") return Promise.resolve(L1_RECEIVER_ADDRESS);
        if (functionName === "getRegistrationFee") return Promise.resolve(mockFee);
        return Promise.resolve(undefined);
      });
      mockWriteContract.mockResolvedValue(MOCK_TX_HASH);

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSClaim(), { wrapper });

      result.current.mutate({ slug: "bob" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "getRegistrationFee",
          args: ["bob", mockWalletAddress, 0],
        })
      );
      expect(mockWriteContract).toHaveBeenCalledWith(
        expect.objectContaining({
          value: mockFee,
        })
      );
    });
  });

  describe("error handling", () => {
    it("throws when no auth mode or connected account exists", async () => {
      mockAuthMode = null;
      mockWalletAddress = undefined;
      mockWalletClientData = undefined;

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSClaim(), { wrapper });

      result.current.mutate({ slug: "test" });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("No connected account");
    });

    it("throws when ENS module is not configured", async () => {
      mockAuthMode = "wallet";

      const { getNetworkContracts } = await import("../../../utils/blockchain/contracts");
      (getNetworkContracts as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        greenGoodsENS: "0x0000000000000000000000000000000000000000",
      });

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSClaim(), { wrapper });

      result.current.mutate({ slug: "test" });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("ENS module not configured for this network");
    });

    it("fails before submitting when either L2 or L1 reports the name taken", async () => {
      mockAuthMode = "wallet";
      mockReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "available") return Promise.resolve(false);
        return Promise.resolve(undefined);
      });

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSClaim(), { wrapper });

      result.current.mutate({ slug: "taken" });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("NameTaken");
      expect(mockWriteContract).not.toHaveBeenCalled();
    });

    it("calls logger.error on failure", async () => {
      mockAuthMode = "wallet";
      mockReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "available") return Promise.resolve(true);
        if (functionName === "l1Receiver") return Promise.resolve(L1_RECEIVER_ADDRESS);
        if (functionName === "getRegistrationFee") return Promise.reject(new Error("RPC error"));
        return Promise.resolve(undefined);
      });

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSClaim(), { wrapper });

      result.current.mutate({ slug: "test" });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(logger.error).toHaveBeenCalledWith("ENS claim failed", expect.any(Object));
    });

    it("shows toast error on failure", async () => {
      mockAuthMode = "wallet";
      mockReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "available") return Promise.resolve(true);
        if (functionName === "l1Receiver") return Promise.resolve(L1_RECEIVER_ADDRESS);
        if (functionName === "getRegistrationFee")
          return Promise.reject(new Error("InsufficientFee"));
        return Promise.resolve(undefined);
      });

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSClaim(), { wrapper });

      result.current.mutate({ slug: "test" });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(toastService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Registration failed",
        })
      );
    });
  });

  describe("onSuccess", () => {
    it("seeds registration status query with pending data", async () => {
      mockAuthMode = "passkey";
      mockSendTransaction.mockResolvedValue(MOCK_TX_HASH);

      const { queryClient, wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSClaim(), { wrapper });

      result.current.mutate({ slug: "alice" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const seededData = queryClient.getQueryData(queryKeys.ens.registrationStatus("alice"));
      expect(seededData).toEqual(
        expect.objectContaining({
          status: "pending",
          submittedAt: expect.any(Number),
        })
      );
    });

    it("shows success toast", async () => {
      mockAuthMode = "passkey";
      mockSendTransaction.mockResolvedValue(MOCK_TX_HASH);

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSClaim(), { wrapper });

      result.current.mutate({ slug: "alice" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(toastService.success).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Name registration started",
        })
      );
    });
  });
});
