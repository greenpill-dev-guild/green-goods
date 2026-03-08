/**
 * CookieJarManageModal Tests
 * @vitest-environment jsdom
 */

import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "../test-utils";

const mockPause = vi.fn();
const mockUnpause = vi.fn();
const mockEmergencyWithdraw = vi.fn();
const mockUpdateMaxWithdrawal = vi.fn();
const mockUpdateInterval = vi.fn();

vi.mock("@green-goods/shared", () => ({
  ConfirmDialog: () => null,
  formatTokenAmount: (value: bigint, decimals = 18) =>
    `${Number(value) / 10 ** decimals}`.replace(/\.0$/, ""),
  getVaultAssetSymbol: () => "USDC",
  useCookieJarPause: () => ({ mutate: mockPause, isPending: false }),
  useCookieJarUnpause: () => ({ mutate: mockUnpause, isPending: false }),
  useCookieJarEmergencyWithdraw: () => ({
    mutate: mockEmergencyWithdraw,
    isPending: false,
  }),
  useCookieJarUpdateMaxWithdrawal: () => ({
    mutate: mockUpdateMaxWithdrawal,
    isPending: false,
  }),
  useCookieJarUpdateInterval: () => ({
    mutate: mockUpdateInterval,
    isPending: false,
  }),
  useGardenCookieJars: () => ({
    jars: [
      {
        jarAddress: "0xjar1",
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
}));

vi.mock("@remixicon/react", () => ({
  RiCloseLine: (props: any) => React.createElement("span", props, "close"),
  RiPencilLine: (props: any) => React.createElement("span", props, "edit"),
  RiCheckLine: (props: any) => React.createElement("span", props, "check"),
}));

vi.mock("viem", () => ({
  formatUnits: (value: bigint, decimals: number) => {
    const str = value.toString();
    if (decimals === 0) return str;
    const padded = str.padStart(decimals + 1, "0");
    const intPart = padded.slice(0, -decimals);
    const fracPart = padded.slice(-decimals).replace(/0+$/, "");
    return fracPart ? `${intPart}.${fracPart}` : intPart;
  },
  parseUnits: (value: string, decimals: number) => {
    const [intPart = "0", fracPart = ""] = value.split(".");
    const paddedFrac = fracPart.padEnd(decimals, "0").slice(0, decimals);
    return BigInt(intPart + paddedFrac);
  },
}));

import { CookieJarManageModal } from "@/components/Work/CookieJarManageModal";

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  gardenAddress: "0xgarden" as `0x${string}`,
  canManage: true,
  isOwner: false,
};

describe("CookieJarManageModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows edit buttons next to max withdrawal and cooldown when canManage is true", () => {
    renderWithProviders(<CookieJarManageModal {...defaultProps} />);

    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    // Should have 2 edit buttons: one for max withdrawal, one for interval
    expect(editButtons.length).toBe(2);
  });

  it("does not show edit buttons when canManage is false", () => {
    renderWithProviders(<CookieJarManageModal {...defaultProps} canManage={false} />);

    const editButtons = screen.queryAllByRole("button", { name: /edit/i });
    expect(editButtons.length).toBe(0);
  });

  it("shows inline input when max withdrawal edit button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CookieJarManageModal {...defaultProps} />);

    const editButtons = screen.getAllByRole("button", {
      name: /edit max withdrawal/i,
    });
    await user.click(editButtons[0]);

    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("1");
  });

  it("submits updated max withdrawal value", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CookieJarManageModal {...defaultProps} />);

    // Click edit for max withdrawal
    const editButtons = screen.getAllByRole("button", {
      name: /edit max withdrawal/i,
    });
    await user.click(editButtons[0]);

    // Clear and type new value
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "2.5");

    // Click confirm
    const confirmButton = screen.getByRole("button", {
      name: /confirm max withdrawal/i,
    });
    await user.click(confirmButton);

    expect(mockUpdateMaxWithdrawal).toHaveBeenCalledWith(
      {
        jarAddress: "0xjar1",
        maxWithdrawal: 2500000n, // 2.5 * 10^6
      },
      expect.any(Object)
    );
  });

  it("cancels max withdrawal edit without submitting", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CookieJarManageModal {...defaultProps} />);

    const editButtons = screen.getAllByRole("button", {
      name: /edit max withdrawal/i,
    });
    await user.click(editButtons[0]);

    // Click cancel
    const cancelButton = screen.getByRole("button", {
      name: /cancel edit/i,
    });
    await user.click(cancelButton);

    expect(mockUpdateMaxWithdrawal).not.toHaveBeenCalled();
    // Edit button should be back
    expect(screen.getAllByRole("button", { name: /edit max withdrawal/i }).length).toBe(1);
  });

  it("shows inline input when interval edit button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CookieJarManageModal {...defaultProps} />);

    const editButtons = screen.getAllByRole("button", {
      name: /edit withdrawal cooldown/i,
    });
    await user.click(editButtons[0]);

    // Should show a select or input for the interval
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
  });

  it("submits updated interval value from preset", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CookieJarManageModal {...defaultProps} />);

    // Click edit for interval
    const editButtons = screen.getAllByRole("button", {
      name: /edit withdrawal cooldown/i,
    });
    await user.click(editButtons[0]);

    // Select a preset value (86400 = 1 day)
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "86400");

    // Click confirm
    const confirmButton = screen.getByRole("button", {
      name: /confirm withdrawal cooldown/i,
    });
    await user.click(confirmButton);

    expect(mockUpdateInterval).toHaveBeenCalledWith(
      {
        jarAddress: "0xjar1",
        withdrawalInterval: 86400n,
      },
      expect.any(Object)
    );
  });

  it("closes edit mode on successful mutation", async () => {
    mockUpdateMaxWithdrawal.mockImplementation((_params: any, options: any) => {
      options?.onSuccess?.();
    });

    const user = userEvent.setup();
    renderWithProviders(<CookieJarManageModal {...defaultProps} />);

    const editButtons = screen.getAllByRole("button", {
      name: /edit max withdrawal/i,
    });
    await user.click(editButtons[0]);

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "3");

    const confirmButton = screen.getByRole("button", {
      name: /confirm max withdrawal/i,
    });
    await user.click(confirmButton);

    // After success, edit button should be back (not the input)
    expect(screen.getAllByRole("button", { name: /edit max withdrawal/i }).length).toBe(1);
  });
});
