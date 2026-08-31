import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "../test-utils";

const { mockParseUnits } = vi.hoisted(() => ({ mockParseUnits: vi.fn() }));
const mockWithdrawMutate = vi.fn();
const mockWithdrawReset = vi.fn();

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  mockParseUnits.mockImplementation(actual.parseUnits);
  return { ...actual, parseUnits: mockParseUnits };
});

vi.mock("@green-goods/shared/components/Alert", () => ({
  Alert: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { role: "alert" }, children),
}));

vi.mock("@green-goods/shared/components/Button", () => ({
  Button: ({
    children,
    className: _className,
    size: _size,
    variant: _variant,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    size?: string;
    variant?: string;
  }) => React.createElement("button", props, children),
}));

vi.mock("@green-goods/shared/components/feedback/TxInlineFeedback", () => ({
  TxInlineFeedback: () => null,
}));

vi.mock("@green-goods/shared/components/Form/ControlPrimitives", () => ({
  TextInput: ({
    invalid: _invalid,
    surface: _surface,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & {
    invalid?: boolean;
    surface?: string;
  }) => React.createElement("input", props),
}));

vi.mock("@green-goods/shared/components/Form/FormFieldWrapper", () => ({
  FormField: ({
    children,
    error,
    htmlFor,
    label,
  }: {
    children: React.ReactNode;
    error?: string;
    htmlFor: string;
    label: string;
  }) =>
    React.createElement(
      "div",
      null,
      React.createElement("label", { htmlFor }, label),
      children,
      error ? React.createElement("p", null, error) : null
    ),
}));

vi.mock("@green-goods/shared/components/Vault/AssetSelector", () => ({
  AssetSelector: ({
    vaults,
    selectedAsset,
    onSelect,
  }: {
    vaults: Array<{ asset: string }>;
    selectedAsset: string;
    onSelect: (value: string) => void;
  }) =>
    React.createElement(
      "select",
      {
        "aria-label": "Asset",
        value: selectedAsset,
        onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onSelect(event.target.value),
      },
      vaults.map((vault) =>
        React.createElement("option", { key: vault.asset, value: vault.asset }, vault.asset)
      )
    ),
}));

vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: "0x1234567890123456789012345678901234567890" }),
}));

vi.mock("@green-goods/shared/hooks/utils/useDebouncedValue", () => ({
  useDebouncedValue: <T,>(value: T) => value,
}));

vi.mock("@green-goods/shared/hooks/utils/useTxErrorMessages", () => ({
  useTxErrorMessages: () => ({
    view: { kind: "error", severity: "error" as const },
    title: "Transaction failed",
    message: "Something went wrong. Please try again.",
  }),
}));

vi.mock("@green-goods/shared/hooks/vault/useVaultDeposits", () => ({
  useVaultDeposits: () => ({
    deposits: [{ asset: "0xasset", shares: 1n }],
    isError: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
  }),
}));

vi.mock("@green-goods/shared/hooks/vault/useVaultPreview", () => ({
  useVaultPreview: () => ({
    preview: { previewShares: 0n, previewAssets: 1n, previewWithdrawShares: 1n, maxWithdraw: 1n },
  }),
}));

vi.mock("@green-goods/shared/hooks/vault/useVaultWithdraw", () => ({
  useVaultWithdraw: () => ({
    mutate: mockWithdrawMutate,
    isPending: false,
    error: null,
    reset: mockWithdrawReset,
  }),
}));

vi.mock("@green-goods/shared/utils/blockchain/vaults", () => ({
  formatTokenAmount: (value: bigint, decimals = 18) =>
    `${Number(value) / 10 ** decimals}`.replace(/\.0$/, ""),
  getVaultAssetDecimals: () => 6,
  getVaultAssetSymbol: () => "USDC",
  validateDecimalInput: (input: string, decimals: number) => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (!/^\d+(?:\.\d*)?$/.test(trimmed)) return "app.treasury.invalidAmount";
    const [_, fraction = ""] = trimmed.split(".");
    return fraction.length > decimals ? "app.treasury.tooManyDecimals" : null;
  },
}));

vi.mock("@green-goods/shared/utils/errors/tx-error-classifier", () => ({
  classifyTxError: () => ({
    kind: "error",
    severity: "error" as const,
    titleKey: "app.tx.error",
    messageKey: "app.tx.errorMessage",
    rawMessage: "",
  }),
  isMeaningfulTxErrorMessage: () => false,
}));

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("wagmi", () => ({
  useReadContracts: () => ({
    data: [
      { result: 1n, status: "success" }, // maxRedeem
      { result: 1n, status: "success" }, // maxWithdraw
      { result: 1n, status: "success" }, // previewWithdraw
      { result: 6, status: "success" }, // share decimals
    ],
  }),
}));

vi.mock("@/components/AdminDialog", () => ({
  AdminDialog: ({
    actions,
    children,
    description,
    open,
    title,
  }: {
    actions: React.ReactNode;
    children: React.ReactNode;
    description: string;
    open: boolean;
    title: string;
  }) =>
    open
      ? React.createElement(
          "div",
          { "aria-label": title, role: "dialog" },
          React.createElement("h2", null, title),
          React.createElement("p", null, description),
          children,
          actions
        )
      : null,
}));

import { WithdrawModal } from "@/components/Vault/WithdrawModal";

describe("WithdrawModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("withdraws tiny balances using the Max button instead of rounding to zero", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <WithdrawModal
        isOpen
        onClose={vi.fn()}
        gardenAddress={"0xgarden" as `0x${string}`}
        vaults={[
          {
            id: "vault-1",
            chainId: 11155111,
            asset: "0xasset" as `0x${string}`,
            vaultAddress: "0xvault" as `0x${string}`,
            totalDeposited: 1n,
            totalWithdrawn: 0n,
            totalHarvestCount: 0,
            donationAddress: null,
            depositorCount: 1,
            paused: false,
            createdAt: 0,
            garden: "0xgarden" as `0x${string}`,
          },
        ]}
        defaultAsset="0xasset"
      />
    );

    await user.click(screen.getByRole("button", { name: "Max" }));
    await user.click(screen.getByRole("button", { name: "Withdraw" }));

    expect(mockWithdrawMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1n,
      }),
      expect.any(Object)
    );
  });

  it("converts typed decimal amount to correct shares using vault decimals", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <WithdrawModal
        isOpen
        onClose={vi.fn()}
        gardenAddress={"0xgarden" as `0x${string}`}
        vaults={[
          {
            id: "vault-1",
            chainId: 11155111,
            asset: "0xasset" as `0x${string}`,
            vaultAddress: "0xvault" as `0x${string}`,
            totalDeposited: 1n,
            totalWithdrawn: 0n,
            totalHarvestCount: 0,
            donationAddress: null,
            depositorCount: 1,
            paused: false,
            createdAt: 0,
            garden: "0xgarden" as `0x${string}`,
          },
        ]}
        defaultAsset="0xasset"
      />
    );

    const amountInput = screen.getByRole("textbox", { name: /amount/i });
    await user.type(amountInput, "0.000001");
    expect(amountInput).toHaveValue("0.000001");
    expect(mockParseUnits).toHaveBeenLastCalledWith("0.000001", 6);
    expect(mockParseUnits.mock.results.at(-1)?.value).toBe(1n);
    expect(screen.queryByText("Enter a valid number")).not.toBeInTheDocument();
    expect(screen.queryByText("Too many decimal places")).not.toBeInTheDocument();
    expect(screen.queryByText("Amount exceeds available balance")).not.toBeInTheDocument();

    const withdrawButton = screen.getByRole("button", { name: "Withdraw" });
    expect(withdrawButton).toBeEnabled();
    await user.click(withdrawButton);

    expect(mockWithdrawMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1n,
      }),
      expect.any(Object)
    );
  });
});
