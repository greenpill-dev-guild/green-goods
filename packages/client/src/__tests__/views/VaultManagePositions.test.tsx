/**
 * Route-local vault position management (`/vaults?manage=positions`) tests.
 *
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, Fragment, useEffect } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OctantVaultCampaignManifest, OctantVaultPosition } from "@green-goods/shared";
import VaultsPage, { VaultsPageContent } from "../../views/Public/Vaults";

// Hoisted so vi.mock factories and the hoisted mock state can reference them.
const { CONNECTED, CARD, VAULT, ASSET } = vi.hoisted(() => ({
  CONNECTED: "0x1111111111111111111111111111111111111111",
  CARD: "0x2222222222222222222222222222222222222222",
  VAULT: "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5",
  ASSET: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
}));

const mocks = vi.hoisted(() => ({
  authMode: null as "wallet" | "passkey" | "embedded" | null,
  primaryAddress: undefined as string | undefined,
  ensName: null as string | null,
  loginWithWallet: vi.fn(),
  walletRuntimeRender: vi.fn(),
  positionsByOwner: {} as Record<string, ReturnType<typeof emptyPositions> | undefined>,
  redeemMutateAsync: vi.fn(async () => "0xhash"),
  redeemReset: vi.fn(),
  // Drive the wallet-endow mutation straight to success in the copy test.
  walletEndowMutate: vi.fn((_tx: unknown, opts?: { onSuccess?: (hash: string) => void }) =>
    opts?.onSuccess?.("0xhash")
  ),
  // Stable identity — the real hook returns a stable reset; an unstable one would
  // retrigger WalletEndowPathContent's reset effect and clobber the success state.
  walletEndowReset: vi.fn(),
  wrapEthToWethMutate: vi.fn(),
  wrapEthToWethReset: vi.fn(),
  walletBalancesRefetch: vi.fn(async () => undefined),
}));

function emptyPositions() {
  return {
    positions: [] as OctantVaultPosition[],
    hasPositions: false,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(async () => undefined),
  };
}

function makePosition(over: Partial<OctantVaultPosition> = {}): OctantVaultPosition {
  return {
    campaignSlug: "greenpill-nyc",
    displayName: "Greenpill NYC",
    communityName: "Greenpill NYC",
    vaultAddress: VAULT as `0x${string}`,
    chainId: 1,
    assetAddress: ASSET as `0x${string}`,
    assetSymbol: "WETH",
    assetDecimals: 18,
    shareDecimals: 18,
    shares: 1_000_000_000_000_000_000n,
    positionValue: 1_200_000_000_000_000_000n,
    redeemableShares: 1_000_000_000_000_000_000n,
    estimatedRedeemAssets: 1_200_000_000_000_000_000n,
    explorerLink: `https://etherscan.io/address/${VAULT}`,
    ...over,
  };
}

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    useAuth: () => ({ loginWithWallet: mocks.loginWithWallet }),
    useUser: () => ({ authMode: mocks.authMode, primaryAddress: mocks.primaryAddress }),
    useEnsName: () => ({
      data: mocks.ensName,
      isLoading: false,
      isError: false,
    }),
    useOctantVaultPositions: (owner?: string | null) =>
      owner ? (mocks.positionsByOwner[owner.toLowerCase()] ?? emptyPositions()) : emptyPositions(),
    useOctantVaultRedeem: () => ({
      mutateAsync: mocks.redeemMutateAsync,
      mutate: vi.fn(),
      reset: mocks.redeemReset,
      isPending: false,
      error: null,
    }),
    useOctantVaultWalletEndow: () => ({
      mutate: mocks.walletEndowMutate,
      reset: mocks.walletEndowReset,
      error: null,
      isPending: false,
    }),
    useWrapEthToWeth: () => ({
      mutate: mocks.wrapEthToWethMutate,
      reset: mocks.wrapEthToWethReset,
      error: null,
      isPending: false,
    }),
    useOctantVaultWalletBalances: () => ({
      nativeBalance: null,
      assetBalance: null,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.walletBalancesRefetch,
    }),
    useEthUsdPrice: () => ({
      hasFeed: false,
      priceAnswer: 0n,
      isLoading: false,
      isError: false,
      isStale: false,
      updatedAt: 0n,
    }),
    useOctantVaultStats: () => ({
      totalAssets: 0n,
      usdCents: null,
      isLoading: false,
      isError: false,
    }),
    useOctantVaultHarvestableYield: () => ({
      status: "unavailable",
      strategyAddress: null,
      strategyAssets: 0n,
      vaultDebt: 0n,
      harvestableAssets: 0n,
      isLoading: false,
      isError: false,
      unavailableReason: "missing_strategy",
    }),
    useOctantVaultProjectSupportMetric: () => ({
      status: "unavailable",
      sourceAddress: null,
      shareBalance: 0n,
      assetValue: 0n,
      isLoading: false,
      isError: false,
      unavailableReason: "missing_source",
    }),
    useOctantVaultStrategyApy: () => ({
      status: "unavailable",
      apy: null,
      apr: null,
      sourceAddress: null,
      sourceKind: "yearn-v3",
      isLoading: false,
      isError: false,
      unavailableReason: "missing_source",
    }),
  };
});

/** Wallet-only stablecoin campaign — avoids the ETH price feed. */
function makeStableCampaign(): OctantVaultCampaignManifest {
  return {
    slug: "synthetic-complete",
    displayName: "Synthetic complete campaign",
    communityName: "Synthetic Community",
    fixtureRole: "standard_campaign",
    routePath: "/vaults",
    targetProtocol: "octant-v2-ethereum",
    campaignCopy: {
      headline: "Fund a complete Octant vault",
      summary: "A complete fixture for manifest validation.",
      fundingPurpose: "Support public goods work through a dedicated vault.",
      recipientLogic: "Yield routes through the supplied recipient configuration.",
      riskNote: "Vault deposits depend on the underlying token and Octant vault strategy.",
    },
    vault: {
      chainId: 1,
      vaultAddress: "0x1111111111111111111111111111111111111111",
      asset: { address: "0x2222222222222222222222222222222222222222", symbol: "USDC", decimals: 6 },
      explorerLink: "https://etherscan.io/address/0x1111111111111111111111111111111111111111",
    },
    recipientRoutingSummary: "Yield routes to a verified public goods recipient.",
    protocolGuildDestinationContext: "Protocol Guild allocation context is recorded.",
  };
}

vi.mock("@/routes/WalletRuntimeProviders", async () => {
  const { createElement: ce } = await import("react");
  return {
    default: ({ children }: { children: unknown }) => {
      mocks.walletRuntimeRender();
      return ce("div", { "data-testid": "wallet-runtime-provider" }, children);
    },
  };
});

const intlMessages = {
  "app.common.close": "Close",
  "app.treasury.invalidAmount": "Enter a valid amount.",
};

function renderPage(path = "/vaults") {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(
        IntlProvider,
        { locale: "en", messages: intlMessages },
        createElement(VaultsPage)
      )
    )
  );
}

function LocationProbe({ onChange }: { onChange: (location: string) => void }) {
  const location = useLocation();

  useEffect(() => {
    onChange(`${location.pathname}${location.search}${location.hash}`);
  }, [location.hash, location.pathname, location.search, onChange]);

  return null;
}

function renderPageWithLocationProbe(path: string, onLocationChange: (location: string) => void) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(
        IntlProvider,
        { locale: "en", messages: intlMessages },
        createElement(
          Fragment,
          null,
          createElement(VaultsPage),
          createElement(LocationProbe, { onChange: onLocationChange })
        )
      )
    )
  );
}

/** Seed one pending-funded recovery entry (safe public metadata only). */
function seedPendingFundedEntry() {
  window.localStorage.setItem(
    "gg:octant-vault-card-wallets:v1",
    JSON.stringify([
      {
        recoveredWalletAddress: CARD,
        campaignSlug: "greenpill-nyc",
        vaultAddress: VAULT,
        chainId: 1,
        updatedAt: 1000,
        status: "pending_funded",
        tokenAddress: ASSET,
        expectedAmount: "10000000000000000",
      },
    ])
  );
}

function renderContent(campaigns: OctantVaultCampaignManifest[]) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/vaults"] },
      createElement(
        IntlProvider,
        { locale: "en", messages: intlMessages },
        createElement(VaultsPageContent, { campaigns })
      )
    )
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authMode = null;
  mocks.primaryAddress = undefined;
  mocks.ensName = null;
  mocks.positionsByOwner = {};
  mocks.wrapEthToWethMutate.mockClear();
  mocks.wrapEthToWethReset.mockClear();
  mocks.walletBalancesRefetch.mockClear();
  window.localStorage.clear();
  window.history.pushState({}, "", "/");
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("/vaults browse (no management)", () => {
  it("renders without a wallet runtime and shows a Manage Endowments entry point", () => {
    renderPage("/vaults");
    // Browse must render with no wallet runtime mounted.
    expect(mocks.walletRuntimeRender).not.toHaveBeenCalled();
    expect(screen.queryByTestId("vault-manage-positions-panel")).toBeNull();
    const entry = screen.getByTestId("vault-manage-positions-entry");
    expect(entry).toBeInTheDocument();
    expect(entry).toHaveTextContent("Manage Endowments");
    expect(entry.parentElement).toHaveClass("justify-end");
    expect(entry.closest("header")).toHaveClass("sm:justify-between");
  });
});

describe("/vaults?manage=positions", () => {
  it("opens the management panel directly from the query param", () => {
    mocks.authMode = "wallet";
    mocks.primaryAddress = CONNECTED;
    renderPage("/vaults?manage=positions");
    const panel = screen.getByTestId("vault-manage-positions-panel");
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveClass("rounded-none");
    expect(panel).toHaveClass("sm:rounded-none");
    expect(panel).not.toHaveClass("rounded-t-3xl");
    expect(panel).not.toHaveClass("sm:rounded-3xl");
    expect(mocks.walletRuntimeRender).toHaveBeenCalled();
  });

  it("wires motion hooks for the open management panel", () => {
    mocks.authMode = "wallet";
    mocks.primaryAddress = CONNECTED;
    renderPage("/vaults?manage=positions");

    const overlay = document.querySelector(
      '[data-component="VaultManagePositionsPanel"][data-slot="overlay"]'
    );
    const panel = document.querySelector(
      '[data-component="VaultManagePositionsPanel"][data-slot="surface"]'
    );

    expect(overlay).not.toBeNull();
    expect(overlay).toHaveClass("vault-manage-overlay");
    expect(overlay).toHaveAttribute("data-state", "open");
    expect(overlay).toHaveAttribute("data-motion-state", "open");

    expect(panel).not.toBeNull();
    expect(panel).toHaveClass("vault-manage-panel");
    expect(panel).toHaveAttribute("data-state", "open");
    expect(panel).toHaveAttribute("data-motion-state", "open");
  });

  it("keeps the panel mounted until close animation ends, then clears manage while preserving params", async () => {
    const user = userEvent.setup();
    const locations: string[] = [];
    mocks.authMode = "wallet";
    mocks.primaryAddress = CONNECTED;

    renderPageWithLocationProbe("/vaults?manage=positions&ref=newsletter", (location) => {
      locations.push(location);
    });

    await user.click(screen.getByRole("button", { name: "Close Manage Endowments" }));

    const panel = document.querySelector(
      '[data-component="VaultManagePositionsPanel"][data-slot="surface"]'
    );
    const overlay = document.querySelector(
      '[data-component="VaultManagePositionsPanel"][data-slot="overlay"]'
    );

    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute("data-motion-state", "closed");
    expect(overlay).not.toBeNull();
    expect(overlay).toHaveAttribute("data-motion-state", "closed");
    expect(locations[locations.length - 1]).toBe("/vaults?manage=positions&ref=newsletter");

    fireEvent.animationEnd(panel!);

    await waitFor(() => {
      expect(
        document.querySelector('[data-component="VaultManagePositionsPanel"][data-slot="surface"]')
      ).toBeNull();
    });
    expect(locations[locations.length - 1]).toBe("/vaults?ref=newsletter");
  });

  it("renders connected-wallet positions under the Connected wallet source", () => {
    mocks.authMode = "wallet";
    mocks.primaryAddress = CONNECTED;
    mocks.positionsByOwner[CONNECTED.toLowerCase()] = {
      ...emptyPositions(),
      positions: [makePosition()],
      hasPositions: true,
    };
    renderPage("/vaults?manage=positions");

    const panel = screen.getByTestId("vault-manage-positions-panel");
    expect(within(panel).getByText("Greenpill NYC")).toBeInTheDocument();
    expect(within(panel).getByText("WETH vault shares")).toBeInTheDocument();
    // Share value label is present (precise WETH wording, not Fund language).
    expect(within(panel).getByText(/Value in WETH/)).toBeInTheDocument();
    expect(within(panel).getByText("Ethereum Mainnet")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: VAULT })).toHaveAttribute(
      "href",
      `https://etherscan.io/address/${VAULT}`
    );
    expect(within(panel).getByRole("link", { name: /0xC02aaA39/ })).toHaveAttribute(
      "href",
      `https://etherscan.io/address/${ASSET}`
    );
    expect(within(panel).getByTestId("vault-manage-position-greenpill-nyc")).toBeInTheDocument();
  });

  it("shows a localized empty state pointing back to Endow when there are no positions", () => {
    mocks.authMode = "wallet";
    mocks.primaryAddress = CONNECTED; // no positions seeded
    mocks.ensName = "vault-owner.eth";
    renderPage("/vaults?manage=positions");

    const panel = screen.getByTestId("vault-manage-positions-panel");
    expect(within(panel).getByText("Connected wallet")).toBeInTheDocument();
    expect(within(panel).getByText("vault-owner.eth")).toBeInTheDocument();
    expect(within(panel).getByText("No vault shares for this wallet yet")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Endow a campaign" })).toBeInTheDocument();
  });

  it("gates redeem: disabled over the redeemable max, enabled and signs for a valid share amount", async () => {
    const user = userEvent.setup();
    mocks.authMode = "wallet";
    mocks.primaryAddress = CONNECTED;
    mocks.positionsByOwner[CONNECTED.toLowerCase()] = {
      ...emptyPositions(),
      positions: [makePosition({ redeemableShares: 1_000_000_000_000_000_000n })], // 1 share
      hasPositions: true,
    };
    renderPage("/vaults?manage=positions");

    const row = screen.getByTestId("vault-manage-position-greenpill-nyc");
    await user.click(within(row).getByRole("button", { name: "Redeem shares" }));

    const amount = within(row).getByLabelText("Shares to redeem");
    // Over the max → review stays disabled and an error shows.
    await user.type(amount, "2");
    expect(
      within(row).getByText(/higher than the currently redeemable shares/i)
    ).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Review redemption" })).toBeDisabled();

    // Valid amount → review enabled; confirm calls the chain-aware redeem.
    await user.clear(amount);
    await user.type(amount, "0.5");
    const review = within(row).getByRole("button", { name: "Review redemption" });
    expect(review).toBeEnabled();
    await user.click(review);
    expect(within(row).getByText(/approximately 0.6 WETH/i)).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(mocks.redeemMutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.redeemMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 1,
        vaultAddress: VAULT,
        owner: CONNECTED,
        shares: 500_000_000_000_000_000n,
      })
    );
  });

  it("Max fills the exact redeemable shares and round-trips through parseUnits in a comma-decimal locale", async () => {
    // Regression guard for the Max button. It must use a locale-independent
    // formatter (formatUnits) that round-trips through parseUnits. The previous
    // display formatter rendered 1.5 WETH as "1,5" under a comma-decimal locale;
    // stripping commas then turned it into "15" — Max silently filled 15 WETH.
    const originalLanguage = navigator.language;
    Object.defineProperty(navigator, "language", { value: "de-DE", configurable: true });
    try {
      const user = userEvent.setup();
      mocks.authMode = "wallet";
      mocks.primaryAddress = CONNECTED;
      mocks.positionsByOwner[CONNECTED.toLowerCase()] = {
        ...emptyPositions(),
        positions: [
          makePosition({
            redeemableShares: 1_500_000_000_000_000_000n,
            estimatedRedeemAssets: 1_500_000_000_000_000_000n,
          }),
        ], // 1.5 shares
        hasPositions: true,
      };
      renderPage("/vaults?manage=positions");

      const row = screen.getByTestId("vault-manage-position-greenpill-nyc");
      await user.click(within(row).getByRole("button", { name: "Redeem shares" }));
      await user.click(within(row).getByRole("button", { name: "Max" }));

      const amount = within(row).getByLabelText<HTMLInputElement>("Shares to redeem");
      // Locale-independent: exactly "1.5", never "15" (the old comma-strip result).
      expect(amount.value).toBe("1.5");

      const review = within(row).getByRole("button", { name: "Review redemption" });
      expect(review).toBeEnabled();
      await user.click(review);
      await user.click(within(row).getByRole("button", { name: "Confirm" }));

      await waitFor(() => expect(mocks.redeemMutateAsync).toHaveBeenCalledTimes(1));
      expect(mocks.redeemMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ shares: 1_500_000_000_000_000_000n })
      );
    } finally {
      Object.defineProperty(navigator, "language", {
        value: originalLanguage,
        configurable: true,
      });
    }
  });

  it("preserves a leading decimal while typing and normalizes it before submit", async () => {
    const user = userEvent.setup();
    mocks.authMode = "wallet";
    mocks.primaryAddress = CONNECTED;
    mocks.positionsByOwner[CONNECTED.toLowerCase()] = {
      ...emptyPositions(),
      positions: [makePosition({ redeemableShares: 1_000_000_000_000_000_000n })],
      hasPositions: true,
    };
    renderPage("/vaults?manage=positions");

    const row = screen.getByTestId("vault-manage-position-greenpill-nyc");
    await user.click(within(row).getByRole("button", { name: "Redeem shares" }));

    const amount = within(row).getByLabelText<HTMLInputElement>("Shares to redeem");
    await user.type(amount, ".001");
    expect(amount.value).toBe(".001");

    await user.click(within(row).getByRole("button", { name: "Review redemption" }));
    expect(amount.value).toBe("0.001");
    await user.click(within(row).getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(mocks.redeemMutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.redeemMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ shares: 1_000_000_000_000_000n })
    );
  });

  it("explains a visible position when maxRedeem returns zero", () => {
    mocks.authMode = "wallet";
    mocks.primaryAddress = CONNECTED;
    mocks.positionsByOwner[CONNECTED.toLowerCase()] = {
      ...emptyPositions(),
      positions: [makePosition({ redeemableShares: 0n, estimatedRedeemAssets: 0n })],
      hasPositions: true,
    };

    renderPage("/vaults?manage=positions");

    const row = screen.getByTestId("vault-manage-position-greenpill-nyc");
    expect(within(row).getByText("Redemption unavailable right now")).toBeInTheDocument();
    expect(within(row).getByText(/visible vault shares/i)).toBeInTheDocument();
    expect(within(row).getByText(/Estimated WETH proceeds/i)).toBeInTheDocument();
    expect(within(row).getByText("Unavailable")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Redeem shares" })).toBeNull();
  });

  it("blocks redemption when estimated WETH proceeds cannot be previewed", () => {
    mocks.authMode = "wallet";
    mocks.primaryAddress = CONNECTED;
    mocks.positionsByOwner[CONNECTED.toLowerCase()] = {
      ...emptyPositions(),
      positions: [
        makePosition({
          redeemableShares: 1_000_000_000_000_000_000n,
          estimatedRedeemAssets: null,
        }),
      ],
      hasPositions: true,
    };

    renderPage("/vaults?manage=positions");

    const row = screen.getByTestId("vault-manage-position-greenpill-nyc");
    expect(within(row).getByText(/Estimated WETH proceeds/i)).toBeInTheDocument();
    expect(within(row).getByText("Unavailable")).toBeInTheDocument();
    expect(within(row).getByText("Estimated proceeds unavailable")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Redeem shares" })).toBeNull();
  });

  it("ignores stale card-wallet cache and keeps management wallet-only", () => {
    seedPendingFundedEntry();
    mocks.authMode = "wallet";
    mocks.primaryAddress = CONNECTED;

    renderPage("/vaults?manage=positions");

    const panel = screen.getByTestId("vault-manage-positions-panel");
    expect(within(panel).queryByRole("tab", { name: "Card wallet" })).not.toBeInTheDocument();
    expect(within(panel).queryByText(/card wallet/i)).not.toBeInTheDocument();
    expect(within(panel).queryByText("Restore email wallet to redeem")).not.toBeInTheDocument();
    expect(
      within(panel).queryByTestId("vault-manage-pending-funded-greenpill-nyc")
    ).not.toBeInTheDocument();
    expect(within(panel).getByText("No vault shares for this wallet yet")).toBeInTheDocument();
  });
});

describe("checkout success no longer points to Fund", () => {
  it("wallet-endow success offers Manage Endowments and never links to /fund", async () => {
    const user = userEvent.setup();
    mocks.authMode = "wallet";
    mocks.primaryAddress = CONNECTED;
    const { container } = renderContent([makeStableCampaign()]);

    await user.click(screen.getByRole("button", { name: "Endow to Synthetic complete campaign" }));
    await user.type(screen.getByLabelText("Amount to endow"), "2.50");
    await user.click(screen.getByRole("button", { name: "Confirm endowment" }));

    const success = await screen.findByTestId("vault-wallet-endow-success");
    expect(mocks.walletEndowMutate).toHaveBeenCalledTimes(1);
    // No Fund-page CTA or copy remains in the success state.
    expect(container.querySelector('a[href="/fund"]')).toBeNull();
    expect(within(success).queryByText(/Fund page/i)).toBeNull();
    // Primary CTA is now Manage Endowments.
    await user.click(screen.getByRole("button", { name: "Manage Endowments" }));

    expect(screen.queryByTestId("vault-wallet-endow-success")).not.toBeInTheDocument();
    expect(screen.getByTestId("vault-manage-positions-panel")).toBeInTheDocument();
    expect(screen.getAllByTestId("wallet-runtime-provider")).toHaveLength(1);
  });
});
