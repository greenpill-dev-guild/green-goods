/**
 * Fund view behavior tests
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGardens = [
  {
    id: "0x1111111111111111111111111111111111111111" as Address,
    name: "Solar Community Garden",
    description: "A solar-powered community garden",
    location: "Austin, TX",
    bannerImage: "https://example.com/banner.jpg",
    operators: [],
    gardeners: ["0xaaaa", "0xbbbb"],
    works: [{ id: "work-1" }],
  },
  {
    id: "0x2222222222222222222222222222222222222222" as Address,
    name: "Urban Composting Hub",
    description: "Turning waste into soil",
    location: "Portland, OR",
    bannerImage: "",
    operators: [],
    gardeners: ["0xcccc"],
    works: [],
  },
];

const { mockUseGardens, mockOpenWalletModal, mockPrimaryAddress } = vi.hoisted(() => ({
  mockUseGardens: vi.fn(),
  mockOpenWalletModal: vi.fn(),
  mockPrimaryAddress: { current: null as Address | null },
}));

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");

  return {
    ...actual,
    useAppKit: () => ({ open: mockOpenWalletModal }),
    useGardens: (...args: unknown[]) => mockUseGardens(...args),
    useUser: () => ({ primaryAddress: mockPrimaryAddress.current }),
  };
});

vi.mock("@/components/Dialogs", () => ({
  VaultDepositDialog: ({ isOpen, gardenName }: { isOpen: boolean; gardenName: string }) =>
    isOpen ? <div data-testid="vault-deposit-dialog">{gardenName}</div> : null,
  CookieJarDepositDialog: ({ isOpen, gardenName }: { isOpen: boolean; gardenName: string }) =>
    isOpen ? <div data-testid="cookie-jar-dialog">{gardenName}</div> : null,
}));

import FundPage from "../../views/Public/Fund";

const messages: Record<string, string> = {
  "public.fund.title": "Fund",
  "public.fund.description": "Support regenerative gardens by funding their vaults",
  "public.fund.deposit": "Deposit",
  "public.fund.cookieJar": "Cookie Jar",
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

describe("FundPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrimaryAddress.current = null;
    mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false });
  });

  it("renders aggregate stats for gardens and gardeners", () => {
    renderView();

    expect(screen.getByText("Total Gardens")).toBeInTheDocument();
    expect(screen.getByText("Total Gardeners")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders a funding card with deposit and cookie jar actions for each garden", () => {
    renderView();

    expect(screen.getByText("Solar Community Garden")).toBeInTheDocument();
    expect(screen.getByText("Urban Composting Hub")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Deposit" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Cookie Jar" })).toHaveLength(2);
  });

  it("opens the wallet modal when a disconnected user starts a deposit", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getAllByRole("button", { name: "Deposit" })[0]);

    expect(mockOpenWalletModal).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("vault-deposit-dialog")).not.toBeInTheDocument();
  });

  it("opens the vault dialog when the user is already connected", async () => {
    const user = userEvent.setup();
    mockPrimaryAddress.current = "0x9999999999999999999999999999999999999999";
    renderView();

    await user.click(screen.getAllByRole("button", { name: "Deposit" })[0]);

    expect(mockOpenWalletModal).not.toHaveBeenCalled();
    expect(screen.getByTestId("vault-deposit-dialog")).toHaveTextContent("Solar Community Garden");
  });

  it("keeps the page deposit-only with no withdraw action", () => {
    renderView();

    expect(screen.queryByRole("button", { name: /withdraw/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/withdraw/i)).not.toBeInTheDocument();
  });

  it("opens the wallet modal from the Connect Wallet CTA", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("button", { name: "Connect Wallet" }));

    expect(mockOpenWalletModal).toHaveBeenCalledTimes(1);
  });
});
