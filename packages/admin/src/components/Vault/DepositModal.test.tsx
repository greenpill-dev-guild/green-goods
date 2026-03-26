import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/__tests__/test-utils";

const TEST_CHAIN_ID = 11155111;
const TEST_GARDEN = "0x1111111111111111111111111111111111111111";
const TEST_ASSET = "0x7b79995e5f793a07bc00c21412e50ecae098e7f9";
const TEST_VAULT = "0x2222222222222222222222222222222222222222";
const TEST_USER = "0x3333333333333333333333333333333333333333";

const mockUseBalance = vi.fn();
const mockUseEstimateGas = vi.fn();
const mockUseGasPrice = vi.fn();

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

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();

  return {
    ...actual,
    AssetSelector: () => <div data-testid="asset-selector" />,
    classifyTxError: () => ({
      severity: "error",
      titleKey: "app.status.error",
      messageKey: "app.status.error",
      kind: "failed",
      rawMessage: "",
    }),
    formatTokenAmount: (value: bigint) => value.toString(),
    getVaultAssetDecimals: () => 18,
    getVaultAssetSymbol: () => "WETH",
    hasVaultAssetDecimals: () => true,
    isMeaningfulTxErrorMessage: () => false,
    useDebouncedValue: <T,>(value: T) => value,
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
      resetAmount: vi.fn(),
    }),
    useUser: () => ({ primaryAddress: TEST_USER }),
    useVaultDeposit: () => ({
      error: null,
      isPending: false,
      mutate: vi.fn(),
      reset: vi.fn(),
    }),
    useVaultPreview: () => ({
      preview: {
        maxDeposit: 10_000_000_000_000_000_000n,
        totalAssets: 10_000_000_000_000_000_000n,
        previewShares: 1_000_000_000_000_000_000n,
      },
      isLoading: false,
    }),
  };
});

vi.mock("@/components/ConnectButton", () => ({
  ConnectButton: () => <div />,
}));

vi.mock("@/components/feedback/TxInlineFeedback", () => ({
  TxInlineFeedback: () => null,
}));

vi.mock("@/components/ui/Button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/FormField", () => ({
  FormField: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/Alert", () => ({
  Alert: ({ children, ...props }: any) => (
    <div data-testid="alert" data-variant={props.variant}>
      {children}
    </div>
  ),
}));

vi.mock("./depositLimit", () => ({
  getDepositLimitLabel: () => "Unlimited",
}));

import { DepositModal } from "./DepositModal";

describe("DepositModal", () => {
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

  it("renders deposit guidance info alert", () => {
    renderOpenModal();

    const alert = screen.getByTestId("alert");
    expect(alert).toBeTruthy();
    expect(alert.getAttribute("data-variant")).toBe("info");
    expect(alert.textContent).toContain("Aave");
    expect(alert.textContent).toContain("yield");
  });

  it("renders network hint with selected asset symbol", () => {
    renderOpenModal();

    expect(screen.getByText(/You need WETH tokens on Arbitrum to deposit/)).toBeTruthy();
  });

  it("renders minimum deposit helper text", () => {
    renderOpenModal();

    expect(screen.getByText(/Minimum deposit: any amount/)).toBeTruthy();
  });
});
