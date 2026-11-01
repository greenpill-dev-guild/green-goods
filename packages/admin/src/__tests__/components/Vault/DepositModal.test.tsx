import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/__tests__/test-utils";

const TEST_CHAIN_ID = 11155111;
const TEST_GARDEN = "0x1111111111111111111111111111111111111111";
const TEST_ASSET = "0x7b79995e5f793a07bc00c21412e50ecae098e7f9";
const TEST_VAULT = "0x2222222222222222222222222222222222222222";
const TEST_USER = "0x3333333333333333333333333333333333333333";

const mockUseBalance = vi.fn();
const mockUseEstimateGas = vi.fn();
const mockUseGasPrice = vi.fn();
const mockUseDepositPlan = vi.fn();
const mockResetAmount = vi.fn();
const QUIET_PLAN = {
  signatures: null,
  signatureLine: null,
  isHeld: false,
  isPaused: false,
  unconfirmedIsHeld: false,
  holdFeedback: null,
};
const depositError: { current: Error | null } = { current: null };

vi.mock("wagmi", () => ({
  useBalance: (...args: unknown[]) => mockUseBalance(...args),
  useEstimateGas: (...args: unknown[]) => mockUseEstimateGas(...args),
  useGasPrice: (...args: unknown[]) => mockUseGasPrice(...args),
}));

vi.mock("@radix-ui/react-dialog", () => ({
  Root: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Overlay: () => <div />,
  Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Title: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Description: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Close: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@green-goods/shared/components/Alert", () => ({
  Alert: ({ children, ...props }: any) => (
    <div data-testid="alert" data-variant={props.variant}>
      {children}
    </div>
  ),
}));

vi.mock("@green-goods/shared/components/Button", () => ({
  Button: ({ children, loading: _loading, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@green-goods/shared/components/Form/FormFieldWrapper", () => ({
  FormField: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@green-goods/shared/components/Vault/AssetSelector", () => ({
  AssetSelector: () => <div data-testid="asset-selector" />,
}));

vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: TEST_USER }),
}));

vi.mock("@green-goods/shared/hooks/utils/useDebouncedValue", () => ({
  useDebouncedValue: <T,>(value: T) => value,
}));

vi.mock("@green-goods/shared/hooks/vault/useDepositForm", () => ({
  useDepositForm: () => ({
    form: {
      register: () => ({
        name: "amount",
        onChange: vi.fn(),
        onBlur: vi.fn(),
        ref: vi.fn(),
      }),
      setValue: vi.fn(),
    },
    amount: "1",
    amountBigInt: 1_000_000_000_000_000_000n,
    amountErrorKey: null,
    hasBlockingError: false,
    resetAmount: () => mockResetAmount(),
  }),
}));

vi.mock("@green-goods/shared/hooks/vault/useVaultDeposit", () => ({
  useDepositPlan: (...args: unknown[]) => mockUseDepositPlan(...args),
  useVaultDeposit: () => ({
    error: depositError.current,
    isPending: false,
    mutate: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("@green-goods/shared/hooks/vault/useVaultPreview", () => ({
  useVaultPreview: () => ({
    preview: {
      maxDeposit: 10_000_000_000_000_000_000n,
      totalAssets: 10_000_000_000_000_000_000n,
      previewShares: 1_000_000_000_000_000_000n,
    },
    isLoading: false,
  }),
}));

vi.mock("@green-goods/shared/utils/blockchain/vaults", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@green-goods/shared/utils/blockchain/vaults")>();
  return {
    ...actual,
    formatTokenAmount: (value: bigint) => value.toString(),
    getVaultAssetDecimals: () => 18,
    getVaultAssetSymbol: () => "WETH",
    hasVaultAssetDecimals: () => true,
  };
});

vi.mock("@green-goods/shared/utils/errors/tx-error-classifier", () => ({
  classifyTxError: (error: Error | null) => ({
    severity: "error",
    titleKey: "app.status.error",
    messageKey: "app.status.error",
    kind: error?.message === "unconfirmed" ? "unconfirmed" : "failed",
    rawMessage: "",
  }),
  isMeaningfulTxErrorMessage: () => false,
}));

vi.mock("@/components/ConnectButton", () => ({
  ConnectButton: () => <div />,
}));

import { DepositModal } from "../../../components/Vault/DepositModal";

describe("DepositModal", () => {
  beforeEach(() => {
    depositError.current = null;
    mockUseDepositPlan.mockReturnValue(QUIET_PLAN);
  });

  it("pins wallet balance and gas reads to the selected vault chain", () => {
    mockUseBalance.mockReturnValue({
      data: {
        value: 5_000_000_000_000_000_000n,
        decimals: 18,
        symbol: "WETH",
      },
    });
    mockUseEstimateGas.mockReturnValue({ data: 21_000n });
    mockUseGasPrice.mockReturnValue({ data: 100n });

    renderWithProviders(
      <DepositModal
        isOpen
        onClose={vi.fn()}
        gardenAddress={TEST_GARDEN as `0x${string}`}
        vaults={[
          {
            id: "vault-1",
            chainId: TEST_CHAIN_ID,
            garden: TEST_GARDEN,
            asset: TEST_ASSET,
            vaultAddress: TEST_VAULT,
            totalDeposited: 0n,
            totalWithdrawn: 0n,
            totalHarvestCount: 0,
            donationAddress: null,
            depositorCount: 0,
            paused: false,
            createdAt: 0,
          },
        ]}
      />
    );

    expect(mockUseBalance.mock.calls[0][0].chainId).toBe(TEST_CHAIN_ID);
    expect(mockUseEstimateGas.mock.calls[0][0].chainId).toBe(TEST_CHAIN_ID);
    expect(mockUseGasPrice.mock.calls[0][0].chainId).toBe(TEST_CHAIN_ID);
  });

  function renderOpenModal() {
    mockUseBalance.mockReturnValue({
      data: {
        value: 5_000_000_000_000_000_000n,
        decimals: 18,
        symbol: "WETH",
      },
    });
    mockUseEstimateGas.mockReturnValue({ data: 21_000n });
    mockUseGasPrice.mockReturnValue({ data: 100n });

    return renderWithProviders(
      <DepositModal
        isOpen
        onClose={vi.fn()}
        gardenAddress={TEST_GARDEN as `0x${string}`}
        vaults={[
          {
            id: "vault-1",
            chainId: TEST_CHAIN_ID,
            garden: TEST_GARDEN,
            asset: TEST_ASSET,
            vaultAddress: TEST_VAULT,
            totalDeposited: 0n,
            totalWithdrawn: 0n,
            totalHarvestCount: 0,
            donationAddress: null,
            depositorCount: 0,
            paused: false,
            createdAt: 0,
          },
        ]}
      />
    );
  }

  it("renders deposit guidance copy", () => {
    renderOpenModal();

    expect(screen.getByText(/Deposits earn yield through Aave lending/i)).toBeTruthy();
    expect(screen.getByText(/Yield is automatically split between gardener rewards/i)).toBeTruthy();
  });

  it("renders network hint with selected asset symbol", () => {
    renderOpenModal();

    expect(screen.getByText(/You need WETH tokens on Arbitrum to deposit/)).toBeTruthy();
  });

  it("renders minimum deposit helper text", () => {
    renderOpenModal();

    expect(screen.getByText(/Minimum deposit: any amount/)).toBeTruthy();
  });

  it("plans the deposit for the selected vault and says how many signatures it takes", () => {
    mockUseDepositPlan.mockReturnValue({ ...QUIET_PLAN, signatureLine: "2 signatures" });
    renderOpenModal();

    expect(screen.getByText("2 signatures")).toBeTruthy();
    expect(mockUseDepositPlan).toHaveBeenLastCalledWith(
      expect.objectContaining({
        amount: 1_000_000_000_000_000_000n,
        enabled: true,
        target: { kind: "vault", address: TEST_VAULT, asset: TEST_ASSET, receiver: TEST_USER },
      })
    );
  });

  it("allows a deposit when nothing is held", () => {
    renderOpenModal();

    expect((screen.getByRole("button", { name: "Deposit" }) as HTMLButtonElement).disabled).toBe(
      false
    );
    expect(screen.queryByRole("button", { name: "Check Again" })).toBeNull();
  });

  it("pauses the next deposit while an earlier one is unknown", () => {
    mockUseDepositPlan.mockReturnValue({
      ...QUIET_PLAN,
      isHeld: true,
      isPaused: true,
      holdFeedback: {
        title: "We couldn’t confirm your last deposit.",
        message: "Deposits here are paused.",
        detail: "You have 3 WETH in this vault now.",
        hasUnreadValues: false,
        isSettling: false,
        onCheckAgain: vi.fn(),
        onMoveOn: vi.fn(),
      },
    });
    renderOpenModal();

    expect((screen.getByRole("button", { name: "Deposit" }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(screen.getByText(/You have 3 WETH in this vault now/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check Again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Move On" })).toBeTruthy();
  });

  it.each([
    ["an unknown outcome on today's path", "unconfirmed", false, true],
    ["an unknown outcome on a route that holds it", "unconfirmed", true, false],
    ["any other failure on a route that holds", "rejected", true, true],
  ])("for %s, the error line reads as expected", (_case, message, unconfirmedIsHeld, shown) => {
    depositError.current = new Error(message);
    mockUseDepositPlan.mockReturnValue({ ...QUIET_PLAN, unconfirmedIsHeld });
    renderOpenModal();

    expect(Boolean(screen.queryByRole("alert"))).toBe(shown);
  });

  it("clears the amount when a held deposit proves it landed", () => {
    renderOpenModal();
    mockResetAmount.mockClear();

    mockUseDepositPlan.mock.lastCall?.[0].onLanded();

    expect(mockResetAmount).toHaveBeenCalledOnce();
  });

  it("keeps the deposit paused while the plan is being read", () => {
    mockUseDepositPlan.mockReturnValue({ ...QUIET_PLAN, isPaused: true });
    renderOpenModal();

    expect((screen.getByRole("button", { name: "Deposit" }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });
});
