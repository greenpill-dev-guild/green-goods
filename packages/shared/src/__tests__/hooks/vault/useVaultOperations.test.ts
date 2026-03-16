/**
 * useVaultOperations Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock matchMedia before any module imports that touch theme system
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const TEST_CHAIN_ID = 11155111;
const TEST_PRIMARY_ADDRESS = "0x1111111111111111111111111111111111111111";
const TEST_GARDEN = "0x2222222222222222222222222222222222222222";
const TEST_ASSET = "0x3333333333333333333333333333333333333333";
const TEST_VAULT = "0x4444444444444444444444444444444444444444";
const TEST_OCTANT_MODULE = "0x5555555555555555555555555555555555555555";

const mockSendContractCall = vi.fn();
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

let mockTransactionSender: {
  sendContractCall: typeof mockSendContractCall;
  supportsSponsorship: boolean;
  supportsBatching: boolean;
  authMode: string;
} | null = null;

vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => mockTransactionSender,
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
  "app.treasury.enableAutoAllocate": "Enable auto-allocation",
  "app.treasury.enablingAutoAllocate": "Enabling auto-allocation",
  "app.treasury.enableAutoAllocateSuccess": "Auto-allocation enabled",
  "app.treasury.depositSuccess": "Deposit successful",
  "app.treasury.withdrawSuccess": "Withdraw successful",
  "app.treasury.harvestSuccess": "Harvest successful",
  "app.treasury.approving": "Approving",
  "app.treasury.depositing": "Depositing",
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
const { useVaultDeposit, useVaultWithdraw, useHarvest, useEmergencyPause, useEnableAutoAllocate } =
  operationsModule;

describe("hooks/vault/useVaultOperations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMutationErrorHandler.mockReturnValue(mockErrorHandler);
    mockUser.authMode = "wallet";
    mockUser.smartAccountClient = null;
    mockUser.primaryAddress = TEST_PRIMARY_ADDRESS;
    mockSendContractCall.mockResolvedValue({
      hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      sponsored: false,
    });
    mockTransactionSender = {
      sendContractCall: mockSendContractCall,
      supportsSponsorship: false,
      supportsBatching: false,
      authMode: "wallet",
    };
  });

  it("runs two-step deposit flow (approve -> deposit) when allowance is insufficient", async () => {
    // Read sequence (no minSharesOut -> early slippage check skipped):
    // 1) maxDeposit, 2) preApprovalPreview, 3) allowance, 4) refreshed allowance, 5) post-approval previewDeposit
    mockReadContract
      .mockResolvedValueOnce(100n) // maxDeposit
      .mockResolvedValueOnce(10n) // preApprovalPreview
      .mockResolvedValueOnce(0n) // allowance (insufficient)
      .mockResolvedValueOnce(10n) // refreshed allowance
      .mockResolvedValueOnce(10n); // post-approval previewDeposit

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

    // readContract: maxDeposit + preApprovalPreview + allowance + refreshed allowance + post-approval previewDeposit
    expect(mockReadContract).toHaveBeenCalledTimes(5);
    expect(mockReadContract).toHaveBeenNthCalledWith(
      3,
      expect.anything(),
      expect.objectContaining({
        address: TEST_ASSET,
        functionName: "allowance",
        args: [TEST_PRIMARY_ADDRESS, TEST_VAULT],
      })
    );
    expect(mockSendContractCall).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        address: TEST_ASSET,
        functionName: "approve",
      })
    );
    expect(mockSendContractCall).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        address: TEST_VAULT,
        functionName: "deposit",
      })
    );
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("skips approve when allowance is already sufficient", async () => {
    // Read sequence (no minSharesOut -> early slippage check skipped):
    // maxDeposit, preApprovalPreview, allowance (sufficient), post-approval previewDeposit
    mockReadContract
      .mockResolvedValueOnce(100n) // maxDeposit
      .mockResolvedValueOnce(10n) // preApprovalPreview
      .mockResolvedValueOnce(100n) // allowance (sufficient)
      .mockResolvedValueOnce(10n); // post-approval previewDeposit

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

    expect(mockSendContractCall).toHaveBeenCalledTimes(1);
    expect(mockSendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "deposit",
      })
    );
  });

  it("detects slippage when exchange rate moves during approval", async () => {
    // Read sequence: maxDeposit, preApprovalPreview (high), allowance (sufficient), post-approval previewDeposit (low)
    mockReadContract
      .mockResolvedValueOnce(100n) // maxDeposit
      .mockResolvedValueOnce(100n) // preApprovalPreview: 100 shares expected
      .mockResolvedValueOnce(100n) // allowance (sufficient)
      .mockResolvedValueOnce(90n); // post-approval: only 90 shares (>1% drop from 100)

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
      ).rejects.toThrow("Exchange rate moved unfavorably during approval");
    });

    // Should not have sent deposit tx
    expect(mockSendContractCall).not.toHaveBeenCalled();
  });

  it("runs single-step withdraw flow using withdraw", async () => {
    // maxWithdraw pre-check
    mockReadContract.mockResolvedValueOnce(100n);

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

    expect(mockSendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_VAULT,
        functionName: "withdraw",
      })
    );
  });

  it("clamps withdraw amount to maxWithdraw when within tolerance", async () => {
    const maxWithdraw = 1_000_000_000_000_000_000n;

    // maxWithdraw pre-check returns the limit
    mockReadContract.mockResolvedValueOnce(maxWithdraw);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useVaultWithdraw(), {
      wrapper: createWrapper(queryClient),
    });

    // Withdraw exactly at the maxWithdraw limit should succeed
    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: TEST_GARDEN as `0x${string}`,
        assetAddress: TEST_ASSET as `0x${string}`,
        vaultAddress: TEST_VAULT as `0x${string}`,
        amount: maxWithdraw,
      });
    });

    expect(mockSendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "withdraw",
      })
    );
  });

  it("rejects withdraw amount above maxWithdraw", async () => {
    const maxWithdraw = 1_000_000_000_000_000_000n;

    // maxWithdraw pre-check returns the limit
    mockReadContract.mockResolvedValueOnce(maxWithdraw);

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
          amount: maxWithdraw + 1n,
        })
      ).rejects.toThrow("Withdrawal amount exceeds the available balance");
    });

    expect(mockSendContractCall).not.toHaveBeenCalled();
  });

  it("calls OctantModule.harvest for harvest mutation", async () => {
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

    expect(mockSendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_OCTANT_MODULE,
        functionName: "harvest",
      })
    );
  });

  it("calls OctantModule.emergencyPause for emergency mutation", async () => {
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

    expect(mockSendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_OCTANT_MODULE,
        functionName: "emergencyPause",
      })
    );
  });

  it("calls OctantModule.enableAutoAllocate for recovery mutation", async () => {
    mockReadContract.mockResolvedValueOnce(TEST_PRIMARY_ADDRESS);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useEnableAutoAllocate(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: TEST_GARDEN as `0x${string}`,
        assetAddress: TEST_ASSET as `0x${string}`,
      });
    });

    expect(mockReadContract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        address: TEST_OCTANT_MODULE,
        functionName: "owner",
      })
    );
    expect(mockSendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_OCTANT_MODULE,
        functionName: "enableAutoAllocate",
      })
    );
  });

  it("invalidates readContracts queries on enableAutoAllocate success", async () => {
    mockReadContract.mockResolvedValueOnce(TEST_PRIMARY_ADDRESS);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useEnableAutoAllocate(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: TEST_GARDEN as `0x${string}`,
        assetAddress: TEST_ASSET as `0x${string}`,
      });
    });

    // Should invalidate both indexed vault queries AND wagmi contract reads
    const predicateCalls = invalidateSpy.mock.calls.filter(
      (call) => call[0] && typeof call[0] === "object" && "predicate" in call[0]
    );
    expect(predicateCalls.length).toBeGreaterThan(0);
  });

  it("rejects enableAutoAllocate when caller is not module owner", async () => {
    mockReadContract.mockResolvedValueOnce("0x9999999999999999999999999999999999999999");

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useEnableAutoAllocate(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          gardenAddress: TEST_GARDEN as `0x${string}`,
          assetAddress: TEST_ASSET as `0x${string}`,
        })
      ).rejects.toThrow("Only the OctantModule owner can enable auto-allocate");
    });

    expect(mockSendContractCall).not.toHaveBeenCalled();
  });

  it("routes through sender when authMode is passkey", async () => {
    const mockPasskeySendContractCall = vi.fn().mockResolvedValue({
      hash: "0x1111111111111111111111111111111111111111111111111111111111111111",
      sponsored: true,
    });
    mockTransactionSender = {
      sendContractCall: mockPasskeySendContractCall,
      supportsSponsorship: true,
      supportsBatching: false,
      authMode: "passkey",
    };
    mockUser.authMode = "passkey";
    mockUser.smartAccountClient = {
      account: { address: TEST_PRIMARY_ADDRESS },
      chain: { id: TEST_CHAIN_ID },
    };

    // Read sequence (no minSharesOut -> early slippage check skipped):
    // maxDeposit, preApprovalPreview, allowance (sufficient), post-approval previewDeposit
    mockReadContract
      .mockResolvedValueOnce(100n) // maxDeposit
      .mockResolvedValueOnce(10n) // preApprovalPreview
      .mockResolvedValueOnce(100n) // allowance (sufficient)
      .mockResolvedValueOnce(10n); // post-approval previewDeposit

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

    // The wallet-level mock should NOT have been called
    expect(mockSendContractCall).not.toHaveBeenCalled();
    // The passkey sender should have been called for the deposit
    expect(mockPasskeySendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_VAULT,
        functionName: "deposit",
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

  it("logs VaultDepositStageError diagnostics through error handler in toast mode", async () => {
    // maxDeposit returns 0 → triggers diagnostic reads
    mockReadContract
      .mockResolvedValueOnce(0n) // maxDeposit = 0
      .mockResolvedValueOnce(true) // isShutdown = true
      .mockResolvedValueOnce(0n) // depositLimit
      .mockResolvedValueOnce(0n); // totalAssets

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
      ).rejects.toThrow();
    });

    // Toast should be shown (default errorMode = "auto" → showErrorToast = true)
    expect(toastService.error).toHaveBeenCalled();
    // Error handler should ALSO be called with diagnostics metadata
    expect(mockErrorHandler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({
          vaultAddress: TEST_VAULT,
          isShutdown: "true",
        }),
        showToast: false,
      })
    );
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
