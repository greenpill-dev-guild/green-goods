/**
 * Public vault crowdfunding route tests.
 *
 * @vitest-environment jsdom
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Fragment, createElement, useEffect } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type OctantVaultCampaignManifest, VaultDepositStageError } from "@green-goods/shared";
import VaultsPage, { CampaignCard, VaultsPageContent } from "../../views/Public/Vaults";

const sharedHookMocks = vi.hoisted(() => ({
  loginWithWallet: vi.fn(),
  octantVaultWalletEndowMutate: vi.fn(),
  octantVaultWalletEndowReset: vi.fn(),
  octantVaultWalletEndowError: null as unknown,
  wrapEthToWethMutate: vi.fn(),
  wrapEthToWethReset: vi.fn(),
  wrapEthToWethError: null as unknown,
  wrapEthToWethIsPending: false,
  walletBalancesRefetch: vi.fn(async () => undefined),
  walletBalances: {
    nativeBalance: null as bigint | null,
    assetBalance: null as bigint | null,
    gasPrice: null as bigint | null,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(async () => undefined),
  },
  walletRuntimeProviderRender: vi.fn(),
  primaryAddress: undefined as string | undefined,
  authMode: null as "wallet" | "passkey" | "embedded" | null,
  ethUsdHasFeed: true,
  ethUsdPriceAnswer: 300000000000n,
  octantVaultStats: {
    totalAssets: 0n,
    usdCents: null as bigint | null,
    isLoading: false,
    isError: false,
  },
  projectSupportMetric: {
    status: "zero" as "unavailable" | "zero" | "positive",
    sourceAddress: "0x950208836634cD439F01262e98D0FCF422F78452" as `0x${string}` | null,
    shareBalance: 0n,
    assetValue: 0n,
    isLoading: false,
    isError: false,
  },
  strategyApy: {
    status: "unavailable" as "unavailable" | "zero" | "positive",
    apy: null as number | null,
    apr: null as number | null,
    sourceAddress: null as `0x${string}` | null,
    sourceKind: "yearn-v3" as "yearn-v3" | "aave-v3" | "lido" | "unknown",
    isLoading: false,
    isError: false,
  },
}));

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();

  return {
    ...actual,
    useAuth: () => ({
      loginWithWallet: sharedHookMocks.loginWithWallet,
    }),
    useUser: () => ({
      primaryAddress: sharedHookMocks.primaryAddress,
      authMode: sharedHookMocks.authMode,
    }),
    useOctantVaultWalletEndow: () => ({
      mutate: sharedHookMocks.octantVaultWalletEndowMutate,
      reset: sharedHookMocks.octantVaultWalletEndowReset,
      error: sharedHookMocks.octantVaultWalletEndowError,
      isPending: false,
    }),
    useWrapEthToWeth: () => ({
      mutate: sharedHookMocks.wrapEthToWethMutate,
      reset: sharedHookMocks.wrapEthToWethReset,
      error: sharedHookMocks.wrapEthToWethError,
      isPending: sharedHookMocks.wrapEthToWethIsPending,
    }),
    useOctantVaultWalletBalances: () => sharedHookMocks.walletBalances,
    useEthUsdPrice: () => ({
      hasFeed: sharedHookMocks.ethUsdHasFeed,
      priceAnswer: sharedHookMocks.ethUsdPriceAnswer,
      isLoading: false,
      isError: false,
      isStale: false,
      updatedAt: 1770000000n,
    }),
    useOctantVaultStats: () => sharedHookMocks.octantVaultStats,
    useOctantVaultProjectSupportMetric: () => sharedHookMocks.projectSupportMetric,
    useOctantVaultStrategyApy: () => sharedHookMocks.strategyApy,
    // The route-local management panel can mount after a card success handoff;
    // it must render without a live QueryClient in this suite.
    useOctantVaultPositions: () => ({
      positions: [],
      hasPositions: false,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(async () => undefined),
    }),
    useOctantVaultRedeem: () => ({
      mutateAsync: vi.fn(async () => "0xhash"),
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      error: null,
    }),
  };
});

vi.mock("@/routes/WalletRuntimeProviders", async () => {
  const { createElement } = await import("react");

  return {
    default: ({ children }: { children: unknown }) => {
      sharedHookMocks.walletRuntimeProviderRender();
      return createElement("div", { "data-testid": "wallet-runtime-provider" }, children);
    },
  };
});

const VALID_RECEIVER_ADDRESS = "0x3333333333333333333333333333333333333333";

function makeCompleteCampaign(): OctantVaultCampaignManifest {
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
      asset: {
        address: "0x2222222222222222222222222222222222222222",
        symbol: "USDC",
        decimals: 6,
      },
      explorerLink: "https://etherscan.io/address/0x1111111111111111111111111111111111111111",
    },
    recipientRoutingSummary: "Yield routes to a verified public goods recipient.",
    protocolGuildDestinationContext: "Protocol Guild allocation context is recorded.",
  };
}

function renderView(path = "/vaults") {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(
        IntlProvider,
        { locale: "en", messages: { "app.common.close": "Close" } },
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

function renderViewWithLocationProbe(path: string, onLocationChange: (location: string) => void) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(
        IntlProvider,
        { locale: "en", messages: { "app.common.close": "Close" } },
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

function renderContent(campaigns: OctantVaultCampaignManifest[], path = "/vaults") {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(
        IntlProvider,
        { locale: "en", messages: { "app.common.close": "Close" } },
        createElement(VaultsPageContent, { campaigns })
      )
    )
  );
}

function renderCard(campaign: OctantVaultCampaignManifest) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/vaults"] },
      createElement(
        IntlProvider,
        { locale: "en", messages: { "app.common.close": "Close" } },
        createElement(CampaignCard, { campaign })
      )
    )
  );
}

function stubMatchMedia(widthPx = 1024) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => {
      const matches = query.includes("max-width: 639px")
        ? widthPx <= 639
        : query.includes("min-width: 640px")
          ? widthPx >= 640
          : false;

      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as MediaQueryList;
    }),
  });
}

describe("VaultsPage", () => {
  beforeEach(() => {
    sharedHookMocks.loginWithWallet.mockReset();
    sharedHookMocks.loginWithWallet.mockResolvedValue(undefined);
    sharedHookMocks.octantVaultWalletEndowMutate.mockClear();
    sharedHookMocks.octantVaultWalletEndowReset.mockClear();
    sharedHookMocks.octantVaultWalletEndowError = null;
    sharedHookMocks.wrapEthToWethMutate.mockClear();
    sharedHookMocks.wrapEthToWethReset.mockClear();
    sharedHookMocks.wrapEthToWethError = null;
    sharedHookMocks.wrapEthToWethIsPending = false;
    sharedHookMocks.walletBalancesRefetch.mockClear();
    sharedHookMocks.walletBalances = {
      nativeBalance: null,
      assetBalance: null,
      gasPrice: null,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: sharedHookMocks.walletBalancesRefetch,
    };
    sharedHookMocks.walletRuntimeProviderRender.mockClear();
    sharedHookMocks.primaryAddress = undefined;
    sharedHookMocks.authMode = null;
    sharedHookMocks.ethUsdHasFeed = true;
    sharedHookMocks.ethUsdPriceAnswer = 300000000000n;
    sharedHookMocks.octantVaultStats = {
      totalAssets: 0n,
      usdCents: null,
      isLoading: false,
      isError: false,
    };
    sharedHookMocks.projectSupportMetric = {
      status: "zero",
      sourceAddress: "0x950208836634cD439F01262e98D0FCF422F78452",
      shareBalance: 0n,
      assetValue: 0n,
      isLoading: false,
      isError: false,
    };
    sharedHookMocks.strategyApy = {
      status: "unavailable",
      apy: null,
      apr: null,
      sourceAddress: null,
      sourceKind: "yearn-v3",
      isLoading: false,
      isError: false,
    };
    stubMatchMedia();
    window.localStorage.clear();
  });

  it("renders the dedicated /vaults browse surface without wallet connection", () => {
    renderView();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Octant vault campaigns for public goods."
    );
    expect(screen.getByRole("heading", { name: "Greenpill NYC" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "EVMavericks Fantasy Football League" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your support funds real public goods work and keeps working over time.")
    ).toBeInTheDocument();
    const nycCard = screen.getByTestId("vault-campaign-card-greenpill-nyc");
    const evmavericksCard = screen.getByTestId("vault-campaign-card-evmavericks");
    expect(nycCard).toHaveClass("lg:row-span-6", "lg:grid-rows-subgrid");
    expect(evmavericksCard).toHaveClass("lg:row-span-6", "lg:grid-rows-subgrid");
    expect(screen.getByTestId("vault-campaign-story-headline-greenpill-nyc")).toHaveClass(
      "min-h-[2.5em]"
    );
    expect(screen.getByTestId("vault-campaign-story-headline-evmavericks")).toHaveClass(
      "min-h-[2.5em]"
    );
    expect(screen.getByTestId("vault-campaign-amount-row-greenpill-nyc")).toBeInTheDocument();
    expect(screen.getByTestId("vault-campaign-amount-row-evmavericks")).toBeInTheDocument();
    expect(sharedHookMocks.walletRuntimeProviderRender).not.toHaveBeenCalled();
    expect(screen.queryByTestId("wallet-runtime-provider")).not.toBeInTheDocument();
  });

  it("scrubs the deprecated Card Endow QA query param while preserving valid route params", async () => {
    const locations: string[] = [];

    // `ref` stands in for an unrelated route param to preserve. (`manage=positions`
    // is no longer inert; it opens the route-local management panel.)
    renderViewWithLocationProbe("/vaults?cardEndowQa=1&ref=newsletter", (location) => {
      locations.push(location);
    });

    await waitFor(() => expect(locations.at(-1)).toBe("/vaults?ref=newsletter"));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Octant vault campaigns for public goods."
    );
    expect(screen.getByRole("button", { name: "Endow to Greenpill NYC" })).toBeEnabled();
  });

  it("shows wallet-only Endow CTAs for both vault fixtures", () => {
    renderView();

    const nycCard = screen.getByTestId("vault-campaign-card-greenpill-nyc");
    const evmavericksCard = screen.getByTestId("vault-campaign-card-evmavericks");

    // Greenpill NYC exposes a single vault Endow CTA without a card payment branch.
    expect(within(nycCard).getByRole("button", { name: "Endow to Greenpill NYC" })).toBeEnabled();
    expect(
      within(nycCard).queryByRole("button", { name: /choose amount/i })
    ).not.toBeInTheDocument();
    expect(within(nycCard).queryByRole("button", { name: /pay by card/i })).not.toBeInTheDocument();

    // EVMavericks uses the same wallet-only vault checkout treatment.
    expect(
      within(evmavericksCard).getByRole("button", {
        name: "Endow to EVMavericks Fantasy Football League",
      })
    ).toBeEnabled();
    expect(within(evmavericksCard).getByText("Ready for checkout")).toBeInTheDocument();
    expect(
      within(evmavericksCard).getByText(
        "Each season, the EVMavericks fantasy football league routes 12.5% of its pot into this vault and distributes the remaining 87.5% as league winnings. The result is a recurring public goods funding stream built on a ritual the community already runs."
      )
    ).toBeInTheDocument();
    expect(within(evmavericksCard).queryByText("Preview")).not.toBeInTheDocument();
    expect(
      within(evmavericksCard).queryByRole("button", { name: /pay by card/i })
    ).not.toBeInTheDocument();
    expect(
      within(evmavericksCard).queryByText("Protocol Guild destination context")
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/manifest/i)).not.toBeInTheDocument();
  });

  it("keeps Donate and Card Donate labels out of the vault campaign route", () => {
    renderView();

    expect(screen.queryByText("Donate")).not.toBeInTheDocument();
    expect(screen.queryByText("Card Donate")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Endow to Greenpill NYC" })).toBeEnabled();
  });

  it("renders one Endow CTA for a complete manifest card", () => {
    renderCard(makeCompleteCampaign());

    expect(screen.getByText("Ready for checkout")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Endow to Synthetic complete campaign" })
    ).toBeEnabled();
    // No early payment-method or Card Endow exposure on the card itself.
    expect(screen.queryByText(/Card Endow/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("vault-checkout-method-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vault-checkout-method-wallet")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Connect wallet" })).not.toBeInTheDocument();
  });

  it("offers a complete non-production campaign Wallet checkout only, never Card", async () => {
    const user = userEvent.setup();

    renderContent([makeCompleteCampaign()]);

    await user.click(screen.getByRole("button", { name: "Endow to Synthetic complete campaign" }));

    // The setup screen exposes payment method choice immediately, but only the
    // wallet rail is available for non-production campaigns.
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeDisabled();
    expect(screen.queryByTestId("vault-checkout-method-card")).not.toBeInTheDocument();
    const walletMethod = screen.getByTestId("vault-checkout-method-wallet");
    expect(walletMethod).toBeInTheDocument();
    expect(walletMethod).toBeEnabled();
    expect(screen.getByText("Connect at the final step")).toBeInTheDocument();
    expect(
      screen.getByText("Choose the amount to endow, then pick how you want to pay.")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Enter a dollar amount first to choose a payment method.")
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Connect wallet" })).not.toBeInTheDocument();

    await user.click(walletMethod);
    expect(walletMethod).toHaveAttribute("aria-pressed", "true");
    const continueToWalletButton = screen.getByRole("button", { name: "Continue to Wallet" });
    expect(continueToWalletButton).toBeDisabled();
    await user.type(screen.getByLabelText("Amount to endow"), "2.50");
    expect(continueToWalletButton).toBeEnabled();
    expect(screen.queryByTestId("vault-wallet-endow-path")).not.toBeInTheDocument();
    await user.click(continueToWalletButton);

    // Card stays gated to the production campaign; this fixture exposes Wallet only.
    expect(screen.getByTestId("vault-wallet-endow-path")).toBeInTheDocument();
    expect(screen.queryByTestId("vault-checkout-method-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vault-card-endow-flow")).not.toBeInTheDocument();
    expect(screen.queryByTestId("thirdweb-buy-widget")).not.toBeInTheDocument();
  });

  it("opens EVMavericks with Wallet checkout only and keeps Card Endow hidden", async () => {
    const user = userEvent.setup();

    renderView();

    await user.click(
      screen.getByRole("button", { name: "Endow to EVMavericks Fantasy Football League" })
    );

    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeDisabled();
    const walletMethod = screen.getByTestId("vault-checkout-method-wallet");
    expect(screen.queryByTestId("vault-checkout-method-card")).not.toBeInTheDocument();
    expect(walletMethod).toBeEnabled();
    await user.click(walletMethod);
    expect(walletMethod).toHaveAttribute("aria-pressed", "true");
    const continueToWalletButton = screen.getByRole("button", { name: "Continue to Wallet" });
    expect(continueToWalletButton).toBeDisabled();
    await user.type(screen.getByLabelText("Amount to endow"), "25");
    expect(continueToWalletButton).toBeEnabled();
    await user.click(continueToWalletButton);

    expect(await screen.findByTestId("vault-wallet-endow-path")).toBeInTheDocument();
    expect(screen.queryByTestId("vault-card-endow-flow")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vault-card-payment-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vault-card-endow-plan-details")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue to Card" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("thirdweb-buy-widget")).not.toBeInTheDocument();
  });

  it("explains the yield-donating strategy with the withdraw-in-full ownership story", () => {
    renderView();

    expect(screen.getByRole("heading", { name: "How yield support works" })).toBeInTheDocument();
    expect(screen.getByText("Donated yield generated for the project")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Cumulative across all supporters in this campaign, not your personal balance."
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText("0 WETH")).not.toHaveLength(0);
    expect(
      screen.getAllByText(
        "Deposits are in the vault, but no yield has been harvested and donated to the project yet."
      )
    ).not.toHaveLength(0);
    expect(
      screen.getByText(
        /When you support a campaign you receive vault shares for your full WETH contribution/i
      )
    ).toBeInTheDocument();
    // The explicit "withdraw your contribution in full" supporter story (PRD-586).
    expect(
      screen.getByText(
        /you keep the option to withdraw your contribution in full[\s\S]*funds the project/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /The recorded pilot evidence points to YieldDonatingTokenizedStrategy contracts created through YearnV3StrategyFactory metadata/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Octant Yield Donating Strategy docs" })
    ).toHaveAttribute("href", "https://docs.v2.octant.build/docs/yield_donating_strategy");
    expect(screen.queryByText(/guaranteed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/accrued profit/i)).not.toBeInTheDocument();
  });

  it("shows a live underlying-source rate when the strategy APY is positive", () => {
    sharedHookMocks.strategyApy = {
      status: "positive",
      apy: 1.43,
      apr: 1.43,
      sourceAddress: "0xc56413869c6CDf96496f2b1eF801fEDBdFA7dDB0",
      sourceKind: "yearn-v3",
      isLoading: false,
      isError: false,
    };

    renderView();

    const apyLine = screen.getAllByTestId("vault-strategy-apy-greenpill-nyc")[0];
    expect(within(apyLine).getByText("1.43%")).toBeInTheDocument();
    expect(
      within(apyLine).getByText(/Gross annual rate of the strategy's underlying source/i)
    ).toBeInTheDocument();
  });

  it("shows no percentage in the strategy APY line when the source rate is unavailable", () => {
    // strategyApy defaults to the unavailable state in beforeEach.
    renderView();

    const apyLine = screen.getAllByTestId("vault-strategy-apy-greenpill-nyc")[0];
    expect(within(apyLine).getByText("Rate unavailable")).toBeInTheDocument();
    expect(within(apyLine).queryByText(/%/)).toBeNull();
  });

  it("warns instead of offering a wrap when ETH covers the shortfall but not the gas reserve", async () => {
    const user = userEvent.setup();
    // Connected wallet with no WETH and just over the wrap shortfall in ETH, but a
    // gas price high enough that the reserve (gasPrice * 500k) dwarfs the balance,
    // so a wrap would strand the follow-on approve/deposit gas.
    sharedHookMocks.primaryAddress = "0x4444444444444444444444444444444444444444";
    sharedHookMocks.authMode = "wallet";
    sharedHookMocks.walletBalances = {
      nativeBalance: 1_000_000_000_000_000_000n, // 1 ETH, well above the WETH shortfall
      assetBalance: 0n, // no WETH → wrap would be required
      gasPrice: 10_000_000_000_000n, // reserve = 5e18 wei, far above the 1 ETH balance
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: sharedHookMocks.walletBalancesRefetch,
    };

    renderView();

    await user.click(
      screen.getByRole("button", { name: "Endow to EVMavericks Fantasy Football League" })
    );
    await user.click(screen.getByTestId("vault-checkout-method-wallet"));
    await user.type(screen.getByLabelText("Amount to endow"), "25");
    await user.click(screen.getByRole("button", { name: "Continue to Wallet" }));

    expect(await screen.findByTestId("vault-wallet-endow-path")).toBeInTheDocument();
    expect(
      screen.getByText(
        "You have enough ETH to wrap, but not enough left for network fees on the approve and deposit steps. Add a little more ETH, then try again."
      )
    ).toBeInTheDocument();
    // The wrap prompt must NOT be offered in this state.
    expect(screen.queryByText(/Wrap .* ETH into WETH before confirming/i)).toBeNull();
  });

  it("hides the aggregate support number when the router source is unavailable", () => {
    sharedHookMocks.projectSupportMetric = {
      status: "unavailable",
      sourceAddress: null,
      shareBalance: 0n,
      assetValue: 0n,
      isLoading: false,
      isError: false,
      unavailableReason: "missing_source",
    };

    renderView();

    const metric = screen.getByTestId("vault-project-support-metric-greenpill-nyc");
    expect(within(metric).getByText("Unavailable")).toBeInTheDocument();
    expect(
      within(metric).getByText(
        "No numeric support value is shown until the router source and conversion path can be proven."
      )
    ).toBeInTheDocument();
    expect(within(metric).queryByText(/WETH/)).toBeNull();
  });

  it("renders a positive aggregate project support value without individual profit copy", () => {
    sharedHookMocks.projectSupportMetric = {
      status: "positive",
      sourceAddress: "0x950208836634cD439F01262e98D0FCF422F78452",
      shareBalance: 4_000_000_000_000_000n,
      assetValue: 4_100_000_000_000_000n,
      isLoading: false,
      isError: false,
    };

    renderView();

    const metric = screen.getByTestId("vault-project-support-metric-greenpill-nyc");
    expect(within(metric).getByText("0.0041 WETH")).toBeInTheDocument();
    expect(
      within(metric).getByText(
        "Estimated from donation shares held by the configured project support router."
      )
    ).toBeInTheDocument();
    expect(within(metric).queryByText(/your accrued/i)).toBeNull();
  });

  it("renders a desktop dialog and a mobile bottom sheet for checkout setup", async () => {
    const desktopUser = userEvent.setup();

    const desktop = renderContent([makeCompleteCampaign()]);
    await desktopUser.click(
      screen.getByRole("button", { name: "Endow to Synthetic complete campaign" })
    );

    expect(
      screen.getByRole("dialog", { name: "Endow to Synthetic complete campaign" })
    ).toBeInTheDocument();
    expect(screen.queryByTestId("vault-checkout-sheet")).not.toBeInTheDocument();
    desktop.unmount();

    stubMatchMedia(390);
    const mobileUser = userEvent.setup();
    renderContent([makeCompleteCampaign()]);
    await mobileUser.click(
      screen.getByRole("button", { name: "Endow to Synthetic complete campaign" })
    );

    expect(screen.getByTestId("vault-checkout-sheet")).toHaveAttribute(
      "data-component",
      "PwaSheet"
    );
    expect(screen.getByTestId("vault-checkout-sheet-drag-handle")).toBeInTheDocument();
    expect(
      screen.getByText("Choose the amount to endow, then pick how you want to pay.")
    ).toBeInTheDocument();
  });

  it("marks invalid dollar input as a field error and keeps method selection visible", async () => {
    const user = userEvent.setup();

    renderView();

    await user.click(screen.getByRole("button", { name: "Endow to Greenpill NYC" }));
    const walletMethod = screen.getByTestId("vault-checkout-method-wallet");
    expect(screen.queryByTestId("vault-checkout-method-card")).not.toBeInTheDocument();
    await user.click(walletMethod);
    const continueToWalletButton = screen.getByRole("button", { name: "Continue to Wallet" });
    const amountInput = screen.getByLabelText("Amount to endow");

    await user.type(amountInput, "abc");

    expect(amountInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter a valid dollar amount.")).toBeInTheDocument();
    expect(walletMethod).toHaveAttribute("aria-pressed", "true");
    expect(continueToWalletButton).toBeDisabled();
  });

  it("treats unavailable ETH pricing as a status callout, not an amount field error", async () => {
    const user = userEvent.setup();
    sharedHookMocks.ethUsdHasFeed = false;

    renderView();

    await user.click(screen.getByRole("button", { name: "Endow to Greenpill NYC" }));
    const walletMethod = screen.getByTestId("vault-checkout-method-wallet");
    expect(screen.queryByTestId("vault-checkout-method-card")).not.toBeInTheDocument();
    await user.click(walletMethod);
    const amountInput = screen.getByLabelText("Amount to endow");
    await user.type(amountInput, "30");

    expect(amountInput).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByText("Enter a valid dollar amount.")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "ETH pricing is temporarily unavailable. Keep this amount and try again in a moment."
      )
    ).toBeInTheDocument();
    expect(walletMethod).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Continue to Wallet" })).toBeDisabled();
  });

  it("does not expose card payment minimums in wallet-only checkout", async () => {
    const user = userEvent.setup();

    renderView();

    await user.click(screen.getByRole("button", { name: "Endow to Greenpill NYC" }));
    expect(screen.queryByTestId("vault-checkout-method-card")).not.toBeInTheDocument();
    expect(screen.queryByText("Debit or credit · $2 minimum")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue to Card" })).not.toBeInTheDocument();

    await user.click(screen.getByTestId("vault-checkout-method-wallet"));
    const amountInput = screen.getByLabelText("Amount to endow");
    await user.type(amountInput, "1.50");
    expect(
      screen.queryByText(
        "Card payments need at least $2.00. Enter a higher amount or choose Wallet."
      )
    ).not.toBeInTheDocument();
    expect(amountInput).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByRole("button", { name: "Continue to Wallet" })).toBeEnabled();
  });

  it("keeps wallet connection behind setup continue while amount stays editable", async () => {
    const user = userEvent.setup();

    renderContent([makeCompleteCampaign()]);

    expect(screen.queryByRole("button", { name: "Connect wallet" })).not.toBeInTheDocument();
    expect(sharedHookMocks.walletRuntimeProviderRender).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Endow to Synthetic complete campaign" }));

    // Opening checkout may prepare wallet runtime for price conversion, but it
    // must not expose a wallet action before amount + method + final continue.
    expect(screen.getByTestId("wallet-runtime-provider")).toBeInTheDocument();
    expect(sharedHookMocks.walletRuntimeProviderRender).toHaveBeenCalled();
    const walletMethod = screen.getByTestId("vault-checkout-method-wallet");
    expect(walletMethod).toBeInTheDocument();
    expect(walletMethod).toBeEnabled();
    expect(screen.queryByTestId("vault-wallet-endow-path")).not.toBeInTheDocument();
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeDisabled();

    await user.click(walletMethod);
    expect(walletMethod).toHaveAttribute("aria-pressed", "true");
    const continueToWalletButton = screen.getByRole("button", { name: "Continue to Wallet" });
    expect(continueToWalletButton).toBeDisabled();
    await user.type(screen.getByLabelText("Amount to endow"), "2.50");
    expect(continueToWalletButton).toBeEnabled();
    expect(screen.queryByTestId("vault-wallet-endow-path")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Amount to endow"));
    expect(screen.getByTestId("vault-checkout-method-wallet")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(continueToWalletButton).toBeDisabled();
    await user.type(screen.getByLabelText("Amount to endow"), "3.25");

    // Setup is still not the wallet connection step.
    expect(screen.queryByTestId("vault-wallet-endow-path")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Connect wallet" })).not.toBeInTheDocument();

    await user.click(continueToWalletButton);

    expect(screen.getByTestId("vault-wallet-endow-path")).toBeInTheDocument();
    expect(screen.getByText("Review wallet endowment")).toBeInTheDocument();
    expect(screen.getByText("$3.25")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Amount to endow")).toHaveValue("3.25");
    expect(screen.getByTestId("vault-checkout-method-wallet")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.queryByRole("button", { name: "Connect wallet" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue to Wallet" }));
    expect(screen.getByTestId("vault-wallet-endow-path")).toBeInTheDocument();
    expect(screen.getByText("$3.25")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Connect wallet" }));

    expect(sharedHookMocks.loginWithWallet).toHaveBeenCalledTimes(1);
    expect(sharedHookMocks.octantVaultWalletEndowMutate).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");

    expect(screen.getByTestId("vault-wallet-endow-path")).toBeInTheDocument();
    expect(screen.getByText("$3.25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
  });

  it("unlocks the wallet checkout sheet when wallet connection is cancelled", async () => {
    const user = userEvent.setup();
    sharedHookMocks.loginWithWallet.mockRejectedValueOnce(new Error("wallet cancelled"));

    renderContent([makeCompleteCampaign()]);

    await user.click(screen.getByRole("button", { name: "Endow to Synthetic complete campaign" }));
    await user.click(screen.getByTestId("vault-checkout-method-wallet"));
    await user.type(screen.getByLabelText("Amount to endow"), "2.50");
    await user.click(screen.getByRole("button", { name: "Continue to Wallet" }));
    await user.click(screen.getByRole("button", { name: "Connect wallet" }));

    expect(sharedHookMocks.loginWithWallet).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeEnabled();
  });

  it("does not treat restored passkey auth as Wallet Endow readiness", async () => {
    const user = userEvent.setup();
    sharedHookMocks.authMode = "passkey";
    sharedHookMocks.primaryAddress = VALID_RECEIVER_ADDRESS;

    renderContent([makeCompleteCampaign()]);

    await user.click(screen.getByRole("button", { name: "Endow to Synthetic complete campaign" }));
    await user.click(screen.getByTestId("vault-checkout-method-wallet"));
    await user.type(screen.getByLabelText("Amount to endow"), "2.50");
    await user.click(screen.getByRole("button", { name: "Continue to Wallet" }));
    await user.click(screen.getByRole("button", { name: "Connect wallet" }));

    expect(sharedHookMocks.loginWithWallet).toHaveBeenCalledTimes(1);
    expect(sharedHookMocks.octantVaultWalletEndowMutate).not.toHaveBeenCalled();
  });

  it("submits Wallet Endow only after a complete manifest, amount, and connected wallet", async () => {
    const user = userEvent.setup();
    sharedHookMocks.authMode = "wallet";
    sharedHookMocks.primaryAddress = VALID_RECEIVER_ADDRESS;

    renderContent([makeCompleteCampaign()]);

    await user.click(screen.getByRole("button", { name: "Endow to Synthetic complete campaign" }));
    await user.click(screen.getByTestId("vault-checkout-method-wallet"));
    await user.type(screen.getByLabelText("Amount to endow"), "2.50");
    await user.click(screen.getByRole("button", { name: "Continue to Wallet" }));
    await user.click(screen.getByRole("button", { name: "Confirm endowment" }));

    expect(sharedHookMocks.loginWithWallet).not.toHaveBeenCalled();
    expect(sharedHookMocks.octantVaultWalletEndowMutate).toHaveBeenCalledWith(
      {
        intentKind: "wallet_endow",
        paymentMethod: "wallet",
        chainId: 1,
        vaultAddress: "0x1111111111111111111111111111111111111111",
        assetAddress: "0x2222222222222222222222222222222222222222",
        assetSymbol: "USDC",
        assetDecimals: 6,
        amount: 2500000n,
        receiver: {
          intentKind: "wallet_endow",
          paymentMethod: "wallet",
          receiverKind: "connected_wallet",
          receiverCustody: "connected_wallet",
          receiverAddress: VALID_RECEIVER_ADDRESS,
        },
      },
      expect.objectContaining({
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      })
    );
  });

  it("shows wallet ETH and WETH balances and wraps ETH before WETH deposit", async () => {
    const user = userEvent.setup();
    sharedHookMocks.authMode = "wallet";
    sharedHookMocks.primaryAddress = VALID_RECEIVER_ADDRESS;
    sharedHookMocks.walletBalances = {
      nativeBalance: 20_000_000_000_000_000n,
      assetBalance: 0n,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: sharedHookMocks.walletBalancesRefetch,
    };
    sharedHookMocks.wrapEthToWethMutate.mockImplementationOnce(
      (_params: unknown, options?: { onSuccess?: (hash: string) => void }) => {
        options?.onSuccess?.("0xwrapwrapwrapwrapwrapwrapwrapwrapwrapwrapwrapwrapwrapwrapwrapwrap");
      }
    );

    renderView();

    await user.click(screen.getByRole("button", { name: "Endow to Greenpill NYC" }));
    await user.click(screen.getByTestId("vault-checkout-method-wallet"));
    await user.type(screen.getByLabelText("Amount to endow"), "30");
    await user.click(screen.getByRole("button", { name: "Continue to Wallet" }));

    const walletPath = screen.getByTestId("vault-wallet-endow-path");
    expect(screen.getByText("Ethereum Mainnet balances")).toBeInTheDocument();
    expect(screen.getByText("ETH balance")).toBeInTheDocument();
    expect(within(walletPath).getByText("0.02 ETH")).toBeInTheDocument();
    expect(screen.getByText("WETH balance")).toBeInTheDocument();
    expect(within(walletPath).getByText("0 WETH")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your wallet has enough ETH. Wrap 0.01 ETH into WETH before confirming the vault deposit."
      )
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Wrap ETH to WETH" }));

    expect(sharedHookMocks.wrapEthToWethMutate).toHaveBeenCalledWith(
      {
        chainId: 1,
        wethAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        amount: 10_000_000_000_000_000n,
      },
      expect.objectContaining({
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      })
    );
    await waitFor(() => expect(sharedHookMocks.walletBalancesRefetch).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "Confirm endowment" }));

    expect(sharedHookMocks.octantVaultWalletEndowMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 1,
        assetAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        amount: 10_000_000_000_000_000n,
      }),
      expect.anything()
    );
  });

  it("wraps only the WETH shortfall when the wallet already has partial WETH", async () => {
    const user = userEvent.setup();
    sharedHookMocks.authMode = "wallet";
    sharedHookMocks.primaryAddress = VALID_RECEIVER_ADDRESS;
    sharedHookMocks.walletBalances = {
      nativeBalance: 1_000_000_000_000_000n,
      assetBalance: 9_000_000_000_000_000n,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: sharedHookMocks.walletBalancesRefetch,
    };

    renderView();

    await user.click(screen.getByRole("button", { name: "Endow to Greenpill NYC" }));
    await user.click(screen.getByTestId("vault-checkout-method-wallet"));
    await user.type(screen.getByLabelText("Amount to endow"), "30");
    await user.click(screen.getByRole("button", { name: "Continue to Wallet" }));

    expect(
      screen.getByText(
        "Your wallet has enough ETH. Wrap 0.001 ETH into WETH before confirming the vault deposit."
      )
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Wrap ETH to WETH" }));

    expect(sharedHookMocks.wrapEthToWethMutate).toHaveBeenCalledWith(
      {
        chainId: 1,
        wethAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        amount: 1_000_000_000_000_000n,
      },
      expect.objectContaining({
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      })
    );
  });

  it("keeps wallet endow disabled while ETH and WETH balances are loading", async () => {
    const user = userEvent.setup();
    sharedHookMocks.authMode = "wallet";
    sharedHookMocks.primaryAddress = VALID_RECEIVER_ADDRESS;
    sharedHookMocks.walletBalances = {
      nativeBalance: null,
      assetBalance: null,
      isLoading: true,
      isError: false,
      isFetching: true,
      refetch: sharedHookMocks.walletBalancesRefetch,
    };

    renderView();

    await user.click(screen.getByRole("button", { name: "Endow to Greenpill NYC" }));
    await user.click(screen.getByTestId("vault-checkout-method-wallet"));
    await user.type(screen.getByLabelText("Amount to endow"), "30");
    await user.click(screen.getByRole("button", { name: "Continue to Wallet" }));

    const submit = screen.getByRole("button", { name: "Loading balances..." });
    expect(submit).toBeDisabled();

    await user.click(submit);
    expect(sharedHookMocks.wrapEthToWethMutate).not.toHaveBeenCalled();
    expect(sharedHookMocks.octantVaultWalletEndowMutate).not.toHaveBeenCalled();
  });

  it("freezes the settlement amount at Continue so a live price change cannot move it", async () => {
    const user = userEvent.setup();
    const ui = createElement(
      MemoryRouter,
      { initialEntries: ["/vaults"] },
      createElement(
        IntlProvider,
        { locale: "en", messages: { "app.common.close": "Close" } },
        createElement(VaultsPage)
      )
    );
    const { rerender } = render(ui);

    await user.click(screen.getByRole("button", { name: "Endow to Greenpill NYC" }));
    await user.click(screen.getByTestId("vault-checkout-method-wallet"));
    await user.type(screen.getByLabelText("Amount to endow"), "30");
    await user.click(screen.getByRole("button", { name: "Continue to Wallet" }));
    // Committed at $30 with ETH at $3,000 => 0.01 WETH.
    expect(screen.getByText("Settles into the Octant vault as 0.01 WETH")).toBeInTheDocument();

    // The live ETH price doubles mid-flow; the committed amount must not move.
    sharedHookMocks.ethUsdPriceAnswer = 600000000000n;
    rerender(ui);

    expect(screen.getByText("Settles into the Octant vault as 0.01 WETH")).toBeInTheDocument();
    expect(
      screen.queryByText("Settles into the Octant vault as 0.005 WETH")
    ).not.toBeInTheDocument();
  });

  it("shows a wallet success screen with Done and prevents a second submission", async () => {
    const user = userEvent.setup();
    sharedHookMocks.authMode = "wallet";
    sharedHookMocks.primaryAddress = VALID_RECEIVER_ADDRESS;
    sharedHookMocks.octantVaultWalletEndowMutate.mockImplementationOnce(
      (_transaction: unknown, options?: { onSuccess?: (hash: string) => void }) => {
        options?.onSuccess?.("0xfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeed");
      }
    );

    renderContent([makeCompleteCampaign()]);

    await user.click(screen.getByRole("button", { name: "Endow to Synthetic complete campaign" }));
    await user.click(screen.getByTestId("vault-checkout-method-wallet"));
    await user.type(screen.getByLabelText("Amount to endow"), "2.50");
    await user.click(screen.getByRole("button", { name: "Continue to Wallet" }));
    await user.click(screen.getByRole("button", { name: "Confirm endowment" }));

    // Success is a terminal screen; the confirm action is replaced by Done.
    expect(await screen.findByTestId("vault-wallet-endow-success")).toBeInTheDocument();
    expect(screen.getByText("Endowment submitted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View transaction" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm endowment" })).not.toBeInTheDocument();
    expect(sharedHookMocks.octantVaultWalletEndowMutate).toHaveBeenCalledTimes(1);

    // Done closes the sheet.
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByTestId("vault-wallet-endow-success")).not.toBeInTheDocument();
  });

  it("surfaces a recovery note when a wallet submission stalls past 30s", () => {
    vi.useFakeTimers();
    try {
      sharedHookMocks.authMode = "wallet";
      sharedHookMocks.primaryAddress = VALID_RECEIVER_ADDRESS;
      // The mutation never settles: a genuinely in-flight deposit (the stall case).
      // With no onSuccess/onError, the submission stays pending and walletBusy stays true.
      sharedHookMocks.octantVaultWalletEndowMutate.mockImplementationOnce(() => undefined);

      renderContent([makeCompleteCampaign()]);

      // fireEvent (not userEvent) keeps the flow timer-agnostic under fake timers.
      fireEvent.click(screen.getByRole("button", { name: "Endow to Synthetic complete campaign" }));
      fireEvent.click(screen.getByTestId("vault-checkout-method-wallet"));
      fireEvent.change(screen.getByLabelText("Amount to endow"), { target: { value: "2.50" } });
      fireEvent.click(screen.getByRole("button", { name: "Continue to Wallet" }));
      fireEvent.click(screen.getByRole("button", { name: "Confirm endowment" }));

      // In flight: the action reads "Submitting...", and no recovery note exists yet.
      expect(screen.getByRole("button", { name: "Submitting..." })).toBeDisabled();
      expect(screen.queryByText(/Taking longer than expected/)).not.toBeInTheDocument();

      // After 30s with no resolution the recovery affordance appears. The same `slow`
      // flag flips the checkout guard to closeLocked:false (VaultCheckoutDialog.tsx),
      // and no Retry is offered, so an in-flight deposit can never be double-submitted.
      act(() => {
        vi.advanceTimersByTime(30_000);
      });

      expect(screen.getByText(/Taking longer than expected/)).toBeInTheDocument();
      // The slow state no longer points to the Fund page; vault positions are
      // managed route-locally from /vaults.
      expect(screen.queryByRole("link", { name: "View on Fund page" })).not.toBeInTheDocument();
      expect(screen.queryByText(/Fund page/i)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
      expect(sharedHookMocks.octantVaultWalletEndowMutate).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("surfaces a clear WETH-shortfall message instead of an opaque wallet error", async () => {
    sharedHookMocks.authMode = "wallet";
    sharedHookMocks.primaryAddress = VALID_RECEIVER_ADDRESS;
    sharedHookMocks.octantVaultWalletEndowError = new VaultDepositStageError(
      "deposit",
      "Connected wallet holds insufficient WETH to complete this deposit",
      "insufficientBalance"
    );

    renderContent([makeCompleteCampaign()]);

    fireEvent.click(screen.getByRole("button", { name: "Endow to Synthetic complete campaign" }));
    fireEvent.click(screen.getByTestId("vault-checkout-method-wallet"));
    fireEvent.change(screen.getByLabelText("Amount to endow"), { target: { value: "2.50" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue to Wallet" }));

    // The specific, actionable message shows instead of the generic wallet error.
    expect(
      await screen.findByText(
        "This wallet doesn't have enough WETH for this endowment. Wrap ETH to WETH first, then try again."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Wallet Endow could not be submitted. Review the wallet error and retry.")
    ).not.toBeInTheDocument();
  });

  it("shows the onchain vault total on the campaign card", () => {
    sharedHookMocks.octantVaultStats = {
      totalAssets: 15000000000n,
      usdCents: 1500000n,
      isLoading: false,
      isError: false,
    };

    renderCard(makeCompleteCampaign());

    const strip = screen.getByTestId("vault-campaign-stats-synthetic-complete");
    expect(within(strip).getByText("In vault")).toBeInTheDocument();
    expect(strip).toHaveTextContent("15,000");
    expect(within(strip).queryByText(/Just launched/)).not.toBeInTheDocument();
  });

  it("shows a just-launched state when the vault is empty", () => {
    sharedHookMocks.octantVaultStats = {
      totalAssets: 0n,
      usdCents: null,
      isLoading: false,
      isError: false,
    };

    renderCard(makeCompleteCampaign());

    const strip = screen.getByTestId("vault-campaign-stats-synthetic-complete");
    expect(within(strip).getByText("Just launched. Be the first to endow.")).toBeInTheDocument();
  });
});
