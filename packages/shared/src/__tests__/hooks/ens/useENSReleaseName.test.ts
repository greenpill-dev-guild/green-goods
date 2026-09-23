/**
 * useENSReleaseName Hook Tests
 *
 * Tests the ENS subdomain release mutation hook. Releases are sponsored where
 * the ENS sender supports it. On the legacy sender, wallets pay the fee.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSendTransaction = vi.fn();
const mockWalletSendTransaction = vi.fn();
const mockReadContract = vi.fn();
const mockGetBalance = vi.fn();
const mockEstimateGas = vi.fn();
const mockEstimateFeesPerGas = vi.fn();
const mockWaitForTransactionReceipt = vi.fn();
const mockEnsureAppKitWalletChain = vi.fn();

/** Function selectors on the ENS sender. */
const RELEASE_NAME_SPONSORED_SELECTOR = "0x0bcd9fed";
const RELEASE_NAME_SELECTOR = "0x58cdf6bd";

type MockWalletClient = {
  account: { address: string; type: "json-rpc" };
  sendTransaction: typeof mockWalletSendTransaction;
};

let mockAuthMode: "passkey" | "wallet" | "embedded" | null = null;
let mockWalletAddress: string | undefined = "0x1234567890123456789012345678901234567890";
let mockWalletClientData: MockWalletClient | undefined;
let mockPoolBalance = 200000n;
let mockWalletBalance = 10n ** 18n;

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
      estimateGas: mockEstimateGas,
      estimateFeesPerGas: mockEstimateFeesPerGas,
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
    },
  })),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../config/default-chain", () => ({
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
    mockWalletClientData = {
      account: { address: mockWalletAddress, type: "json-rpc" },
      sendTransaction: mockWalletSendTransaction,
    };
    mockEnsAddress = ENS_ADDRESS;
    mockPoolBalance = 200000n;
    mockWalletBalance = 10n ** 18n;
    mockGetBalance.mockImplementation(({ address }: { address: string }) =>
      Promise.resolve(address === mockEnsAddress ? mockPoolBalance : mockWalletBalance)
    );
    mockEstimateGas.mockResolvedValue(300000n);
    mockEstimateFeesPerGas.mockResolvedValue({ maxFeePerGas: 25000000n });
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
      mockPoolBalance = 1n;

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSReleaseName(), { wrapper });

      result.current.mutate();

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("InsufficientSponsoredBalance");
      expect(mockSendTransaction).not.toHaveBeenCalled();
      expect(toastService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "The sponsored username fund needs more ETH before names can be released.",
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
            "Username changes are temporarily steward-assisted while we migrate the ENS sender.",
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
      expect(mockWalletSendTransaction).not.toHaveBeenCalled();
    });
  });

  describe("wallet user flow", () => {
    const releaseFee = 123456n;

    beforeEach(() => {
      mockAuthMode = "wallet";
      mockReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "ownerToSlug") return Promise.resolve("bob");
        if (functionName === "getReleaseFee") return Promise.resolve(releaseFee);
        if (functionName === "totalPendingRefunds") return Promise.resolve(0n);
        return Promise.resolve(undefined);
      });
      mockWalletSendTransaction.mockResolvedValue(MOCK_TX_HASH);
    });

    it("releases through the sponsored call without sending ETH where the sender has one", async () => {
      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSReleaseName(), { wrapper });

      expect(result.current.isSponsoredReleaseUnavailable).toBe(false);

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGetBalance).toHaveBeenCalledWith({ address: ENS_ADDRESS });
      const sent = mockWalletSendTransaction.mock.calls[0]?.[0];
      expect(sent).toMatchObject({ to: ENS_ADDRESS, value: 0n });
      expect(sent.data.startsWith(RELEASE_NAME_SPONSORED_SELECTOR)).toBe(true);
    });

    it("pays the release fee on the legacy sender, which has no sponsored release", async () => {
      mockEnsAddress = LEGACY_ENS_ADDRESS;

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSReleaseName(), { wrapper });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockEstimateGas).toHaveBeenCalledWith(expect.objectContaining({ value: releaseFee }));
      expect(mockEnsureAppKitWalletChain).toHaveBeenCalledWith(11155111);
      const sent = mockWalletSendTransaction.mock.calls[0]?.[0];
      expect(sent).toMatchObject({ to: LEGACY_ENS_ADDRESS, value: releaseFee });
      expect(sent.data.startsWith(RELEASE_NAME_SELECTOR)).toBe(true);
    });

    it("keeps the wallet closed when it cannot pay the legacy release fee", async () => {
      mockEnsAddress = LEGACY_ENS_ADDRESS;
      mockWalletBalance = releaseFee - 1n;

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSReleaseName(), { wrapper });

      result.current.mutate();

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("InsufficientFee");
      expect(toastService.error).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Not enough ETH to cover the release fee." })
      );
      expect(mockEnsureAppKitWalletChain).not.toHaveBeenCalled();
      expect(mockWalletSendTransaction).not.toHaveBeenCalled();
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
