import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "../test-utils";

const mockUpdateMaxWithdrawal = vi.fn().mockResolvedValue("0xtx");
const mockUpdateInterval = vi.fn().mockResolvedValue("0xtx");

vi.mock("@green-goods/shared", () => ({
  ConfirmDialog: () => null,
  formatTokenAmount: (value: bigint, decimals = 18) =>
    `${Number(value) / 10 ** decimals}`.replace(/\.0$/, ""),
  getVaultAssetSymbol: () => "USDC",
  useCookieJarDeposit: () => ({ mutate: vi.fn(), isPending: false }),
  useCookieJarEmergencyWithdraw: () => ({ mutate: vi.fn(), isPending: false }),
  useCookieJarPause: () => ({ mutate: vi.fn(), isPending: false }),
  useCookieJarUnpause: () => ({ mutate: vi.fn(), isPending: false }),
  useCookieJarWithdraw: () => ({ mutate: vi.fn(), isPending: false }),
  useCookieJarUpdateMaxWithdrawal: () => ({
    mutateAsync: mockUpdateMaxWithdrawal,
    isPending: false,
  }),
  useCookieJarUpdateInterval: () => ({
    mutateAsync: mockUpdateInterval,
    isPending: false,
  }),
  useGardenCookieJars: () => ({
    jars: [
      {
        jarAddress: "0xjar",
        gardenAddress: "0xgarden",
        assetAddress: "0xasset",
        balance: 5000000n,
        currency: "0xasset",
        decimals: 6,
        maxWithdrawal: 1000000n,
        withdrawalInterval: 3600n,
        minDeposit: 0n,
        isPaused: false,
        emergencyWithdrawalEnabled: false,
      },
    ],
    isLoading: false,
    moduleConfigured: true,
  }),
  useUser: () => ({ primaryAddress: "0x1234567890123456789012345678901234567890" }),
  validateDecimalInput: (input: string, decimals: number) => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (!/^\d+(?:\.\d*)?$/.test(trimmed)) return "app.treasury.invalidAmount";
    const [_, fraction = ""] = trimmed.split(".");
    return fraction.length > decimals ? "app.treasury.tooManyDecimals" : null;
  },
}));

vi.mock("wagmi", () => ({
  useBalance: () => ({ data: null }),
}));

vi.mock("@radix-ui/react-accordion", () => ({
  Root: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  Item: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  Trigger: ({ children, ...props }: any) =>
    React.createElement("button", { type: "button", ...props }, children),
  Content: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
}));

vi.mock("@remixicon/react", () => ({
  RiArrowDownSLine: (props: any) => React.createElement("span", props),
  RiCupLine: (props: any) => React.createElement("span", props),
}));

import { CookieJarPayoutPanel } from "@/components/Work/CookieJarPayoutPanel";

describe("CookieJarPayoutPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
      writable: true,
    });
  });

  it("lets admins update a jar withdrawal cap and cooldown", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <CookieJarPayoutPanel
        gardenAddress={"0xgarden" as `0x${string}`}
        canManage
        isOwner={false}
      />
    );

    const maxWithdrawalInput = screen.getByLabelText("Max Withdrawal");
    const cooldownInput = screen.getByLabelText("Withdrawal Cooldown");

    await user.clear(maxWithdrawalInput);
    await user.type(maxWithdrawalInput, "1.5");
    await user.clear(cooldownInput);
    await user.type(cooldownInput, "7200");
    await user.click(screen.getByRole("button", { name: "Update Limits" }));

    expect(mockUpdateMaxWithdrawal).toHaveBeenCalledWith({
      jarAddress: "0xjar",
      maxWithdrawal: 1500000n,
    });
    expect(mockUpdateInterval).toHaveBeenCalledWith({
      jarAddress: "0xjar",
      withdrawalInterval: 7200n,
    });
  });
});
