/**
 * Fund View — Phase 3 Evaluation Contract
 *
 * Defines the behavioral contract for the /fund view in Phase 3 (Public Platform).
 * Some tests verify existing behavior, others define new requirements that will FAIL
 * until Phase 3 implementation is complete.
 *
 * Phase 3 requirements:
 * - Aggregate stats section (exists)
 * - Garden gallery with funding buttons (exists)
 * - Broken funding CTAs are disabled inline instead of opening dead ends
 * - Deposit-only: no withdraw actions in DOM (exists)
 * - Connect Wallet opens the wallet modal inline
 *
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

const mockGardens = [
  {
    id: "garden-1",
    name: "Solar Community Garden",
    description: "A solar-powered community garden",
    location: "Austin, TX",
    bannerImage: "https://example.com/banner.jpg",
    operators: [],
    gardeners: ["0x1111", "0x2222"],
    works: [{ id: "work-1" }],
  },
  {
    id: "garden-2",
    name: "Urban Composting Hub",
    description: "Turning waste into soil",
    location: "Portland, OR",
    bannerImage: "",
    operators: [],
    gardeners: ["0x3333"],
    works: [],
  },
];

const mockUseGardens = vi.fn();
const mockOpenWalletModal = vi.fn();

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");

  return {
    ...actual,
    useAppKit: () => ({ open: mockOpenWalletModal }),
    useGardens: (...args: unknown[]) => mockUseGardens(...args),
  };
});

import FundPage from "../../views/Public/Fund";

const messages: Record<string, string> = {
  "public.fund.title": "Fund",
  "public.fund.description": "Support regenerative gardens by funding their vaults",
  "public.fund.deposit": "Deposit",
  "public.fund.cookieJar": "Cookie Jar",
  "public.fund.actionsUnavailable": "Public funding opens in a later update.",
  "public.fund.totalGardens": "Total Gardens",
  "public.fund.totalGardeners": "Total Gardeners",
  "public.fund.connectWallet": "Connect Wallet",
};

function renderView() {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(IntlProvider, { locale: "en", messages }, createElement(FundPage))
    )
  );
}

describe("FundPage — Phase 3 contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false });
  });

  it("renders aggregate stats section", () => {
    renderView();

    expect(screen.getByText("Total Gardens")).toBeInTheDocument();
    expect(screen.getByText("Total Gardeners")).toBeInTheDocument();
    // Verify actual counts
    expect(screen.getByText("2")).toBeInTheDocument(); // 2 gardens
  });

  it("renders garden gallery with disabled funding buttons per garden", () => {
    renderView();

    const depositButtons = screen.getAllByRole("button", { name: /deposit/i });
    expect(depositButtons).toHaveLength(2);
    depositButtons.forEach((button) => expect(button).toBeDisabled());

    expect(screen.getByText("Solar Community Garden")).toBeInTheDocument();
    expect(screen.getByText("Urban Composting Hub")).toBeInTheDocument();
  });

  it("broken funding buttons are disabled in place", async () => {
    const user = userEvent.setup();
    renderView();

    const depositButtons = screen.getAllByRole("button", { name: /deposit/i });
    await user.click(depositButtons[0]);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByText("Public funding opens in a later update.")).toHaveLength(2);
  });

  it("/fund is deposit-only — no withdraw actions in DOM", () => {
    renderView();

    // No withdraw button/link should exist
    expect(screen.queryByRole("button", { name: /withdraw/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/withdraw/i)).not.toBeInTheDocument();
  });

  it("Connect Wallet opens the wallet modal inline", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("button", { name: "Connect Wallet" }));

    expect(mockOpenWalletModal).toHaveBeenCalledTimes(1);
  });
});
