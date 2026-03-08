import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "../test-utils";

const mockWithdrawMutate = vi.fn();

vi.mock("@green-goods/shared", () => ({
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
  formatTokenAmount: (value: bigint, decimals = 18) =>
    `${Number(value) / 10 ** decimals}`.replace(/\.0$/, ""),
  getVaultAssetDecimals: () => 6,
  getVaultAssetSymbol: () => "USDC",
  useDebouncedValue: <T,>(value: T) => value,
  useUser: () => ({ primaryAddress: "0x1234567890123456789012345678901234567890" }),
  useVaultDeposits: () => ({
    deposits: [{ asset: "0xasset", shares: 1n }],
    isError: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
  }),
  useVaultPreview: () => ({
    preview: { previewShares: 0n, previewAssets: 1n },
  }),
  useVaultWithdraw: () => ({ mutate: mockWithdrawMutate, isPending: false }),
  validateDecimalInput: (input: string, decimals: number) => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (!/^\d+(?:\.\d*)?$/.test(trimmed)) return "app.treasury.invalidAmount";
    const [_, fraction = ""] = trimmed.split(".");
    return fraction.length > decimals ? "app.treasury.tooManyDecimals" : null;
  },
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

vi.mock("@radix-ui/react-dialog", () => ({
  Root: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? React.createElement("div", null, children) : null,
  Portal: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  Overlay: () => React.createElement("div"),
  Content: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  Title: ({ children }: { children: React.ReactNode }) => React.createElement("h2", null, children),
  Description: ({ children }: { children: React.ReactNode }) =>
    React.createElement("p", null, children),
  Close: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock("@remixicon/react", () => ({
  RiCloseLine: (props: any) => React.createElement("span", props),
}));

import { WithdrawModal } from "@/components/Vault/WithdrawModal";

describe("WithdrawModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("withdraws tiny balances using the previewWithdraw share quote instead of rounding to zero", async () => {
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
        shares: 1n,
      }),
      expect.any(Object)
    );
  });
});
