/**
 * Fund view behavior tests for the editorial public browser refresh.
 *
 * Locks the public-only contract:
 * - Each Garden row exposes Donate + Endow CTAs (no intermediate intent picker).
 * - Tapping Donate or Endow opens PublicFundingCard with the matching intent.
 * - `?intent=` mounts the receipt UI.
 * - `?garden=` stale resolution renders a non-blocking message.
 * - The Garden section exposes the public Manage Endowments panel text button.
 *
 * @vitest-environment jsdom
 */

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, Fragment, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
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

const {
  mockUseInViewReveal,
  mockUsePublicGardens,
  mockUsePublicVaultSummary,
  mockOpenWalletModal,
  mockPrimaryAddress,
  mockLastEndowmentExitComplete,
} = vi.hoisted(() => ({
  mockUseInViewReveal: vi.fn(),
  mockUsePublicGardens: vi.fn(),
  mockUsePublicVaultSummary: vi.fn(),
  mockOpenWalletModal: vi.fn(),
  mockPrimaryAddress: { current: null as Address | null },
  mockLastEndowmentExitComplete: { current: null as (() => void) | null },
}));

vi.mock("@green-goods/shared", () => {
  const formatMockTokenAmount = (value: bigint, decimals = 18, maximumFractionDigits = 4) => {
    const scale = 10n ** BigInt(decimals);
    const whole = value / scale;
    const remainder = value % scale;
    const normalized = Number(whole) + Number(remainder) / Number(scale);
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits,
    }).format(normalized);
  };

  return {
    cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
    formatApy: (value: number) => `${value.toFixed(2)}%`,
    formatRelativeTime: () => "recently",
    formatTokenAmount: formatMockTokenAmount,
    ImageWithFallback: ({
      alt = "",
      className,
      backgroundFallback,
      src,
    }: {
      alt?: string;
      className?: string;
      backgroundFallback?: ReactNode;
      src?: string;
    }) =>
      src ? (
        <img alt={alt} className={className} src={src} />
      ) : backgroundFallback ? (
        <>{backgroundFallback}</>
      ) : (
        <div aria-hidden="true" className={className} />
      ),
    publicGardenHelpers: {
      deriveSlug: (name: string, id: string) =>
        name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || id.toLowerCase(),
    },
    useAppKit: () => ({ open: mockOpenWalletModal }),
    useInViewReveal: (...args: unknown[]) => mockUseInViewReveal(...args),
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

vi.mock("@/components/Public/PublicEndowmentPanel", () => ({
  PublicEndowmentPanel: ({
    open,
    onExitComplete,
    onOpenChange,
  }: {
    open: boolean;
    onExitComplete?: () => void;
    onOpenChange: (open: boolean) => void;
  }) => {
    mockLastEndowmentExitComplete.current = onExitComplete ?? null;

    return open ? (
      <div role="dialog" aria-label="Your Endowments" data-testid="public-endowment-panel">
        <button type="button" onClick={() => onOpenChange(false)}>
          Close endowments
        </button>
      </div>
    ) : null;
  },
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

function HistoryBackButton() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      History back
    </button>
  );
}

function LocationSearchProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderView(
  initialEntries: string[] = ["/fund"],
  options: { initialIndex?: number; extra?: ReactNode } = {}
) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries, initialIndex: options.initialIndex },
      createElement(
        IntlProvider,
        { locale: "en", messages },
        createElement(Fragment, null, options.extra, createElement(FundPage))
      )
    )
  );
}

describe("FundPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLastEndowmentExitComplete.current = null;
    mockPrimaryAddress.current = null;
    mockUseInViewReveal.mockReturnValue({ ref: { current: null }, revealed: true });
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
              depositorCount: 2,
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
              depositorCount: 3,
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
          depositorCount: 2,
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
          depositorCount: 3,
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

  it("keeps /fund Donate as shared fund support and Endow as endowment support", () => {
    renderView();

    expect(screen.getAllByText(/Garden's shared fund/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Garden Vault endowment/i).length).toBeGreaterThan(0);

    for (const garden of mockGardens) {
      const row = screen.getByRole("group", {
        name: `${garden.name} funding options`,
      });

      expect(within(row).getByRole("button", { name: "Donate" })).toBeEnabled();
      expect(within(row).getByText("Shared fund support")).toBeInTheDocument();
      expect(within(row).getByRole("button", { name: "Endow" })).toBeEnabled();
      expect(within(row).getByText("Garden Vault endowment")).toBeInTheDocument();
    }
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

  it("places Manage Endowments as a text button in the Garden selection section", () => {
    renderView();
    const gardenSection = screen
      .getByRole("heading", { name: /Gardens accepting support/i })
      .closest("section");

    expect(gardenSection).not.toBeNull();
    const manageButton = within(gardenSection as HTMLElement).getByRole("button", {
      name: "Manage Endowments",
    });

    expect(manageButton).toBeInTheDocument();
    expect(manageButton).toHaveAttribute("type", "button");
    expect(manageButton).toHaveAttribute("aria-haspopup", "dialog");
    expect(manageButton).not.toHaveAttribute("href");
  });

  it("opens the endowment panel from the Garden section text button", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("button", { name: "Manage Endowments" }));

    expect(screen.getByTestId("public-endowment-panel")).toBeInTheDocument();
  });

  it("keeps Garden selection cards in a max two-column equal-row grid", () => {
    renderView();

    const grid = screen.getByTestId("public-fund-garden-grid");
    expect(grid).toHaveClass("sm:grid-cols-2");
    expect(grid).toHaveClass("sm:auto-rows-fr");
    expect(grid.className).not.toContain("grid-cols-3");

    const gardenCard = screen.getByRole("group", {
      name: "Solar Community Garden funding options",
    });
    expect(gardenCard).toHaveAttribute("data-component", "PublicGardenRow");
    expect(gardenCard).toHaveClass("h-full");
    expect(gardenCard).toHaveClass("min-w-0");
    expect(gardenCard.parentElement).toHaveClass("h-full");
    expect(gardenCard.parentElement).toHaveClass("min-w-0");

    const vaultMetrics = within(gardenCard)
      .getByText(/2,005 DAI/)
      .closest("p");
    expect(vaultMetrics).toHaveClass("min-w-0");
    expect(vaultMetrics).toHaveClass("max-w-full");
    expect(vaultMetrics?.className).toContain("[overflow-wrap:anywhere]");
  });

  it("keeps compact Garden media rectangular with fitted fallback initials", () => {
    renderView();

    const imageCard = screen.getByRole("group", {
      name: "Solar Community Garden funding options",
    });
    const imageMedia = imageCard.querySelector('[data-component="PublicGardenRowMedia"]');
    expect(imageMedia).toHaveClass("h-20");
    expect(imageMedia).toHaveClass("w-28");
    expect(imageMedia).toHaveClass("sm:h-24");
    expect(imageMedia).toHaveClass("sm:w-36");
    expect(imageMedia?.className).not.toContain("w-20");

    const fallbackCard = screen.getByRole("group", {
      name: "Urban Composting Hub funding options",
    });
    const fallbackInitial = fallbackCard.querySelector(
      '[data-component="GardenCoverFallbackInitial"]'
    );
    expect(fallbackInitial).toHaveTextContent("UC");
    expect(fallbackInitial).toHaveClass("text-3xl");
    expect(fallbackInitial).toHaveClass("sm:text-4xl");
    expect(fallbackInitial).toHaveClass("lg:text-4xl");
  });

  it("opens the endowment panel from /fund?manage=endowments", () => {
    renderView(["/fund?manage=endowments"]);

    expect(screen.getByTestId("public-endowment-panel")).toBeInTheDocument();
  });

  it("keeps the manage query until the endowment panel exit completes", async () => {
    const user = userEvent.setup();
    renderView(["/fund?manage=endowments"], { extra: createElement(LocationSearchProbe) });

    expect(screen.getByTestId("location-search")).toHaveTextContent("?manage=endowments");

    await user.click(screen.getByRole("button", { name: "Close endowments" }));

    expect(screen.queryByTestId("public-endowment-panel")).toBeNull();
    expect(screen.getByTestId("location-search")).toHaveTextContent("?manage=endowments");

    act(() => {
      mockLastEndowmentExitComplete.current?.();
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent("");
    });
  });

  it("closes the endowment panel when navigation removes the manage query", async () => {
    const user = userEvent.setup();
    renderView(["/fund", "/fund?manage=endowments"], {
      initialIndex: 1,
      extra: createElement(HistoryBackButton),
    });

    expect(screen.getByTestId("public-endowment-panel")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "History back" }));

    await waitFor(() => {
      expect(screen.queryByTestId("public-endowment-panel")).toBeNull();
    });
  });

  it("renders the standalone vault section between the hero and Donate/Endow context", () => {
    renderView();

    const hero = screen.getByRole("heading", { level: 1 });
    const vaults = screen.getByRole("heading", {
      name: /Endowment capital already supporting Gardens/i,
    });
    const paths = screen.getByRole("heading", { name: /Donate now, or Endow/i });
    const gardens = screen.getByRole("heading", { name: /Gardens accepting support/i });

    expect(hero.compareDocumentPosition(vaults) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(vaults.compareDocumentPosition(paths) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(paths.compareDocumentPosition(gardens) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("§ 01 — Endowment engine")).toBeInTheDocument();
    expect(screen.getByText("§ 02 — Ways to support")).toBeInTheDocument();
    expect(screen.getByText("§ 03 — Choose where to apply your support")).toBeInTheDocument();
  });

  it("wires the vault stats section into the reveal lifecycle", () => {
    renderView();

    const vaultSection = screen
      .getByRole("heading", { name: /Endowment capital already supporting Gardens/i })
      .closest("section");

    expect(vaultSection).toHaveAttribute("data-revealed", "true");
  });

  it("shows aggregate DAI and ETH current balance, APR, harvestable yield, routing, vaults, and positions", () => {
    renderView();

    const daiCard = screen.getByText("DAI endowment balance").closest("article");
    expect(daiCard).toHaveTextContent("Current balance");
    expect(daiCard).toHaveTextContent("2,005 DAI");
    expect(daiCard).toHaveTextContent("APR");
    expect(daiCard).toHaveTextContent("5.10%");
    expect(daiCard).toHaveTextContent("Ready to harvest");
    expect(daiCard).toHaveTextContent("5 DAI");
    expect(daiCard).toHaveTextContent("Routed to Gardens");
    expect(daiCard).toHaveTextContent("20 DAI");
    expect(daiCard).toHaveTextContent("Vaults");
    expect(daiCard).toHaveTextContent("1 vault");
    expect(daiCard).toHaveTextContent("Funding positions");
    expect(daiCard).toHaveTextContent("2 funding positions");

    const ethCard = screen.getByText("ETH endowment balance").closest("article");
    expect(ethCard).toHaveTextContent("Current balance");
    expect(ethCard).toHaveTextContent("1.25 ETH");
    expect(ethCard).toHaveTextContent("APR");
    expect(ethCard).toHaveTextContent("2.50%");
    expect(ethCard).toHaveTextContent("Ready to harvest");
    expect(ethCard).toHaveTextContent("0.05 ETH");
    expect(ethCard).toHaveTextContent("Routed to Gardens");
    expect(ethCard).toHaveTextContent("0.1 ETH");
    expect(ethCard).toHaveTextContent("Vaults");
    expect(ethCard).toHaveTextContent("1 vault");
    expect(ethCard).toHaveTextContent("Funding positions");
    expect(ethCard).toHaveTextContent("3 funding positions");
  });

  it("shows live yield unavailable instead of a false zero", () => {
    const defaultSummary = mockUsePublicVaultSummary();
    mockUsePublicVaultSummary.mockReturnValue({
      ...defaultSummary,
      assets: defaultSummary.assets.map((asset) =>
        asset.symbol === "DAI" ? { ...asset, accruingYield: undefined } : asset
      ),
    });

    renderView();

    const daiCard = screen.getByText("DAI endowment balance").closest("article");
    expect(daiCard).toHaveTextContent("Live yield unavailable");
    expect(daiCard).not.toHaveTextContent("Ready to harvest 0 DAI");
    expect(screen.queryByText("Accruing now 0 DAI")).toBeNull();
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

    expect(
      screen.queryByRole("heading", { name: /Endowment capital already supporting Gardens/i })
    ).toBeNull();
    expect(screen.queryByText(/DAI endowment balance/)).toBeNull();
    expect(screen.queryByText(/Yield accrued/)).toBeNull();
  });
});
