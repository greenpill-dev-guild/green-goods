/**
 * PositionCard Vault Component Tests
 *
 * Tests the vault position card that displays deposit stats,
 * yield info, and operator management actions (harvest, emergency pause).
 */

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders as render } from "../test-utils";

const mockHarvestMutate = vi.fn();
const mockPauseMutate = vi.fn();
const mockEnableAutoAllocateMutate = vi.fn();
const mockUseVaultPreview = vi.fn().mockReturnValue({ preview: null });
const mockUseReadContracts = vi.fn().mockReturnValue({ data: undefined, refetch: vi.fn() });

vi.mock("wagmi", () => ({
  useReadContracts: (...args: unknown[]) => mockUseReadContracts(...args),
}));

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    formatTokenAmount: (value: bigint, decimals?: number) => {
      if (value === 0n) return "0";
      // Simple formatting for tests
      return `${Number(value) / 10 ** (decimals ?? 18)}`;
    },
    getNetDeposited: (deposited: bigint, withdrawn: bigint) => deposited - withdrawn,
    getVaultAssetDecimals: () => 18,
    getVaultAssetSymbol: () => "USDC",
    OCTANT_VAULT_ABI: [],
    ZERO_ADDRESS: "0x0000000000000000000000000000000000000000",
    useEnableAutoAllocate: () => ({ mutate: mockEnableAutoAllocateMutate, isPending: false }),
    useEmergencyPause: () => ({ mutate: mockPauseMutate, isPending: false }),
    useHarvest: () => ({ mutate: mockHarvestMutate, isPending: false }),
    useUser: () => ({ primaryAddress: "0xUserAddress1234567890abcdef1234567890abcdef" }),
    useVaultPreview: (...args: unknown[]) => mockUseVaultPreview(...args),
  };
});

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

  describe("operator management actions", () => {
    it("does not show management buttons when canManage is false", () => {
      render(createElement(PositionCard, defaultProps));

      expect(screen.queryByText("Harvest")).not.toBeInTheDocument();
      expect(screen.queryByText("Emergency pause")).not.toBeInTheDocument();
    });

    it("shows harvest and emergency pause buttons when canManage is true", () => {
      render(createElement(PositionCard, { ...defaultProps, canManage: true }));

      expect(screen.getByText("Harvest")).toBeInTheDocument();
      expect(screen.getByText("Emergency pause")).toBeInTheDocument();
    });

    it("calls harvest mutation when harvest clicked", async () => {
      const user = userEvent.setup();

      render(
        createElement(PositionCard, {
          ...defaultProps,
          canManage: true,
        })
      );

      await user.click(screen.getByText("Harvest"));
      expect(mockHarvestMutate).toHaveBeenCalledWith({
        gardenAddress: defaultProps.gardenAddress,
        assetAddress: mockVault.asset,
      });
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
