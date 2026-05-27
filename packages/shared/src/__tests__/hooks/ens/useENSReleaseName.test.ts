/**
 * useENSReleaseName Hook Tests
 *
 * Tests the ENS subdomain release mutation hook for passkey-sponsored and
 * wallet-funded release paths.
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
const mockEnsureAppKitWalletChain = vi.fn();

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
const LEGACY_ENS_ADDRESS = "0x4fAD8Db8e04005884D484eC730aDae10d7A2e491" as const;
let mockEnsAddress: string = ENS_ADDRESS;

vi.mock("../../../utils/blockchain/contracts", () => ({
  GreenGoodsENSABI: [
    { name: "releaseNameSponsored", type: "function", inputs: [] },
    { name: "releaseName", type: "function", inputs: [] },
    { name: "ownerToSlug", type: "function", inputs: [{ name: "owner", type: "address" }] },
    { name: "totalPendingRefunds", type: "function", inputs: [] },
    {
      name: "getReleaseFee",
      type: "function",
      inputs: [{ name: "slug", type: "string" }],
    },
  ],
  getNetworkContracts: vi.fn(() => ({
    greenGoodsENS: mockEnsAddress,
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
  },
}));

vi.mock("../../../utils/errors/contract-errors", () => ({
  parseContractError: vi.fn((error: Error) => ({
    name: error.message,
    message: error.message,
  })),
}));

vi.mock("../../../modules/transactions/chain-guard", () => ({
  ensureAppKitWalletChain: (...args: unknown[]) => mockEnsureAppKitWalletChain(...args),
}));

import { toastService } from "../../../components/toast";
import { queryKeys } from "../../../config/query-keys";
import { useENSReleaseName } from "../../../hooks/ens/useENSReleaseName";

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
    if (functionName === "ownerToSlug") return Promise.resolve("alice");
    if (functionName === "getReleaseFee") return Promise.resolve(100000n);
    if (functionName === "totalPendingRefunds") return Promise.resolve(0n);
    return Promise.resolve(undefined);
  });
}

describe("useENSReleaseName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthMode = null;
    mockSmartAccountClientValue = mockSmartAccountClient;
    mockWalletAddress = "0x1234567890123456789012345678901234567890";
    mockWalletClientData = { writeContract: mockWriteContract };
    mockEnsAddress = ENS_ADDRESS;
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

    it("preflights funding and calls releaseNameSponsored via smart account", async () => {
      mockSendTransaction.mockResolvedValue(MOCK_TX_HASH);

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSReleaseName(), { wrapper });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "ownerToSlug",
          args: [mockSmartAccountClient.account.address],
        })
      );
      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "getReleaseFee",
          args: ["alice"],
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
      const { result } = renderHook(() => useENSReleaseName(), { wrapper });

      result.current.mutate();

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("InsufficientSponsoredBalance");
      expect(mockSendTransaction).not.toHaveBeenCalled();
      expect(toastService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          description:
            "The sponsored username fund needs more ETH before passkey users can release names.",
        })
      );
    });

    it("blocks sponsored release before RPC reads on the legacy Arbitrum sender", async () => {
      mockEnsAddress = LEGACY_ENS_ADDRESS;

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSReleaseName(), { wrapper });

      expect(result.current.isSponsoredReleaseUnavailable).toBe(true);

      result.current.mutate();

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("SponsoredReleaseUnavailable");
      expect(mockReadContract).not.toHaveBeenCalled();
      expect(mockGetBalance).not.toHaveBeenCalled();
      expect(mockSendTransaction).not.toHaveBeenCalled();
      expect(toastService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          description:
            "Username changes are temporarily operator-assisted while we migrate the ENS sender.",
        })
      );
    });

    it("does not fall back to wallet when the passkey smart account is unavailable", async () => {
      mockSmartAccountClientValue = null;

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSReleaseName(), { wrapper });

      result.current.mutate();

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("Passkey smart account not ready");
      expect(mockWriteContract).not.toHaveBeenCalled();
    });
  });

  describe("wallet user flow (user-funded)", () => {
    beforeEach(() => {
      mockAuthMode = "wallet";
    });

    it("reads fee and calls releaseName with value", async () => {
      const mockFee = 123456n;
      mockReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "ownerToSlug") return Promise.resolve("bob");
        if (functionName === "getReleaseFee") return Promise.resolve(mockFee);
        return Promise.resolve(undefined);
      });
      mockWriteContract.mockResolvedValue(MOCK_TX_HASH);

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSReleaseName(), { wrapper });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "getReleaseFee",
          args: ["bob"],
        })
      );
      expect(mockWriteContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "releaseName",
          value: mockFee,
        })
      );
    });
  });

  describe("onSuccess", () => {
    it("clears cached protocol name and shows a success toast", async () => {
      mockAuthMode = "passkey";
      mockSendTransaction.mockResolvedValue(MOCK_TX_HASH);

      const { queryClient, wrapper } = createTestWrapper();
      queryClient.setQueryData(
        queryKeys.ens.protocolName(mockSmartAccountClient.account.address),
        "alice"
      );
      const { result } = renderHook(() => useENSReleaseName(), { wrapper });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(
        queryClient.getQueryData(queryKeys.ens.protocolName(mockSmartAccountClient.account.address))
      ).toBeNull();
      expect(toastService.success).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Name release started",
        })
      );
    });
  });
});
