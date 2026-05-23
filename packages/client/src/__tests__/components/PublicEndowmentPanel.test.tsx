/**
 * PublicEndowmentPanel behavior tests.
 *
 * Locks the wallet-owned public management slice: disconnected users are asked
 * to connect, active endowments lead with support totals, and withdrawals stay
 * inline on the asset row.
 *
 * @vitest-environment jsdom
 */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_OWNER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const TEST_GARDEN = "0x1111111111111111111111111111111111111111" as Address;
const TEST_DAI = "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1" as Address;
const TEST_VAULT = "0x4444444444444444444444444444444444444444" as Address;

const {
  mockOpenWallet,
  mockPrimaryAddress,
  mockUsePublicEndowmentPositions,
  mockUseVaultPreview,
  mockUseVaultWithdraw,
  mockWithdrawMutate,
  mockWithdrawReset,
  mockRefresh,
  mockRefetchPreview,
} = vi.hoisted(() => ({
  mockOpenWallet: vi.fn(),
  mockPrimaryAddress: { current: null as Address | null },
  mockUsePublicEndowmentPositions: vi.fn(),
  mockUseVaultPreview: vi.fn(),
  mockUseVaultWithdraw: vi.fn(),
  mockWithdrawMutate: vi.fn(),
  mockWithdrawReset: vi.fn(),
  mockRefresh: vi.fn(),
  mockRefetchPreview: vi.fn(),
}));

function formatSimpleTokenAmount(value: bigint, decimals = 18): string {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
}

vi.mock("@green-goods/shared", () => ({
  DEFAULT_WITHDRAW_MAX_LOSS_BPS: 100n,
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  formatTokenAmount: (value: bigint, decimals = 18) => formatSimpleTokenAmount(value, decimals),
  truncateAddress: (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`,
  useAppKit: () => ({ open: mockOpenWallet }),
  useDebouncedValue: (value: unknown) => value,
  usePublicEndowmentPositions: (...args: unknown[]) => mockUsePublicEndowmentPositions(...args),
  useTxErrorMessages: (error: unknown) => ({
    view: { severity: "error" },
    title: error ? "Transaction failed" : "",
    message: error instanceof Error ? error.message : "Something went wrong.",
  }),
  useUser: () => ({ primaryAddress: mockPrimaryAddress.current }),
  useVaultPreview: (...args: unknown[]) => mockUseVaultPreview(...args),
  useVaultWithdraw: (...args: unknown[]) => mockUseVaultWithdraw(...args),
  validateDecimalInput: (input: string) =>
    input.trim() && !/^\d+(?:\.\d*)?$/.test(input.trim()) ? "app.treasury.invalidAmount" : null,
}));

import { PublicEndowmentPanel } from "../../components/Public/PublicEndowmentPanel";

const messages: Record<string, string> = {
  "app.treasury.invalidAmount": "Enter a valid number",
  "public.fund.endowments.connect.cta": "Connect Wallet",
  "public.fund.endowments.connect.title": "Connect to see your endowments",
  "public.fund.endowments.empty.title": "No endowments for this wallet yet",
  "public.fund.endowments.position.withdraw": "Withdraw",
  "public.fund.endowments.title": "Your Endowments",
  "public.fund.endowments.withdraw.confirm": "Confirm",
  "public.fund.endowments.withdraw.confirmTitle": "Confirm withdrawal",
  "public.fund.endowments.withdraw.max": "Max",
  "public.fund.endowments.withdraw.amount": "Withdrawal amount",
  "public.fund.endowments.withdraw.review": "Review withdrawal",
  "public.fund.endowments.withdraw.success": "{amount} returned to your wallet.",
};

function activePortfolio() {
  return {
    hasPositions: true,
    positions: [],
    gardenGroups: [
      {
        gardenAddress: TEST_GARDEN,
        gardenName: "Solar Community Garden",
        gardenLocation: "Austin, TX",
        hasGardenMetadata: true,
        positions: [
          {
            id: "deposit-1",
            chainId: 42161,
            gardenAddress: TEST_GARDEN,
            gardenName: "Solar Community Garden",
            gardenLocation: "Austin, TX",
            vaultAddress: TEST_VAULT,
            asset: TEST_DAI,
            assetSymbol: "DAI",
            decimals: 18,
            shares: 8_000000000000000000n,
            totalEndowed: 10_000000000000000000n,
            netEndowed: 8_000000000000000000n,
            hasGardenMetadata: true,
            hasVaultMetadata: true,
          },
        ],
      },
    ],
    assetTotals: [
      {
        chainId: 42161,
        asset: TEST_DAI,
        assetSymbol: "DAI",
        decimals: 18,
        totalEndowed: 10_000000000000000000n,
        netEndowed: 8_000000000000000000n,
        positionCount: 1,
      },
    ],
    gardenCount: 1,
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefresh,
  };
}

function renderPanel(open = true) {
  return render(
    createElement(
      IntlProvider,
      { locale: "en", messages },
      createElement(PublicEndowmentPanel, { open, onOpenChange: vi.fn() })
    )
  );
}

describe("PublicEndowmentPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrimaryAddress.current = null;
    mockRefresh.mockResolvedValue(undefined);
    mockRefetchPreview.mockResolvedValue(undefined);
    mockUsePublicEndowmentPositions.mockReturnValue({
      hasPositions: false,
      positions: [],
      gardenGroups: [],
      assetTotals: [],
      gardenCount: 0,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefresh,
    });
    mockUseVaultPreview.mockReturnValue({
      preview: { maxWithdraw: 4_000000000000000000n },
      isFetching: false,
      refetch: mockRefetchPreview,
    });
    mockUseVaultWithdraw.mockReturnValue({
      mutate: mockWithdrawMutate,
      reset: mockWithdrawReset,
      isPending: false,
      error: null,
    });
  });

  afterEach(() => cleanup());

  it("prompts disconnected visitors to connect a wallet", async () => {
    const user = userEvent.setup();

    renderPanel();

    expect(screen.getByRole("heading", { name: "Your Endowments" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Connect to see your endowments" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Connect Wallet" }));

    expect(mockOpenWallet).toHaveBeenCalled();
  });

  it("explains the empty state for a connected wallet without endowments", () => {
    mockPrimaryAddress.current = TEST_OWNER;

    renderPanel();

    expect(screen.getByText("No endowments for this wallet yet")).toBeInTheDocument();
  });

  it("shows support totals and positions grouped by Garden", () => {
    mockPrimaryAddress.current = TEST_OWNER;
    mockUsePublicEndowmentPositions.mockReturnValue(activePortfolio());

    renderPanel();

    expect(screen.getByText("What you've supported")).toBeInTheDocument();
    expect(screen.getByText("Total endowed in DAI")).toBeInTheDocument();
    expect(screen.getAllByText("10 DAI").length).toBeGreaterThan(0);
    expect(screen.getByText("Solar Community Garden")).toBeInTheDocument();
    expect(screen.getByText("Austin, TX")).toBeInTheDocument();
    expect(screen.getByText("Endowed:")).toBeInTheDocument();
    expect(screen.getByText("Shares:")).toBeInTheDocument();
    expect(screen.getByText("Available if needed:")).toBeInTheDocument();
    expect(screen.getByText("4 DAI")).toBeInTheDocument();
  });

  it("expands a row inline, supports Max, confirms, and refreshes after success", async () => {
    const user = userEvent.setup();
    mockPrimaryAddress.current = TEST_OWNER;
    mockUsePublicEndowmentPositions.mockReturnValue(activePortfolio());
    mockWithdrawMutate.mockImplementation((_params, options) => {
      void options?.onSuccess?.("0xtx");
    });

    renderPanel();

    await user.click(screen.getByRole("button", { name: "Withdraw" }));
    await user.click(screen.getByRole("button", { name: "Max" }));

    const amountInput = screen.getByRole("textbox", { name: "Withdrawal amount" });
    expect(amountInput).toHaveValue("4");

    await user.click(screen.getByRole("button", { name: "Review withdrawal" }));
    const confirmPanel = screen.getByText("Confirm withdrawal").closest("div");
    expect(confirmPanel).not.toBeNull();

    await user.click(within(confirmPanel as HTMLElement).getByRole("button", { name: "Confirm" }));

    expect(mockWithdrawMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 4_000000000000000000n,
        assetAddress: TEST_DAI,
        gardenAddress: TEST_GARDEN,
        maxLossBps: 100n,
        owner: TEST_OWNER,
        receiver: TEST_OWNER,
        vaultAddress: TEST_VAULT,
      }),
      expect.any(Object)
    );
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    // The row also refreshes its own withdraw preview so "Available if needed"
    // is not left stale after the balance changes.
    expect(mockRefetchPreview).toHaveBeenCalled();
    // Success is announced to assistive tech via a polite live region.
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/returned to your wallet/i);
  });

  it("scrolls a freshly expanded row into view and wires aria-controls", async () => {
    const user = userEvent.setup();
    mockPrimaryAddress.current = TEST_OWNER;
    mockUsePublicEndowmentPositions.mockReturnValue(activePortfolio());

    renderPanel();

    const withdrawToggle = screen.getByRole("button", { name: "Withdraw" });
    expect(withdrawToggle).not.toHaveAttribute("aria-controls");

    await user.click(withdrawToggle);

    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    expect(withdrawToggle).toHaveAttribute("aria-expanded", "true");
    const regionId = withdrawToggle.getAttribute("aria-controls");
    expect(regionId).toBeTruthy();
    expect(document.getElementById(regionId as string)).not.toBeNull();
  });

  it("announces a withdrawal failure with role=alert", async () => {
    const user = userEvent.setup();
    mockPrimaryAddress.current = TEST_OWNER;
    mockUsePublicEndowmentPositions.mockReturnValue(activePortfolio());
    mockUseVaultWithdraw.mockReturnValue({
      mutate: mockWithdrawMutate,
      reset: mockWithdrawReset,
      isPending: false,
      error: new Error("execution reverted"),
    });

    renderPanel();

    await user.click(screen.getByRole("button", { name: "Withdraw" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Transaction failed");
  });
});
