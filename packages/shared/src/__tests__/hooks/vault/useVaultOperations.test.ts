/**
 * useVaultOperations Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_CHAIN_ID = 11155111;
const TEST_PRIMARY_ADDRESS = "0x1111111111111111111111111111111111111111";
const TEST_GARDEN = "0x2222222222222222222222222222222222222222";
const TEST_ASSET = "0x3333333333333333333333333333333333333333";
const TEST_VAULT = "0x4444444444444444444444444444444444444444";
const TEST_OCTANT_MODULE = "0x5555555555555555555555555555555555555555";

const mockWriteContractAsync = vi.fn();
const mockReadContract = vi.fn();
const mockCreateMutationErrorHandler = vi.fn();
const mockErrorHandler = vi.fn();
const toastService = {
  loading: vi.fn(() => "toast-id"),
  dismiss: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
};

const mockUser: { authMode: string; smartAccountClient: unknown; primaryAddress: string } = {
  authMode: "wallet",
  smartAccountClient: null,
  primaryAddress: TEST_PRIMARY_ADDRESS,
};

vi.mock("wagmi", () => ({
  useWriteContract: () => ({
    writeContractAsync: mockWriteContractAsync,
  }),
  useConfig: () => ({}),
}));

vi.mock("@wagmi/core", () => ({
  readContract: (...args: unknown[]) => mockReadContract(...args),
  waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => TEST_CHAIN_ID,
}));

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => mockUser,
}));

vi.mock("../../../utils/blockchain/contracts", () => ({
  getNetworkContracts: () => ({
    octantModule: TEST_OCTANT_MODULE,
  }),
}));

vi.mock("../../../components/toast", () => ({
  toastService,
}));

vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: (...args: unknown[]) => mockCreateMutationErrorHandler(...args),
}));

const messages = {
  "app.treasury.deposit": "Deposit",
  "app.treasury.withdraw": "Withdraw",
  "app.treasury.harvest": "Harvest",
  "app.treasury.emergencyPause": "Emergency Pause",
  "app.treasury.depositSuccess": "Deposit successful",
  "app.treasury.withdrawSuccess": "Withdraw successful",
  "app.treasury.harvestSuccess": "Harvest successful",
  "app.treasury.approving": "Approving",
} as const;

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(IntlProvider, { locale: "en", messages }, children)
    );
  };
}

const operationsModule = await import("../../../hooks/vault/useVaultOperations");
const { useVaultDeposit, useVaultWithdraw, useHarvest, useEmergencyPause } = operationsModule;

describe("hooks/vault/useVaultOperations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMutationErrorHandler.mockReturnValue(mockErrorHandler);
    mockUser.authMode = "wallet";
    mockUser.smartAccountClient = null;
    mockUser.primaryAddress = TEST_PRIMARY_ADDRESS;
  });

  it("runs two-step deposit flow (approve -> deposit) when allowance is insufficient", async () => {
    // Read sequence (no minSharesOut → early slippage check skipped):
    // 1) maxDeposit, 2) allowance, 3) refreshed allowance, 4) post-approval previewDeposit
    mockReadContract
      .mockResolvedValueOnce(100n)
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(10n)
      .mockResolvedValueOnce(10n);
    mockWriteContractAsync.mockResolvedValue(
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useVaultDeposit(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: TEST_GARDEN as `0x${string}`,
        assetAddress: TEST_ASSET as `0x${string}`,
        vaultAddress: TEST_VAULT as `0x${string}`,
        amount: 10n,
      });
    });

    // readContract: maxDeposit + allowance + refreshed allowance + post-approval previewDeposit
    expect(mockReadContract).toHaveBeenCalledTimes(4);
    expect(mockReadContract).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        address: TEST_ASSET,
        functionName: "allowance",
        args: [TEST_PRIMARY_ADDRESS, TEST_VAULT],
      })
    );
    expect(mockWriteContractAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        address: TEST_ASSET,
        functionName: "approve",
      })
    );
    expect(mockWriteContractAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        address: TEST_VAULT,
        functionName: "deposit",
      })
    );
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("skips approve when allowance is already sufficient", async () => {
    // Read sequence (no minSharesOut → early slippage check skipped):
    // maxDeposit, allowance (sufficient → skip approval), post-approval previewDeposit
    mockReadContract
      .mockResolvedValueOnce(100n)
      .mockResolvedValueOnce(100n)
      .mockResolvedValueOnce(10n);
    mockWriteContractAsync.mockResolvedValue(
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useVaultDeposit(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: TEST_GARDEN as `0x${string}`,
        assetAddress: TEST_ASSET as `0x${string}`,
        vaultAddress: TEST_VAULT as `0x${string}`,
        amount: 10n,
      });
    });

    expect(mockWriteContractAsync).toHaveBeenCalledTimes(1);
    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "deposit",
      })
    );
  });

  it("runs single-step withdraw flow using withdraw", async () => {
    // maxWithdraw pre-check
    mockReadContract.mockResolvedValueOnce(100n);
    mockWriteContractAsync.mockResolvedValue(
      "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useVaultWithdraw(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: TEST_GARDEN as `0x${string}`,
        assetAddress: TEST_ASSET as `0x${string}`,
        vaultAddress: TEST_VAULT as `0x${string}`,
        amount: 5n,
      });
    });

    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_VAULT,
        functionName: "withdraw",
      })
    );
  });

  it("clamps withdraw shares to maxRedeem when within tolerance", async () => {
    const maxRedeem = 1_000_000_000_000_000_000n;
    const tolerance = maxRedeem / 10_000n;

    mockReadContract.mockResolvedValueOnce(maxRedeem);
    mockWriteContractAsync.mockResolvedValue(
      "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useVaultWithdraw(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: TEST_GARDEN as `0x${string}`,
        assetAddress: TEST_ASSET as `0x${string}`,
        vaultAddress: TEST_VAULT as `0x${string}`,
        shares: maxRedeem + tolerance,
      });
    });

    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "redeem",
        args: [maxRedeem, TEST_PRIMARY_ADDRESS, TEST_PRIMARY_ADDRESS],
      })
    );
  });

  it("rejects withdraw shares above maxRedeem tolerance", async () => {
    const maxRedeem = 1_000_000_000_000_000_000n;
    const tolerance = maxRedeem / 10_000n;

    mockReadContract.mockResolvedValueOnce(maxRedeem);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useVaultWithdraw(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          gardenAddress: TEST_GARDEN as `0x${string}`,
          assetAddress: TEST_ASSET as `0x${string}`,
          vaultAddress: TEST_VAULT as `0x${string}`,
          shares: maxRedeem + tolerance + 1n,
        })
      ).rejects.toThrow("Withdrawal amount exceeds the redeemable limit");
    });

    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it("calls OctantModule.harvest for harvest mutation", async () => {
    mockWriteContractAsync.mockResolvedValue(
      "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useHarvest(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: TEST_GARDEN as `0x${string}`,
        assetAddress: TEST_ASSET as `0x${string}`,
      });
    });

    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_OCTANT_MODULE,
        functionName: "harvest",
      })
    );
  });

  it("calls OctantModule.emergencyPause for emergency mutation", async () => {
    mockWriteContractAsync.mockResolvedValue(
      "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useEmergencyPause(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: TEST_GARDEN as `0x${string}`,
        assetAddress: TEST_ASSET as `0x${string}`,
      });
    });

    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_OCTANT_MODULE,
        functionName: "emergencyPause",
      })
    );
  });

  it("routes through smartAccountClient when authMode is passkey", async () => {
    const mockSendTransaction = vi
      .fn()
      .mockResolvedValue("0x1111111111111111111111111111111111111111111111111111111111111111");
    mockUser.authMode = "passkey";
    mockUser.smartAccountClient = {
      account: { address: TEST_PRIMARY_ADDRESS },
      chain: { id: TEST_CHAIN_ID },
      sendTransaction: mockSendTransaction,
    };

    // Read sequence (no minSharesOut → early slippage check skipped):
    // maxDeposit, allowance (sufficient), post-approval previewDeposit
    mockReadContract
      .mockResolvedValueOnce(100n)
      .mockResolvedValueOnce(100n)
      .mockResolvedValueOnce(10n);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useVaultDeposit(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: TEST_GARDEN as `0x${string}`,
        assetAddress: TEST_ASSET as `0x${string}`,
        vaultAddress: TEST_VAULT as `0x${string}`,
        amount: 10n,
      });
    });

    expect(mockWriteContractAsync).not.toHaveBeenCalled();
    expect(mockSendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        to: TEST_VAULT,
        value: 0n,
      })
    );
  });

  it("uses createMutationErrorHandler when a mutation fails", async () => {
    mockReadContract.mockRejectedValueOnce(new Error("boom"));

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useVaultDeposit(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          gardenAddress: TEST_GARDEN as `0x${string}`,
          assetAddress: TEST_ASSET as `0x${string}`,
          vaultAddress: TEST_VAULT as `0x${string}`,
          amount: 10n,
        })
      ).rejects.toThrow("boom");
    });

    expect(mockErrorHandler).toHaveBeenCalled();
  });

  it("passes showToast=false to error handler in inline mode", async () => {
    mockReadContract.mockRejectedValueOnce(new Error("boom"));

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useVaultDeposit({ errorMode: "inline" }), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          gardenAddress: TEST_GARDEN as `0x${string}`,
          assetAddress: TEST_ASSET as `0x${string}`,
          vaultAddress: TEST_VAULT as `0x${string}`,
          amount: 10n,
        })
      ).rejects.toThrow("boom");
    });

    expect(mockErrorHandler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ showToast: false })
    );
  });
});
