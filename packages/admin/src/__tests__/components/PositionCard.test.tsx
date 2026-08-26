/**
 * PositionCard Vault Component Tests
 *
 * Tests the vault position card that displays deposit stats,
 * yield info, and steward management actions (harvest/distribute, emergency pause).
 */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders as render } from "../test-utils";

const mockHarvestDistributionMutate = vi.fn();
const mockHarvestDistributionReset = vi.fn();
const mockPauseMutate = vi.fn();
const mockEnableAutoAllocateMutate = vi.fn();
const mockUseVaultPreview = vi.fn().mockReturnValue({ preview: null });
const mockUseReadContracts = vi.fn().mockReturnValue({ data: undefined, refetch: vi.fn() });
const mockYieldRefetch = vi.fn();
let mockYieldStatus: Record<string, unknown>;
let mockHarvestDistribution: Record<string, unknown>;

vi.mock("wagmi", () => ({
  useReadContracts: (...args: unknown[]) => mockUseReadContracts(...args),
}));

vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: "0xUserAddress1234567890abcdef1234567890abcdef" }),
}));

vi.mock("@green-goods/shared/hooks/vault/useEmergencyPause", () => ({
  useEmergencyPause: () => ({ mutate: mockPauseMutate, isPending: false }),
}));

vi.mock("@green-goods/shared/hooks/vault/useEnableAutoAllocate", () => ({
  useEnableAutoAllocate: () => ({ mutate: mockEnableAutoAllocateMutate, isPending: false }),
}));

vi.mock("@green-goods/shared/hooks/yield/useHarvestDistribution", () => ({
  useHarvestDistribution: () => mockHarvestDistribution,
}));

vi.mock("@green-goods/shared/hooks/yield/useYieldStatus", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/hooks/yield/useYieldStatus")>()),
  useYieldStatus: () => mockYieldStatus,
}));

vi.mock("@green-goods/shared/hooks/vault/useVaultPreview", () => ({
  useVaultPreview: (...args: unknown[]) => mockUseVaultPreview(...args),
}));

vi.mock("@green-goods/shared/utils/blockchain/abis/octant", () => ({
  OCTANT_VAULT_ABI: [],
}));

vi.mock("@green-goods/shared/utils/blockchain/address", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@green-goods/shared/utils/blockchain/address")>();
  return {
    ...actual,
    ZERO_ADDRESS: "0x0000000000000000000000000000000000000000",
  };
});

vi.mock("@green-goods/shared/utils/blockchain/vaults", () => ({
  formatTokenAmount: (value: bigint, decimals?: number) => {
    if (value === 0n) return "0";
    // Simple formatting for tests
    return `${Number(value) / 10 ** (decimals ?? 18)}`;
  },
  getNetDeposited: (deposited: bigint, withdrawn: bigint) => deposited - withdrawn,
  getVaultAssetDecimals: () => 18,
  getVaultAssetSymbol: () => "USDC",
}));

import { PositionCard } from "../../components/Vault/PositionCard";

const mockVault = {
  asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  vaultAddress: "0xVault1234567890abcdef1234567890abcdef1234",
  chainId: 11155111,
  totalDeposited: 1000000000000000000n, // 1 token
  totalWithdrawn: 0n,
  depositorCount: 5,
  totalHarvestCount: 2,
  paused: false,
};

const defaultProps = {
  gardenAddress: "0xGarden1234567890abcdef1234567890abcdef" as any,
  vault: mockVault as any,
  canManage: false,
  canEmergencyPause: false,
  isModuleOwner: false,
  onDeposit: vi.fn(),
  onWithdraw: vi.fn(),
};

describe("PositionCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseVaultPreview.mockReturnValue({ preview: null });
    mockYieldRefetch.mockResolvedValue(undefined);
    mockYieldStatus = {
      status: "empty",
      registeredShares: 0n,
      registeredShareAssets: 0n,
      pendingYield: 0n,
      totalAvailable: 0n,
      threshold: 7n * 10n ** 18n,
      escrowedFractions: 0n,
      isVaultRegistered: true,
      splitConfig: { cookieJarBps: 4865, fractionsBps: 4865, juiceboxBps: 270 },
      destination: {
        address: "0x4444444444444444444444444444444444444444",
        kind: "cookie_jar",
      },
      destinationVerified: true,
      estimatedDistribution: {
        cookieJarAmount: 0n,
        fractionsAmount: 0n,
        treasuryAmount: 0n,
        totalAmount: 0n,
      },
      isLoading: false,
      isError: false,
      refetch: mockYieldRefetch,
    };
    mockHarvestDistribution = {
      mutate: mockHarvestDistributionMutate,
      reset: mockHarvestDistributionReset,
      isPending: false,
      data: undefined,
      stage: "idle",
    };
  });

  describe("rendering", () => {
    it("renders the asset symbol as heading", () => {
      render(createElement(PositionCard, defaultProps));

      expect(screen.getByText("USDC")).toBeInTheDocument();
    });

    it("shows depositor count", () => {
      render(createElement(PositionCard, defaultProps));

      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("shows harvest count", () => {
      render(createElement(PositionCard, defaultProps));

      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("does not show deposits disabled badge when vault is accepting deposits", () => {
      mockUseVaultPreview.mockReturnValue({ preview: { maxDeposit: 1000n, totalAssets: 0n } });
      render(createElement(PositionCard, defaultProps));

      expect(screen.queryByText("Deposits disabled")).not.toBeInTheDocument();
    });

    it("shows deposits disabled badge when vault is not accepting deposits", () => {
      mockUseVaultPreview.mockReturnValue({ preview: { maxDeposit: 0n, totalAssets: 0n } });
      render(createElement(PositionCard, defaultProps));

      expect(screen.getByText("Deposits disabled")).toBeInTheDocument();
    });

    it("shows the impact-yield helper copy", () => {
      render(createElement(PositionCard, defaultProps));

      expect(
        screen.getByText(/Depositor share value is expected to stay near flat by design/i)
      ).toBeInTheDocument();
    });
  });

  describe("deposit and withdraw buttons", () => {
    it("shows deposit and withdraw buttons", () => {
      render(createElement(PositionCard, defaultProps));

      expect(screen.getByText("Deposit")).toBeInTheDocument();
      expect(screen.getByText("Withdraw")).toBeInTheDocument();
    });

    it("calls onDeposit with asset address when deposit clicked", async () => {
      const onDeposit = vi.fn();
      const user = userEvent.setup();

      render(createElement(PositionCard, { ...defaultProps, onDeposit }));

      await user.click(screen.getByText("Deposit"));
      expect(onDeposit).toHaveBeenCalledWith(mockVault.asset);
    });

    it("calls onWithdraw with asset address when withdraw clicked", async () => {
      const onWithdraw = vi.fn();
      const user = userEvent.setup();

      render(createElement(PositionCard, { ...defaultProps, onWithdraw }));

      await user.click(screen.getByText("Withdraw"));
      expect(onWithdraw).toHaveBeenCalledWith(mockVault.asset);
    });
  });

  describe("steward management actions", () => {
    it("does not show management buttons when canManage is false", () => {
      render(createElement(PositionCard, defaultProps));

      expect(screen.queryByText("Harvest & distribute")).not.toBeInTheDocument();
      expect(screen.queryByText("Distribute yield")).not.toBeInTheDocument();
      expect(screen.queryByText("Emergency pause")).not.toBeInTheDocument();
    });

    it("shows harvest-and-distribute and emergency pause actions for current yield", () => {
      mockUseVaultPreview.mockReturnValue({
        preview: { maxDeposit: 1000n, totalAssets: 2_000_000_000_000_000_000n },
      });
      render(createElement(PositionCard, { ...defaultProps, canManage: true }));

      expect(screen.getByText("Harvest & distribute")).toBeInTheDocument();
      expect(screen.getByText("Emergency pause")).toBeInTheDocument();
    });

    it("opens a destination-aware confirmation before starting the workflow", async () => {
      mockUseVaultPreview.mockReturnValue({
        preview: { maxDeposit: 1000n, totalAssets: 2_000_000_000_000_000_000n },
      });
      const user = userEvent.setup();

      render(
        createElement(PositionCard, {
          ...defaultProps,
          canManage: true,
        })
      );

      await user.click(screen.getByText("Harvest & distribute"));

      expect(screen.getByText("Harvest and distribute yield")).toBeInTheDocument();
      expect(screen.getByText(/Cookie Jar.*0x4444/i)).toBeInTheDocument();
      expect(screen.getByText(/two wallet confirmations/i)).toBeInTheDocument();
      expect(mockHarvestDistributionMutate).not.toHaveBeenCalled();

      const confirmButtons = screen.getAllByText("Harvest & distribute");
      await user.click(confirmButtons[confirmButtons.length - 1]);
      expect(mockHarvestDistributionMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          gardenAddress: defaultProps.gardenAddress,
          assetAddress: mockVault.asset,
          vaultAddress: mockVault.vaultAddress,
          assetSymbol: "USDC",
          harvestFirst: true,
        }),
        expect.objectContaining({ onSettled: expect.any(Function) })
      );
    });

    it("opens the harvest confirmation from the keyboard", async () => {
      mockUseVaultPreview.mockReturnValue({
        preview: { maxDeposit: 1000n, totalAssets: 2_000_000_000_000_000_000n },
      });
      const user = userEvent.setup();

      render(createElement(PositionCard, { ...defaultProps, canManage: true }));

      const action = screen.getByRole("button", { name: "Harvest & distribute" });
      action.focus();
      await user.keyboard("{Enter}");

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Harvest and distribute yield")).toBeInTheDocument();
    });

    it("offers distribution without harvesting when registered yield is ready", () => {
      mockYieldStatus = {
        ...mockYieldStatus,
        status: "ready",
        totalAvailable: 10n * 10n ** 18n,
        estimatedDistribution: {
          cookieJarAmount: 4_865_000_000_000_000_000n,
          fractionsAmount: 4_865_000_000_000_000_000n,
          treasuryAmount: 270_000_000_000_000_000n,
          totalAmount: 10n * 10n ** 18n,
        },
      };

      render(createElement(PositionCard, { ...defaultProps, canManage: true }));

      expect(screen.getByText("Distribute yield")).toBeInTheDocument();
      expect(screen.queryByText("Harvest & distribute")).not.toBeInTheDocument();
    });

    it("shows below-threshold yield as waiting without an enabled distribution action", () => {
      mockYieldStatus = {
        ...mockYieldStatus,
        status: "waiting",
        totalAvailable: 2n * 10n ** 18n,
      };

      render(createElement(PositionCard, { ...defaultProps, canManage: true }));

      expect(screen.getByText(/2 USDC is waiting/i)).toBeInTheDocument();
      expect(screen.getByText(/7 USDC minimum/i)).toBeInTheDocument();
      expect(screen.queryByText("Distribute yield")).not.toBeInTheDocument();
    });

    it("routes the split-only retry through a fresh destination-aware confirmation", async () => {
      mockHarvestDistribution = {
        ...mockHarvestDistribution,
        data: { status: "distribution_pending", harvested: true, errorCategory: "blockchain" },
        stage: "distribution_pending",
      };
      const user = userEvent.setup();

      render(createElement(PositionCard, { ...defaultProps, canManage: true }));

      expect(
        screen.getByText(/Harvest confirmed, but distribution is still pending/i)
      ).toBeInTheDocument();
      await user.click(screen.getByText("Retry distribution"));

      // The retry must not fire the mutation directly: routing can change
      // while the alert is visible, so it reopens the confirmation instead.
      expect(mockHarvestDistributionMutate).not.toHaveBeenCalled();
      expect(screen.getByText("Harvest and distribute yield")).toBeInTheDocument();
      expect(mockYieldRefetch).toHaveBeenCalled();

      await user.click(screen.getByText("Distribute yield"));
      expect(mockHarvestDistributionMutate).toHaveBeenCalledWith(
        expect.objectContaining({ harvestFirst: false }),
        expect.objectContaining({ onSettled: expect.any(Function) })
      );
    });

    it("explains when a Safe harvest is submitted but not yet confirmed", () => {
      mockHarvestDistribution = {
        ...mockHarvestDistribution,
        data: { status: "harvest_submitted", hash: "safe-proposal-123" },
        stage: "submitted",
      };

      render(createElement(PositionCard, { ...defaultProps, canManage: true }));

      expect(screen.getByText(/Harvest was submitted for execution/i)).toBeInTheDocument();
      expect(screen.queryByText("Retry distribution")).not.toBeInTheDocument();
    });

    it("reports exact confirmed amounts from the distribution event", () => {
      mockHarvestDistribution = {
        ...mockHarvestDistribution,
        data: {
          status: "distributed",
          hash: `0x${"a".repeat(64)}`,
          amounts: {
            cookieJarAmount: 4n * 10n ** 18n,
            fractionsAmount: 4n * 10n ** 18n,
            treasuryAmount: 2n * 10n ** 18n,
            totalAmount: 10n * 10n ** 18n,
          },
        },
        stage: "complete",
      };

      render(createElement(PositionCard, { ...defaultProps, canManage: true }));

      expect(screen.getByText(/4 USDC was allocated to the Cookie Jar/i)).toBeInTheDocument();
      expect(screen.getByText(/4 USDC to hypercert funding/i)).toBeInTheDocument();
      expect(screen.getByText(/2 USDC to the protocol treasury/i)).toBeInTheDocument();
    });

    it("refreshes yield state when the confirmation opens", async () => {
      mockUseVaultPreview.mockReturnValue({
        preview: { maxDeposit: 1000n, totalAssets: 2_000_000_000_000_000_000n },
      });
      const user = userEvent.setup();

      render(createElement(PositionCard, { ...defaultProps, canManage: true }));

      await user.click(screen.getByText("Harvest & distribute"));

      expect(mockYieldRefetch).toHaveBeenCalled();
    });

    it("keeps the harvest action available when vault gains are not yet reported", async () => {
      // No preview delta and empty registered yield: strategy appreciation is
      // invisible until process_report(), so the harvest path must remain.
      const user = userEvent.setup();

      render(createElement(PositionCard, { ...defaultProps, canManage: true }));

      const action = screen.getByText("Harvest & distribute");
      await user.click(action);
      const confirmButtons = screen.getAllByText("Harvest & distribute");
      await user.click(confirmButtons[confirmButtons.length - 1]);

      expect(mockHarvestDistributionMutate).toHaveBeenCalledWith(
        expect.objectContaining({ harvestFirst: true }),
        expect.objectContaining({ onSettled: expect.any(Function) })
      );
    });

    it("lets the admin dismiss a terminal outcome to start another distribution", async () => {
      mockHarvestDistribution = {
        ...mockHarvestDistribution,
        data: {
          status: "distributed",
          hash: `0x${"a".repeat(64)}`,
          amounts: {
            cookieJarAmount: 4n * 10n ** 18n,
            fractionsAmount: 4n * 10n ** 18n,
            treasuryAmount: 2n * 10n ** 18n,
            totalAmount: 10n * 10n ** 18n,
          },
        },
        stage: "complete",
      };
      const user = userEvent.setup();

      render(createElement(PositionCard, { ...defaultProps, canManage: true }));

      await user.click(screen.getByRole("button", { name: "Close" }));

      expect(mockHarvestDistributionReset).toHaveBeenCalled();
    });

    it("explains an incomplete harvest and routes the retry through confirmation", async () => {
      mockHarvestDistribution = {
        ...mockHarvestDistribution,
        data: {
          status: "harvest_incomplete",
          hash: `0x${"c".repeat(64)}`,
          failure: "report_failed",
        },
        stage: "harvest_incomplete",
      };
      const user = userEvent.setup();

      render(createElement(PositionCard, { ...defaultProps, canManage: true }));

      expect(screen.getByText(/the vault could not report new yield/i)).toBeInTheDocument();
      await user.click(screen.getByText("Retry harvest"));

      expect(mockHarvestDistributionMutate).not.toHaveBeenCalled();
      expect(screen.getByText("Harvest and distribute yield")).toBeInTheDocument();

      await user.click(screen.getByText("Harvest & distribute"));
      expect(mockHarvestDistributionMutate).toHaveBeenCalledWith(
        expect.objectContaining({ harvestFirst: true }),
        expect.objectContaining({ onSettled: expect.any(Function) })
      );
    });

    it("reconciles unresolved outcomes instead of offering a plain dismissal", async () => {
      // Safe submissions and unverified splits must not be clearable without
      // refetching state — a bare dismiss would re-expose the action while
      // the transaction outcome is unknown.
      mockHarvestDistribution = {
        ...mockHarvestDistribution,
        data: { status: "split_unverified", hash: `0x${"d".repeat(64)}`, harvested: true },
        stage: "split_unverified",
      };
      const user = userEvent.setup();

      render(createElement(PositionCard, { ...defaultProps, canManage: true }));

      expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
      await user.click(screen.getByText("Check status"));

      expect(mockYieldRefetch).toHaveBeenCalled();
      await waitFor(() => expect(mockHarvestDistributionReset).toHaveBeenCalled());
    });

    it("keeps a pending Safe submission until refetched state actually changes", async () => {
      // A pending proposal has no on-chain signal: an unchanged refetch must
      // not clear the outcome, or the operator could file a duplicate.
      mockHarvestDistribution = {
        ...mockHarvestDistribution,
        data: { status: "harvest_submitted", hash: "safe-proposal-123" },
        stage: "submitted",
      };
      const user = userEvent.setup();

      const { rerender } = render(
        createElement(PositionCard, { ...defaultProps, canManage: true })
      );

      await user.click(screen.getByText("Check status"));
      expect(mockYieldRefetch).toHaveBeenCalled();
      expect(mockHarvestDistributionReset).not.toHaveBeenCalled();

      // The Safe proposal executes: refreshed yield state now differs.
      mockYieldStatus = { ...mockYieldStatus, totalAvailable: 9n * 10n ** 18n };
      rerender(createElement(PositionCard, { ...defaultProps, canManage: true }));

      await waitFor(() => expect(mockHarvestDistributionReset).toHaveBeenCalled());
    });

    it("explains a reverted harvest and keeps the retry available", () => {
      mockHarvestDistribution = {
        ...mockHarvestDistribution,
        data: {
          status: "harvest_incomplete",
          hash: `0x${"c".repeat(64)}`,
          failure: "reverted",
        },
        stage: "harvest_incomplete",
      };

      render(createElement(PositionCard, { ...defaultProps, canManage: true }));

      expect(screen.getByText(/the harvest itself did not execute/i)).toBeInTheDocument();
      expect(screen.getByText("Retry harvest")).toBeInTheDocument();
    });

    it("offers no harvest retry for a failed shares registration", () => {
      // Re-harvesting snapshots the resolver balance including the stuck
      // shares, so it cannot recover a failed registration.
      mockHarvestDistribution = {
        ...mockHarvestDistribution,
        data: {
          status: "harvest_incomplete",
          hash: `0x${"c".repeat(64)}`,
          failure: "registration_failed",
        },
        stage: "harvest_incomplete",
      };

      render(createElement(PositionCard, { ...defaultProps, canManage: true }));

      expect(screen.getByText(/resolver owner needs to register or recover/i)).toBeInTheDocument();
      expect(screen.queryByText("Retry harvest")).not.toBeInTheDocument();
    });

    it("follows refreshed yield state when choosing harvest vs split-only", async () => {
      // Opened in an empty state (harvest-first); the refresh reveals the
      // registered yield is now ready, so confirming must send split-only.
      const user = userEvent.setup();

      const { rerender } = render(
        createElement(PositionCard, { ...defaultProps, canManage: true })
      );
      await user.click(screen.getByText("Harvest & distribute"));

      mockYieldStatus = {
        ...mockYieldStatus,
        status: "ready",
        totalAvailable: 10n * 10n ** 18n,
      };
      rerender(createElement(PositionCard, { ...defaultProps, canManage: true }));

      const confirmButtons = screen.getAllByText("Distribute yield");
      await user.click(confirmButtons[confirmButtons.length - 1]);
      expect(mockHarvestDistributionMutate).toHaveBeenCalledWith(
        expect.objectContaining({ harvestFirst: false }),
        expect.objectContaining({ onSettled: expect.any(Function) })
      );
    });

    it("keeps confirmation locked while the destination cannot be verified", async () => {
      mockUseVaultPreview.mockReturnValue({
        preview: { maxDeposit: 1000n, totalAssets: 2_000_000_000_000_000_000n },
      });
      const user = userEvent.setup();

      const { rerender } = render(
        createElement(PositionCard, { ...defaultProps, canManage: true })
      );
      await user.click(screen.getByText("Harvest & distribute"));

      mockYieldStatus = { ...mockYieldStatus, destinationVerified: false };
      rerender(createElement(PositionCard, { ...defaultProps, canManage: true }));

      const confirmButtons = screen.getAllByText("Harvest & distribute");
      const confirmButton = confirmButtons[confirmButtons.length - 1].closest("button");
      expect(confirmButton).toBeDisabled();
    });

    it("keeps confirmation disabled when refreshed yield state turns erroneous", async () => {
      mockUseVaultPreview.mockReturnValue({
        preview: { maxDeposit: 1000n, totalAssets: 2_000_000_000_000_000_000n },
      });
      const user = userEvent.setup();

      const { rerender } = render(
        createElement(PositionCard, { ...defaultProps, canManage: true })
      );
      await user.click(screen.getByText("Harvest & distribute"));

      // The refresh triggered by opening surfaces an error: confirm must lock.
      mockYieldStatus = { ...mockYieldStatus, isError: true, status: "error" };
      rerender(createElement(PositionCard, { ...defaultProps, canManage: true }));

      const confirmButtons = screen.getAllByText("Harvest & distribute");
      const confirmButton = confirmButtons[confirmButtons.length - 1].closest("button");
      expect(confirmButton).toBeDisabled();
    });

    it("reports an unverified split without offering a distribution retry", () => {
      mockHarvestDistribution = {
        ...mockHarvestDistribution,
        data: { status: "split_unverified", hash: `0x${"d".repeat(64)}`, harvested: true },
        stage: "split_unverified",
      };

      render(createElement(PositionCard, { ...defaultProps, canManage: true }));

      expect(screen.getByText(/its result could not be read back yet/i)).toBeInTheDocument();
      expect(screen.queryByText("Retry distribution")).not.toBeInTheDocument();
    });
  });

  describe("auto-allocation recovery", () => {
    it("shows enable auto-allocation action for legacy misconfiguration (deposit limit zero, not shutdown)", () => {
      mockUseVaultPreview.mockReturnValue({ preview: { maxDeposit: 0n, totalAssets: 0n } });
      // Diagnostic reads: isShutdown=false, depositLimit=0n
      mockUseReadContracts.mockReturnValue({
        data: [
          { status: "success", result: false }, // isShutdown
          { status: "success", result: 0n }, // depositLimit
        ],
        refetch: vi.fn(),
      });

      render(
        createElement(PositionCard, {
          ...defaultProps,
          isModuleOwner: true,
        })
      );

      expect(screen.getByText("Enable auto-allocation")).toBeInTheDocument();
    });

    it("does NOT show CTA when vault is shutdown even if maxDeposit is 0", () => {
      mockUseVaultPreview.mockReturnValue({ preview: { maxDeposit: 0n, totalAssets: 0n } });
      // Diagnostic reads: isShutdown=true, depositLimit=0n
      mockUseReadContracts.mockReturnValue({
        data: [
          { status: "success", result: true }, // isShutdown
          { status: "success", result: 0n }, // depositLimit
        ],
        refetch: vi.fn(),
      });

      render(
        createElement(PositionCard, {
          ...defaultProps,
          isModuleOwner: true,
        })
      );

      expect(screen.queryByText("Enable auto-allocation")).not.toBeInTheDocument();
    });

    it("does NOT show CTA when deposit limit is non-zero (vault is full, not misconfigured)", () => {
      mockUseVaultPreview.mockReturnValue({ preview: { maxDeposit: 0n, totalAssets: 0n } });
      // Diagnostic reads: isShutdown=false, depositLimit=1000n (full, not misconfigured)
      mockUseReadContracts.mockReturnValue({
        data: [
          { status: "success", result: false }, // isShutdown
          { status: "success", result: 1000n }, // depositLimit (non-zero = properly configured)
        ],
        refetch: vi.fn(),
      });

      render(
        createElement(PositionCard, {
          ...defaultProps,
          isModuleOwner: true,
        })
      );

      expect(screen.queryByText("Enable auto-allocation")).not.toBeInTheDocument();
    });

    it("calls enableAutoAllocate when the recovery action is clicked", async () => {
      mockUseVaultPreview.mockReturnValue({ preview: { maxDeposit: 0n, totalAssets: 0n } });
      mockUseReadContracts.mockReturnValue({
        data: [
          { status: "success", result: false },
          { status: "success", result: 0n },
        ],
        refetch: vi.fn(),
      });
      const user = userEvent.setup();

      render(
        createElement(PositionCard, {
          ...defaultProps,
          isModuleOwner: true,
        })
      );

      await user.click(screen.getByText("Enable auto-allocation"));

      expect(mockEnableAutoAllocateMutate).toHaveBeenCalledWith(
        { gardenAddress: defaultProps.gardenAddress, assetAddress: mockVault.asset },
        expect.objectContaining({ onSuccess: expect.any(Function) })
      );
    });
  });

  describe("emergency pause dialog", () => {
    it("opens confirmation dialog when emergency pause clicked", async () => {
      const user = userEvent.setup();

      render(
        createElement(PositionCard, {
          ...defaultProps,
          canManage: true,
          canEmergencyPause: true,
        })
      );

      await user.click(screen.getByText("Emergency pause"));

      // Confirmation dialog should appear
      expect(screen.getByText("Confirm emergency pause")).toBeInTheDocument();
    });

    it("calls emergency pause mutation on confirm", async () => {
      const user = userEvent.setup();

      render(
        createElement(PositionCard, {
          ...defaultProps,
          canManage: true,
          canEmergencyPause: true,
        })
      );

      // Open dialog
      await user.click(screen.getByText("Emergency pause"));

      // Find the confirm button in the dialog (second "Emergency pause" text)
      const buttons = screen.getAllByText("Emergency pause");
      const confirmButton = buttons[buttons.length - 1];
      await user.click(confirmButton);

      expect(mockPauseMutate).toHaveBeenCalledWith(
        {
          gardenAddress: defaultProps.gardenAddress,
          assetAddress: mockVault.asset,
        },
        expect.objectContaining({ onSuccess: expect.any(Function) })
      );
    });

    it("closes dialog when cancel is clicked", async () => {
      const user = userEvent.setup();

      render(
        createElement(PositionCard, {
          ...defaultProps,
          canManage: true,
          canEmergencyPause: true,
        })
      );

      await user.click(screen.getByText("Emergency pause"));
      expect(screen.getByText("Confirm emergency pause")).toBeInTheDocument();

      await user.click(screen.getByText("Cancel"));

      // Dialog title should no longer be visible
      expect(screen.queryByText("Confirm emergency pause")).not.toBeInTheDocument();
    });
  });
});
