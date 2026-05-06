/**
 * Fund view behavior tests for the editorial public browser refresh.
 *
 * Locks the public-only contract:
 * - Each Garden row exposes Donate + Endow CTAs (no intermediate intent picker).
 * - Tapping Donate or Endow opens PublicFundingCard with the matching intent.
 * - `?intent=` mounts the receipt UI.
 * - `?garden=` stale resolution renders a non-blocking message.
 * - The page stays support-only (no withdraw / admin controls).
 *
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGardens = [
  {
    id: "0x1111111111111111111111111111111111111111" as Address,
    address: "0x1111111111111111111111111111111111111111" as Address,
    name: "Solar Community Garden",
    slug: "solar-community-garden",
    description: "A solar-powered community garden",
    location: "Austin, TX",
    bannerImage: "https://example.com/banner.jpg",
    contributorCount: 2,
    actionCount: 1,
    lastActivityAt: 1700000000,
    operators: [],
    evaluators: [],
  },
  {
    id: "0x2222222222222222222222222222222222222222" as Address,
    address: "0x2222222222222222222222222222222222222222" as Address,
    name: "Urban Composting Hub",
    slug: "urban-composting-hub",
    description: "Turning waste into soil",
    location: "Portland, OR",
    bannerImage: "",
    contributorCount: 1,
    actionCount: 0,
    lastActivityAt: 1690000000,
    operators: [],
    evaluators: [],
  },
];

const { mockUsePublicGardens, mockUsePublicVaultSummary, mockOpenWalletModal, mockPrimaryAddress } =
  vi.hoisted(() => ({
    mockUsePublicGardens: vi.fn(),
    mockUsePublicVaultSummary: vi.fn(),
    mockOpenWalletModal: vi.fn(),
    mockPrimaryAddress: { current: null as Address | null },
  }));

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");
  return {
    ...actual,
    useAppKit: () => ({ open: mockOpenWalletModal }),
    usePublicGardens: (...args: unknown[]) => mockUsePublicGardens(...args),
    usePublicVaultSummary: (...args: unknown[]) => mockUsePublicVaultSummary(...args),
    useUser: () => ({ primaryAddress: mockPrimaryAddress.current }),
  };
});

vi.mock("@/components/Public/PublicFundingCard", () => ({
  PublicFundingCard: ({
    open,
    intent,
    garden,
  }: {
    open: boolean;
    intent: "donate" | "endow";
    garden: { name: string };
  }) =>
    open ? (
      <div data-testid="public-funding-card" data-intent={intent}>
        {garden.name}
      </div>
    ) : null,
}));

vi.mock("@/components/Public/PublicFundingReceipt", () => ({
  PublicFundingReceipt: ({ intentId }: { intentId: string }) => (
    <div data-testid="public-funding-receipt">{intentId}</div>
  ),
}));

vi.mock("@/routes/WalletRuntimeProviders", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import FundPage from "../../views/Public/Fund";

const messages: Record<string, string> = {
  "public.fund.title": "Fund",
  "public.fund.heroTitle": "A small gesture today, growing over many seasons.",
  "public.fund.heroLede":
    "Donate to support a Garden's immediate work, or Endow a Vault designed so yield helps the Garden over time.",
  "public.fund.dialog.donate.title": "Donate",
  "public.fund.dialog.endow.title": "Endow",
};

function renderView(initialEntries: string[] = ["/fund"]) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries },
      createElement(IntlProvider, { locale: "en", messages }, createElement(FundPage))
    )
  );
}

describe("FundPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrimaryAddress.current = null;
    mockUsePublicGardens.mockReturnValue({ data: mockGardens, isLoading: false });
    mockUsePublicVaultSummary.mockReturnValue({
      hasVaults: true,
      isLoading: false,
      isError: false,
      isYieldLoading: false,
      isYieldError: false,
      isAllocationLoading: false,
      isAllocationError: false,
      gardensByAddress: {
        "0x1111111111111111111111111111111111111111": {
          garden: "0x1111111111111111111111111111111111111111",
          hasVaults: true,
          assets: [
            {
              symbol: "DAI",
              asset: "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1",
              chainId: 42161,
              decimals: 18,
              vaultCount: 1,
              netDeposited: 2_000_000_000_000_000_000_000n,
              accruingYield: 5_000_000_000_000_000_000n,
              currentValue: 2_005_000_000_000_000_000_000n,
              allocatedYield: 20_000_000_000_000_000_000n,
              accruedYield: 25_000_000_000_000_000_000n,
              apr: 5.1,
              apy: undefined,
              isAprLoading: false,
              isAprError: false,
            },
            {
              symbol: "ETH",
              asset: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
              chainId: 42161,
              decimals: 18,
              vaultCount: 1,
              netDeposited: 1_200_000_000_000_000_000n,
              accruingYield: 50_000_000_000_000_000n,
              currentValue: 1_250_000_000_000_000_000n,
              allocatedYield: 100_000_000_000_000_000n,
              accruedYield: 150_000_000_000_000_000n,
              apr: 2.5,
              apy: undefined,
              isAprLoading: false,
              isAprError: false,
            },
          ],
        },
      },
      assets: [
        {
          symbol: "DAI",
          asset: "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1",
          chainId: 42161,
          decimals: 18,
          vaultCount: 1,
          netDeposited: 2_000_000_000_000_000_000_000n,
          accruingYield: 5_000_000_000_000_000_000n,
          currentValue: 2_005_000_000_000_000_000_000n,
          allocatedYield: 20_000_000_000_000_000_000n,
          accruedYield: 25_000_000_000_000_000_000n,
          apr: 5.1,
          apy: undefined,
          isAprLoading: false,
          isAprError: false,
        },
        {
          symbol: "ETH",
          asset: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
          chainId: 42161,
          decimals: 18,
          vaultCount: 1,
          netDeposited: 1_200_000_000_000_000_000n,
          accruingYield: 50_000_000_000_000_000n,
          currentValue: 1_250_000_000_000_000_000n,
          allocatedYield: 100_000_000_000_000_000n,
          accruedYield: 150_000_000_000_000_000n,
          apr: 2.5,
          apy: undefined,
          isAprLoading: false,
          isAprError: false,
        },
      ],
    });
  });

  it("renders the editorial hero", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
      /a small gesture today, growing over many seasons/i
    );
  });

  it("each Garden row exposes Donate + Endow CTAs (no intermediate picker)", () => {
    renderView();
    const donateButtons = screen.getAllByRole("button", { name: "Donate" });
    const endowButtons = screen.getAllByRole("button", { name: "Endow" });
    expect(donateButtons).toHaveLength(2);
    expect(endowButtons).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Support" })).toBeNull();
  });

  it("clicking Donate opens PublicFundingCard with intent=donate", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getAllByRole("button", { name: "Donate" })[0]);
    const card = await screen.findByTestId("public-funding-card");
    expect(card).toHaveAttribute("data-intent", "donate");
    expect(card).toHaveTextContent("Solar Community Garden");
  });

  it("clicking Endow opens PublicFundingCard with intent=endow", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getAllByRole("button", { name: "Endow" })[1]);
    const card = await screen.findByTestId("public-funding-card");
    expect(card).toHaveAttribute("data-intent", "endow");
    expect(card).toHaveTextContent("Urban Composting Hub");
  });

  it("?intent= mounts the receipt UI", () => {
    renderView(["/fund?intent=fi_abc"]);
    expect(screen.getByTestId("public-funding-receipt")).toHaveTextContent("fi_abc");
  });

  it("renders a stale-query message for /fund?garden=missing", () => {
    renderView(["/fund?garden=missing"]);
    expect(screen.getByText(/Garden matching "missing"/)).toBeInTheDocument();
  });

  it("keeps the page support-only — no withdraw / admin controls", () => {
    renderView();
    expect(screen.queryByRole("button", { name: /withdraw/i })).toBeNull();
    expect(screen.queryByText(/withdraw/i)).toBeNull();
  });

  it("renders the standalone vault section between the hero and Donate/Endow context", () => {
    renderView();

    const hero = screen.getByRole("heading", { level: 1 });
    const vaults = screen.getByRole("heading", { name: /Vaults currently at work/i });
    const paths = screen.getByRole("heading", { name: /Donate now, or Endow/i });
    const gardens = screen.getByRole("heading", { name: /Gardens accepting support/i });

    expect(hero.compareDocumentPosition(vaults) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(vaults.compareDocumentPosition(paths) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(paths.compareDocumentPosition(gardens) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("§ 01 — Vaults at work")).toBeInTheDocument();
    expect(screen.getByText("§ 02 — Ways to support")).toBeInTheDocument();
    expect(screen.getByText("§ 03 — Choose where to apply your support")).toBeInTheDocument();
  });

  it("shows aggregate DAI and ETH totals, APR, accrued yield, allocated yield, and live accruing yield", () => {
    renderView();

    expect(screen.getByText("DAI in vaults")).toBeInTheDocument();
    expect(screen.getByText("2,005 DAI")).toBeInTheDocument();
    expect(screen.getByText("APR 5.10%")).toBeInTheDocument();
    expect(screen.getByText("Yield accrued 25 DAI")).toBeInTheDocument();
    expect(screen.getByText("Allocated 20 DAI")).toBeInTheDocument();
    expect(screen.getByText("Accruing now 5 DAI")).toBeInTheDocument();

    expect(screen.getByText("ETH in vaults")).toBeInTheDocument();
    expect(screen.getByText("1.25 ETH")).toBeInTheDocument();
    expect(screen.getByText("APR 2.50%")).toBeInTheDocument();
    expect(screen.getByText("Yield accrued 0.15 ETH")).toBeInTheDocument();
    expect(screen.getByText("Allocated 0.1 ETH")).toBeInTheDocument();
    expect(screen.getByText("Accruing now 0.05 ETH")).toBeInTheDocument();
  });

  it("shows DAI, ETH, and yield accrued inside Garden cards", () => {
    renderView();

    const gardenCard = screen.getByRole("group", {
      name: "Solar Community Garden funding options",
    });
    expect(gardenCard).toHaveTextContent("2,005 DAI · 1.25 ETH");
    expect(gardenCard).toHaveTextContent("Yield accrued 25 DAI / 0.15 ETH");
  });

  it("omits vault metrics when no indexed vaults exist", () => {
    mockUsePublicVaultSummary.mockReturnValue({
      hasVaults: false,
      isLoading: false,
      isError: false,
      isYieldLoading: false,
      isYieldError: false,
      isAllocationLoading: false,
      isAllocationError: false,
      gardensByAddress: {},
      assets: [],
    });

    renderView();

    expect(screen.queryByRole("heading", { name: /Vaults currently at work/i })).toBeNull();
    expect(screen.queryByText(/DAI in vaults/)).toBeNull();
    expect(screen.queryByText(/Yield accrued/)).toBeNull();
  });
});
