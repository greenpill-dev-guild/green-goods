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
}));

const thirdwebMocks = vi.hoisted(() => {
  const receiverAddress = "0x4444444444444444444444444444444444444444";
  const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  /** $30 at the mocked $3,000/ETH feed → 0.01 WETH in base units. */
  const expectedFundingAmount = 10000000000000000n;

  /**
   * Default read routing: the WETH token contract answers the funding-balance
   * proof with exactly the expected amount; every other contract (the vault)
   * answers the share read with 12 shares. Tests override per scenario.
   */
  const defaultReadContract = async (options: unknown) => {
    const address = (
      options as { contract?: { address?: string } }
    )?.contract?.address?.toLowerCase();
    if (address === wethTokenAddress.toLowerCase()) return expectedFundingAmount;
    return 12n;
  };

  const state = {
    receiverAddress,
    wethTokenAddress,
    expectedFundingAmount,
    defaultReadContract,
    adminAddress: receiverAddress,
    activeAccount: undefined as { address: string } | undefined,
    activeWallet: { id: "inApp" },
    createThirdwebClient: vi.fn((options: { clientId: string }) => ({
      clientId: options.clientId,
    })),
    getContract: vi.fn((options: unknown) => options),
    inAppWallet: vi.fn(() => ({
      connect: vi.fn(async () => ({ address: receiverAddress })),
      getAdminAccount: vi.fn(() => ({ address: state.adminAddress })),
    })),
    preAuthenticate: vi.fn(async () => undefined),
    prepareContractCall: vi.fn((options: unknown) => ({ kind: "prepared", options })),
    readContract: vi.fn(defaultReadContract),
    sendBatchTransaction: vi.fn(async () => ({
      transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    })),
    waitForReceipt: vi.fn(async (options: { transactionHash: `0x${string}` }) => ({
      ...options,
      status: "success",
    })),
    sendAndConfirmTransaction: vi.fn(async () => ({
      transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    })),
    // Headless onramp (Bridge.Onramp) replaces the embedded BuyWidget. Defaults are
    // (re)set per test in beforeEach so once-overrides can model PENDING/FAILED/fallback.
    onrampPrepare: vi.fn(),
    onrampStatus: vi.fn(),
    useConnectConnect: vi.fn(async (walletOrFn: unknown) => {
      if (typeof walletOrFn === "function") {
        return await (walletOrFn as () => Promise<unknown>)();
      }
      return walletOrFn;
    }),
  };
  return state;
});

const fetchMock = vi.hoisted(() => vi.fn());
const windowOpenMock = vi.hoisted(() => vi.fn());
const checkoutWindowMocks = vi.hoisted(() => {
  type MockCheckoutWindow = {
    location: { href: string; replace: ReturnType<typeof vi.fn> };
    close: ReturnType<typeof vi.fn>;
    closed: boolean;
    opener: unknown;
  };

  return {
    current: null as MockCheckoutWindow | null,
    create() {
      const checkoutWindow = {
        location: { href: "about:blank", replace: vi.fn() },
        close: vi.fn(),
        closed: false,
        opener: { app: "green-goods" },
      } satisfies MockCheckoutWindow;
      checkoutWindow.location.replace.mockImplementation((link: string) => {
        checkoutWindow.location.href = link;
      });
      checkoutWindow.close.mockImplementation(() => {
        checkoutWindow.closed = true;
      });
      return checkoutWindow;
    },
  };
});

vi.stubGlobal("fetch", fetchMock);
vi.stubGlobal("open", windowOpenMock);

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

vi.mock("thirdweb", () => ({
  createThirdwebClient: thirdwebMocks.createThirdwebClient,
  getContract: thirdwebMocks.getContract,
  prepareContractCall: thirdwebMocks.prepareContractCall,
  readContract: thirdwebMocks.readContract,
  waitForReceipt: thirdwebMocks.waitForReceipt,
  Bridge: {
    Onramp: {
      prepare: thirdwebMocks.onrampPrepare,
      status: thirdwebMocks.onrampStatus,
    },
  },
}));

vi.mock("thirdweb/chains", () => ({
  defineChain: (chainId: number) => ({ id: chainId, name: `Chain ${chainId}` }),
  ethereum: { id: 1, name: "Ethereum" },
}));

vi.mock("thirdweb/react", async () => {
  const { createElement } = await import("react");

  return {
    ThirdwebProvider: ({ children }: { children: unknown }) =>
      createElement("div", { "data-testid": "thirdweb-provider" }, children),
    useActiveAccount: () => thirdwebMocks.activeAccount,
    useActiveWallet: () => thirdwebMocks.activeWallet,
    useConnect: () => ({
      connect: thirdwebMocks.useConnectConnect,
      error: null,
      isConnecting: false,
      cancelConnection: vi.fn(),
    }),
    useSendAndConfirmTransaction: () => ({
      mutateAsync: thirdwebMocks.sendAndConfirmTransaction,
      isPending: false,
      error: null,
    }),
    useSendBatchTransaction: () => ({
      mutateAsync: thirdwebMocks.sendBatchTransaction,
      isPending: false,
      error: null,
    }),
  };
});

vi.mock("thirdweb/wallets/in-app", () => ({
  inAppWallet: thirdwebMocks.inAppWallet,
  preAuthenticate: thirdwebMocks.preAuthenticate,
}));

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
      fundingPurpose: "Support public-goods work through a dedicated vault.",
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
    recipientRoutingSummary: "Yield routes to a verified public-goods recipient.",
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

async function openGreenpillCardCheckout(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Endow to Greenpill NYC" }));
  const continueButton = screen.getByRole("button", { name: "Continue" });
  const cardMethod = screen.getByTestId("vault-checkout-method-card");
  expect(continueButton).toBeDisabled();
  expect(cardMethod).toBeEnabled();
  await user.click(cardMethod);
  expect(cardMethod).toHaveAttribute("aria-pressed", "true");
  const continueToCardButton = screen.getByRole("button", { name: "Continue to Card" });
  expect(continueToCardButton).toBeDisabled();
  await user.type(screen.getByLabelText("Amount to endow"), "30");
  expect(continueToCardButton).toBeEnabled();
  await user.click(continueToCardButton);
  await screen.findByTestId("vault-card-endow-flow");
}

async function recoverEmailWallet(
  user: ReturnType<typeof userEvent.setup>,
  email = "qa@example.org"
) {
  await user.type(screen.getByLabelText("Email"), email);
  await user.click(screen.getByRole("button", { name: "Send email code" }));
  await screen.findByText(`Code sent. Check ${email} and enter the 6-digit code below.`);
  await user.type(screen.getByLabelText("Email code"), "123456");
  await user.click(screen.getByRole("button", { name: "Verify email" }));
  // A verified email lands directly on the pay screen — there is no review step.
  await screen.findByTestId("vault-card-payment-panel");
}

async function openSecureCardCheckout(user: ReturnType<typeof userEvent.setup>) {
  // The pay step is the Green Goods-owned panel — never an embedded provider widget.
  await screen.findByTestId("vault-card-payment-panel");
  expect(screen.queryByTestId("thirdweb-buy-widget")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Open secure card checkout" }));
  await waitFor(() => expect(thirdwebMocks.onrampStatus).toHaveBeenCalled());
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
    stubMatchMedia();
    // Card Endow now writes pending/confirmed cache entries; keep tests isolated.
    window.localStorage.clear();
    thirdwebMocks.activeAccount = undefined;
    thirdwebMocks.createThirdwebClient.mockClear();
    thirdwebMocks.getContract.mockClear();
    thirdwebMocks.inAppWallet.mockClear();
    thirdwebMocks.preAuthenticate.mockClear();
    thirdwebMocks.prepareContractCall.mockClear();
    thirdwebMocks.readContract.mockReset();
    thirdwebMocks.readContract.mockImplementation(thirdwebMocks.defaultReadContract);
    thirdwebMocks.adminAddress = thirdwebMocks.receiverAddress;
    thirdwebMocks.sendBatchTransaction.mockReset();
    thirdwebMocks.sendBatchTransaction.mockResolvedValue({
      transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    thirdwebMocks.waitForReceipt.mockReset();
    thirdwebMocks.waitForReceipt.mockImplementation(
      async (options: { transactionHash: `0x${string}` }) => ({
        ...options,
        status: "success",
      })
    );
    thirdwebMocks.sendAndConfirmTransaction.mockClear();
    thirdwebMocks.onrampPrepare.mockReset();
    // The default prepared quote echoes the exact expected route — chain 1,
    // WETH token, recovered receiver, exact base-unit amount. Mismatch tests
    // override individual fields.
    thirdwebMocks.onrampPrepare.mockResolvedValue({
      id: "onramp_test_session",
      link: "https://onramp.test/session",
      currency: "USD",
      currencyAmount: 30,
      destinationAmount: thirdwebMocks.expectedFundingAmount,
      steps: [],
      intent: {
        onramp: "stripe",
        chainId: 1,
        tokenAddress: thirdwebMocks.wethTokenAddress,
        receiver: thirdwebMocks.receiverAddress,
        amount: thirdwebMocks.expectedFundingAmount.toString(),
      },
    });
    thirdwebMocks.onrampStatus.mockReset();
    thirdwebMocks.onrampStatus.mockResolvedValue({ status: "COMPLETED", transactions: [] });
    thirdwebMocks.useConnectConnect.mockClear();
    checkoutWindowMocks.current = null;
    windowOpenMock.mockReset();
    windowOpenMock.mockImplementation(() => {
      const checkoutWindow = checkoutWindowMocks.create();
      checkoutWindowMocks.current = checkoutWindow;
      return checkoutWindow;
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("open", windowOpenMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          id: "fi_card_endow_proof",
          status: "funded",
          provider: "thirdweb",
          receiptUrl: "/vaults?intent=fi_card_endow_proof#receiptToken=tok_test",
          publicReceipt: {
            id: "fi_card_endow_proof",
            status: "funded",
            garden: { id: "greenpill-nyc", name: "Greenpill NYC" },
            destination: {
              type: "vault",
              address: "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5",
            },
            fundingIntent: "endow",
            amount: {
              amountUsd: "0",
              token: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
              chainId: 1,
              fundedAssetAmount: "10000000000000000",
            },
            fundingTxHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            receiverAddress: thirdwebMocks.receiverAddress,
            updatedAt: "2026-06-03T00:00:00.000Z",
            appManagementCta: "manage_endowments",
            managementUrl: "/vaults?manage=positions",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubEnv("VITE_THIRDWEB_CLIENT_ID", "test-thirdweb-client");
    vi.stubEnv("VITE_API_BASE_URL", "https://agent.test");
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
      screen.getByText("Your support funds real public-goods work and keeps working over time.")
    ).toBeInTheDocument();
    expect(sharedHookMocks.walletRuntimeProviderRender).not.toHaveBeenCalled();
    expect(screen.queryByTestId("wallet-runtime-provider")).not.toBeInTheDocument();
  });

  it("scrubs the deprecated Card Endow QA query param while preserving valid route params", async () => {
    const locations: string[] = [];

    // `ref` stands in for an unrelated route param to preserve. (`manage=positions`
    // is no longer inert — it opens the route-local management panel.)
    renderViewWithLocationProbe("/vaults?cardEndowQa=1&ref=newsletter", (location) => {
      locations.push(location);
    });

    await waitFor(() => expect(locations.at(-1)).toBe("/vaults?ref=newsletter"));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Octant vault campaigns for public goods."
    );
    expect(screen.getByRole("button", { name: "Endow to Greenpill NYC" })).toBeEnabled();
  });

  it("shows Endow CTAs for both card-ready vault fixtures", () => {
    renderView();

    const nycCard = screen.getByTestId("vault-campaign-card-greenpill-nyc");
    const evmavericksCard = screen.getByTestId("vault-campaign-card-evmavericks");

    // Greenpill NYC collapses both payment paths into a single Endow CTA.
    expect(within(nycCard).getByRole("button", { name: "Endow to Greenpill NYC" })).toBeEnabled();
    expect(
      within(nycCard).queryByRole("button", { name: /choose amount/i })
    ).not.toBeInTheDocument();
    expect(within(nycCard).queryByRole("button", { name: /pay by card/i })).not.toBeInTheDocument();

    // EVMavericks is wallet-ready and card-ready through the supplied vault tuple.
    expect(
      within(evmavericksCard).getByRole("button", {
        name: "Endow to EVMavericks Fantasy Football League",
      })
    ).toBeEnabled();
    expect(within(evmavericksCard).getByText("Ready for checkout")).toBeInTheDocument();
    expect(
      within(evmavericksCard).getByText(
        "EVMavericks can accept Wallet Endow and Card Endow through its supplied Octant V2 Ethereum vault."
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

  it("offers a complete non-production campaign Wallet checkout only — never Card", async () => {
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

  it("opens EVMavericks with Card and Wallet checkout", async () => {
    const user = userEvent.setup();

    renderView();

    await user.click(
      screen.getByRole("button", { name: "Endow to EVMavericks Fantasy Football League" })
    );

    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeDisabled();
    const cardMethod = screen.getByTestId("vault-checkout-method-card");
    const walletMethod = screen.getByTestId("vault-checkout-method-wallet");
    expect(cardMethod).toBeEnabled();
    expect(walletMethod).toBeEnabled();
    await user.click(cardMethod);
    expect(cardMethod).toHaveAttribute("aria-pressed", "true");
    const continueToCardButton = screen.getByRole("button", { name: "Continue to Card" });
    expect(continueToCardButton).toBeDisabled();
    await user.type(screen.getByLabelText("Amount to endow"), "25");
    expect(continueToCardButton).toBeEnabled();
    await user.click(continueToCardButton);

    expect(await screen.findByTestId("vault-card-endow-flow")).toBeInTheDocument();
    await recoverEmailWallet(user, "evm@example.org");
    const panel = screen.getByTestId("vault-card-payment-panel");
    expect(panel).toHaveTextContent("EVMavericks Fantasy Football League");
    const planDetails = screen.getByTestId("vault-card-endow-plan-details");
    expect(planDetails).toHaveTextContent("Ethereum Mainnet");
    expect(
      within(planDetails).getByRole("link", {
        name: "0x0bCe8c16974FFD3B410A32365c5bCf27a5A630Fc",
      })
    ).toHaveAttribute(
      "href",
      "https://etherscan.io/address/0x0bCe8c16974FFD3B410A32365c5bCf27a5A630Fc"
    );
    expect(
      within(planDetails).getByRole("link", {
        name: /0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/,
      })
    ).toHaveAttribute(
      "href",
      "https://etherscan.io/address/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    );
    expect(screen.queryByTestId("thirdweb-buy-widget")).not.toBeInTheDocument();
  });

  it("explains the Octant yield-donating strategy without APY claims", () => {
    renderView();

    expect(screen.getByRole("heading", { name: "How yield support works" })).toBeInTheDocument();
    expect(screen.getByText("Project-supporting value generated")).toBeInTheDocument();
    expect(screen.getAllByText("0 WETH")).not.toHaveLength(0);
    expect(
      screen.getAllByText(
        "The project-support router is proven, but it does not currently hold donation shares."
      )
    ).not.toHaveLength(0);
    expect(
      screen.getByText(
        /Supporters receive vault shares for their WETH-backed position, while reported strategy profit is represented as project-supporting donation shares/i
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
    expect(screen.queryByText(/APY/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/guaranteed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/accrued profit/i)).not.toBeInTheDocument();
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

  it("renders a positive aggregate project-supporting value without per-user profit copy", () => {
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
        "Estimated from donation shares held by the configured project-support router."
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
    await user.click(screen.getByTestId("vault-checkout-method-card"));
    const continueToCardButton = screen.getByRole("button", { name: "Continue to Card" });
    const amountInput = screen.getByLabelText("Amount to endow");

    await user.type(amountInput, "abc");

    expect(amountInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter a valid dollar amount.")).toBeInTheDocument();
    expect(screen.getByTestId("vault-checkout-method-card")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(continueToCardButton).toBeDisabled();
  });

  it("treats unavailable ETH pricing as a status callout, not an amount field error", async () => {
    const user = userEvent.setup();
    sharedHookMocks.ethUsdHasFeed = false;

    renderView();

    await user.click(screen.getByRole("button", { name: "Endow to Greenpill NYC" }));
    await user.click(screen.getByTestId("vault-checkout-method-card"));
    const amountInput = screen.getByLabelText("Amount to endow");
    await user.type(amountInput, "30");

    expect(amountInput).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByText("Enter a valid dollar amount.")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "ETH pricing is temporarily unavailable. Keep this amount and try again in a moment."
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId("vault-checkout-method-card")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Continue to Card" })).toBeDisabled();
  });

  it("enforces the $2 card minimum at setup without constraining the wallet path", async () => {
    const user = userEvent.setup();

    renderView();

    await user.click(screen.getByRole("button", { name: "Endow to Greenpill NYC" }));
    await user.click(screen.getByTestId("vault-checkout-method-card"));
    expect(screen.getByText("Debit or credit · $2 minimum")).toBeInTheDocument();
    const amountInput = screen.getByLabelText("Amount to endow");
    await user.type(amountInput, "1.50");
    expect(amountInput).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText("Card payments need at least $2.00. Enter a higher amount or choose Wallet.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to Card" })).toBeDisabled();

    // The provider minimum is card-only — the same amount stays valid for Wallet.
    await user.click(screen.getByTestId("vault-checkout-method-wallet"));
    expect(
      screen.queryByText(
        "Card payments need at least $2.00. Enter a higher amount or choose Wallet."
      )
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to Wallet" })).toBeEnabled();

    // Back on Card, meeting the minimum clears the error and unlocks continue.
    await user.click(screen.getByTestId("vault-checkout-method-card"));
    expect(screen.getByRole("button", { name: "Continue to Card" })).toBeDisabled();
    await user.clear(amountInput);
    await user.type(amountInput, "2");
    expect(
      screen.queryByText(
        "Card payments need at least $2.00. Enter a higher amount or choose Wallet."
      )
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to Card" })).toBeEnabled();
  });

  it("runs the Card Endow checkout from one setup screen and records proof", async () => {
    const user = userEvent.setup();
    thirdwebMocks.onrampStatus.mockResolvedValueOnce({ status: "PENDING", transactions: [] });

    renderView();

    expect(screen.getByRole("heading", { name: "Greenpill NYC" })).toBeInTheDocument();

    // One Endow CTA opens setup with amount and method together, so users do not
    // bounce through a separate amount-only page.
    await user.click(screen.getByRole("button", { name: "Endow to Greenpill NYC" }));
    const continueButton = screen.getByRole("button", { name: "Continue" });
    const cardMethod = screen.getByTestId("vault-checkout-method-card");
    const walletMethod = screen.getByTestId("vault-checkout-method-wallet");
    expect(continueButton).toBeDisabled();
    expect(cardMethod).toBeInTheDocument();
    expect(walletMethod).toBeInTheDocument();
    expect(cardMethod).toBeEnabled();
    expect(walletMethod).toBeEnabled();
    expect(
      screen.getByText("Choose the amount to endow, then pick how you want to pay.")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Enter a dollar amount first to choose a payment method.")
    ).not.toBeInTheDocument();

    await user.click(cardMethod);
    expect(cardMethod).toHaveAttribute("aria-pressed", "true");
    const continueToCardButton = screen.getByRole("button", { name: "Continue to Card" });
    expect(continueToCardButton).toBeDisabled();
    await user.type(screen.getByLabelText("Amount to endow"), "30");
    expect(continueToCardButton).toBeEnabled();
    await user.click(continueToCardButton);
    expect(await screen.findByTestId("vault-card-endow-flow")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Verify email wallet")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("qa@example.org")).not.toBeInTheDocument();
    // No locked code field clutters Step 1 before a code exists.
    expect(screen.queryByLabelText("Email code")).not.toBeInTheDocument();
    expect(screen.queryByText("Send the code above to unlock this field.")).not.toBeInTheDocument();
    expect(screen.getByText("$30.00")).toBeInTheDocument();
    expect(screen.getByText("Settles into the Octant vault as 0.01 WETH")).toBeInTheDocument();
    expect(screen.queryByText(/Wrapped ETH/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Email"), "qa@example.org");
    expect(screen.queryByText("qa@example.org")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send email code" }));
    expect(
      screen.getByText("Code sent. Check qa@example.org and enter the 6-digit code below.")
    ).toBeInTheDocument();

    expect(thirdwebMocks.preAuthenticate).toHaveBeenCalledWith({
      client: { clientId: "test-thirdweb-client" },
      strategy: "email",
      email: "qa@example.org",
    });

    await user.type(screen.getByLabelText("Email code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify email" }));

    expect(thirdwebMocks.useConnectConnect).toHaveBeenCalledTimes(1);
    expect(thirdwebMocks.inAppWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        executionMode: {
          mode: "EIP7702",
          sponsorGas: true,
        },
      })
    );
    expect(screen.getByText("qa@example.org")).toBeInTheDocument();

    // A verified email lands directly on the Green Goods-owned payment panel —
    // there is no intermediate review step, and never an embedded provider widget.
    expect(await screen.findByTestId("vault-card-payment-panel")).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Secure card payment" })).toBeInTheDocument();
    expect(screen.queryByText("Step 3 of 3")).not.toBeInTheDocument();
    expect(screen.queryByText("Review card route")).not.toBeInTheDocument();
    expect(
      screen.queryByText("No card payment starts until you continue.")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continue to card payment" })
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("thirdweb-buy-widget")).not.toBeInTheDocument();
    expect(screen.queryByText("Step 4 of 4")).not.toBeInTheDocument();

    // Back stays available until the donor opens checkout — a prefetched session
    // alone never locks it.
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();

    // The route facts render beside the payment CTA, technical details collapsed.
    const planDetails = screen.getByTestId("vault-card-endow-plan-details");
    expect(planDetails).toHaveTextContent("Technical WETH details");
    expect(planDetails).toHaveTextContent("Ethereum Mainnet");
    expect(
      within(planDetails).getByRole("link", {
        name: "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5",
      })
    ).toHaveAttribute(
      "href",
      "https://etherscan.io/address/0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5"
    );
    expect(
      within(planDetails).getByRole("link", {
        name: /0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/,
      })
    ).toHaveAttribute(
      "href",
      "https://etherscan.io/address/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    );
    expect(planDetails).toHaveTextContent("Checkout wallet");
    expect(screen.queryByText("Provider route")).not.toBeInTheDocument();
    expect(screen.queryByText(/base units/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/exact campaign/i)).not.toBeInTheDocument();

    // The onramp session is prefetched the moment the pay step opens — Coinbase
    // first, onramping to ETH (Bridge wraps it into WETH) so the donor never sees
    // a USDC step. The CTA label flips from "Opening..." to ready once the link is
    // set, so waiting for that name also waits out the prefetch.
    const openCheckoutButton = await screen.findByRole("button", {
      name: "Open secure card checkout",
    });
    await waitFor(() => expect(thirdwebMocks.onrampPrepare).toHaveBeenCalledTimes(1));
    expect(thirdwebMocks.onrampPrepare).toHaveBeenCalledWith(
      expect.objectContaining({
        onramp: "coinbase",
        chainId: 1,
        tokenAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        receiver: thirdwebMocks.receiverAddress,
        amount: 10000000000000000n,
        purchaseData: expect.objectContaining({
          intent: "octant_vault_card_endow",
          route: "/vaults",
          campaignSlug: "greenpill-nyc",
          vaultAddress: "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5",
          tokenAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
          receiverAddress: thirdwebMocks.receiverAddress,
          amount: "10000000000000000",
        }),
      })
    );

    // Because the link is prefetched, opening checkout is a synchronous new-tab
    // open from the click gesture — no about:blank placeholder, no redirect.
    await user.click(openCheckoutButton);
    expect(windowOpenMock).toHaveBeenCalledWith(
      "https://onramp.test/session",
      "_blank",
      "noopener"
    );
    // Once the donor opens checkout, the escape hatch back to setup is locked.
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("vault-card-payment-panel")).getAllByRole("status")[0]
    ).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("link", { name: "Open secure checkout link" })).toHaveAttribute(
      "href",
      "https://onramp.test/session"
    );

    await waitFor(() =>
      expect(thirdwebMocks.onrampStatus).toHaveBeenCalledWith({
        id: "onramp_test_session",
        client: { clientId: "test-thirdweb-client" },
      })
    );
    expect(
      await screen.findByText(
        "Your card payment is still processing. Finish it in the checkout tab, then check the status again."
      )
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Check payment status" }));

    // COMPLETED card funding auto-starts one ordered approve -> deposit batch.
    await waitFor(() => expect(thirdwebMocks.sendBatchTransaction).toHaveBeenCalledTimes(1));
    expect(thirdwebMocks.sendAndConfirmTransaction).not.toHaveBeenCalled();
    const batchTransactions = thirdwebMocks.sendBatchTransaction.mock.calls[0]?.[0] as Array<{
      options: { method: string };
    }>;
    expect(batchTransactions).toHaveLength(2);
    expect(batchTransactions[0]?.options.method).toBe(
      "function approve(address spender, uint256 value)"
    );
    expect(batchTransactions[1]?.options.method).toBe(
      "function deposit(uint256 assets, address receiver) returns (uint256)"
    );
    expect(screen.queryByText("Step 4 of 4")).not.toBeInTheDocument();
    expect(thirdwebMocks.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "function balanceOf(address account) view returns (uint256)",
        params: [thirdwebMocks.receiverAddress],
      })
    );
    expect(
      await screen.findByText(
        "Endowment complete. Your verified email wallet now holds the vault position for this campaign."
      )
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        "Vault position confirmed: 12 shares are visible for your verified email wallet."
      )
    ).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.test/public/funding-intents/proof",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "content-type": "application/json" }),
      })
    );
    const proofBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(proofBody).toMatchObject({
      gardenId: "greenpill-nyc",
      gardenName: "Greenpill NYC",
      destinationType: "vault",
      destinationAddress: "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5",
      fundingIntent: "endow",
      paymentMethod: "card",
      provider: "thirdweb",
      sourceRoute: "/vaults",
      chainId: 1,
      token: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      amount: "10000000000000000",
      receiverAddress: thirdwebMocks.receiverAddress,
      receiverCustody: "user_owned_recovered_wallet",
      transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      shareBalance: "12",
      payerEmail: "qa@example.org",
    });
    expect(
      await screen.findByText("Receipt recorded for your vault contribution.")
    ).toBeInTheDocument();
  });

  it("walks three visible stages and auto-starts Step 3 settlement only after every proof gate", async () => {
    const user = userEvent.setup();
    type MockBatchResult = { transactionHash: `0x${string}` };
    let resolveBatch: ((value: MockBatchResult) => void) | undefined;
    thirdwebMocks.sendBatchTransaction.mockImplementationOnce(
      () =>
        new Promise<MockBatchResult>((resolve) => {
          resolveBatch = resolve;
        })
    );

    renderView();

    // Step 1 of 3 — verify email wallet, with no locked code field beforehand.
    await openGreenpillCardCheckout(user);
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Verify email wallet" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Email code")).not.toBeInTheDocument();

    // Step 2 of 3 — secure card payment.
    await recoverEmailWallet(user);
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Secure card payment" })).toBeInTheDocument();
    expect(screen.queryByText("Step 3 of 3")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open secure card checkout" }));

    // Settlement starts only after the exact quote, COMPLETED status, and the
    // covering WETH balance read all passed.
    await waitFor(() => expect(thirdwebMocks.sendBatchTransaction).toHaveBeenCalledTimes(1));
    const fundingBalanceReads = thirdwebMocks.readContract.mock.calls.filter(
      ([options]) =>
        (options as { contract?: { address?: string } })?.contract?.address?.toLowerCase() ===
        thirdwebMocks.wethTokenAddress.toLowerCase()
    );
    expect(fundingBalanceReads.length).toBeGreaterThan(0);

    // Step 3 of 3 — vault deposit and proof, visible while the batch settles.
    expect(await screen.findByTestId("vault-card-endow-settle")).toBeInTheDocument();
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vault deposit and proof" })).toBeInTheDocument();
    expect(screen.getByText("Depositing into the vault")).toBeInTheDocument();

    await act(async () => {
      resolveBatch?.({
        transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      });
    });

    expect(
      await screen.findByText(
        "Endowment complete. Your verified email wallet now holds the vault position for this campaign."
      )
    ).toBeInTheDocument();
  });

  it("blocks checkout/session acceptance when the prepared quote mismatches the route", async () => {
    const user = userEvent.setup();
    // Every provider quotes a different receiver than the recovered wallet.
    thirdwebMocks.onrampPrepare.mockResolvedValue({
      id: "onramp_attacker_session",
      link: "https://onramp.test/attacker",
      currency: "USD",
      currencyAmount: 30,
      destinationAmount: thirdwebMocks.expectedFundingAmount,
      steps: [],
      intent: {
        onramp: "stripe",
        chainId: 1,
        tokenAddress: thirdwebMocks.wethTokenAddress,
        receiver: "0x9999999999999999999999999999999999999999",
        amount: thirdwebMocks.expectedFundingAmount.toString(),
      },
    });

    renderView();

    await openGreenpillCardCheckout(user);
    await recoverEmailWallet(user);
    // The session is prefetched on mount: both providers were tried and both
    // mismatched quotes were rejected, so no session is ever accepted.
    await waitFor(() => expect(thirdwebMocks.onrampPrepare).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The checkout quote didn't match this endowment, so no card payment was started. Please try again."
    );
    // No session was accepted: no checkout link, no status polling, and no
    // settlement transaction of any kind.
    expect(
      screen.queryByRole("link", { name: "Open secure checkout link" })
    ).not.toBeInTheDocument();
    expect(thirdwebMocks.onrampStatus).not.toHaveBeenCalled();
    expect(thirdwebMocks.sendBatchTransaction).not.toHaveBeenCalled();
    expect(thirdwebMocks.sendAndConfirmTransaction).not.toHaveBeenCalled();
    // The state is recoverable in place — the donor can retry or step back.
    expect(screen.getByRole("button", { name: "Open secure card checkout" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
  });

  it("does not start settlement when COMPLETED has no covering WETH balance", async () => {
    const user = userEvent.setup();
    // The provider says COMPLETED, but the recovered wallet's WETH balance never
    // covers the expected amount.
    thirdwebMocks.readContract.mockImplementation(async (options: unknown) => {
      const address = (
        options as { contract?: { address?: string } }
      )?.contract?.address?.toLowerCase();
      if (address === thirdwebMocks.wethTokenAddress.toLowerCase()) return 0n;
      return 12n;
    });

    renderView();

    await openGreenpillCardCheckout(user);
    await recoverEmailWallet(user);
    await user.click(await screen.findByRole("button", { name: "Open secure card checkout" }));

    await waitFor(() => expect(thirdwebMocks.onrampStatus).toHaveBeenCalled());
    expect(
      await screen.findByText(
        "Card payment confirmed. Waiting for the funds to arrive in your verified email wallet — the vault deposit starts once they land."
      )
    ).toBeInTheDocument();
    // No approve/deposit of any kind started, and the donor stays on Step 2
    // with a live recheck affordance.
    expect(thirdwebMocks.sendBatchTransaction).not.toHaveBeenCalled();
    expect(thirdwebMocks.sendAndConfirmTransaction).not.toHaveBeenCalled();
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    expect(screen.queryByTestId("vault-card-endow-settle")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check payment status" })).toBeEnabled();

    // The proven payment (COMPLETED + valid tuple) already persisted the
    // pending-funded recovery entry, so a donor who leaves while the funds are
    // in transit can still finish the deposit from /vaults?manage=positions.
    const raw = window.localStorage.getItem("gg:octant-vault-card-wallets:v1") ?? "[]";
    const entries = JSON.parse(raw) as Array<Record<string, unknown>>;
    expect(
      entries.find(
        (entry) =>
          entry.status === "pending_funded" &&
          entry.recoveredWalletAddress === thirdwebMocks.receiverAddress
      )
    ).toMatchObject({
      campaignSlug: "greenpill-nyc",
      tokenAddress: thirdwebMocks.wethTokenAddress,
      expectedAmount: thirdwebMocks.expectedFundingAmount.toString(),
    });
    expect(raw).not.toMatch(/qa@example\.org|otp|receipt|session/i);
  });

  it("records no proof when the vault share read returns zero", async () => {
    const user = userEvent.setup();
    // Funding proof passes, the deposit lands, but the share read returns zero.
    thirdwebMocks.readContract.mockImplementation(async (options: unknown) => {
      const address = (
        options as { contract?: { address?: string } }
      )?.contract?.address?.toLowerCase();
      if (address === thirdwebMocks.wethTokenAddress.toLowerCase()) {
        return thirdwebMocks.expectedFundingAmount;
      }
      return 0n;
    });

    renderView();

    await openGreenpillCardCheckout(user);
    await recoverEmailWallet(user);
    await user.click(await screen.findByRole("button", { name: "Open secure card checkout" }));

    await waitFor(() => expect(thirdwebMocks.sendBatchTransaction).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("We could not confirm vault shares yet.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens route-local management at /vaults?manage=positions after a card success", async () => {
    const user = userEvent.setup();
    const locations: string[] = [];

    renderViewWithLocationProbe("/vaults", (location) => {
      locations.push(location);
    });

    await openGreenpillCardCheckout(user);
    await recoverEmailWallet(user);
    await user.click(await screen.findByRole("button", { name: "Open secure card checkout" }));

    const manageButton = await screen.findByRole("button", { name: "Manage vault position" });
    await user.click(manageButton);

    await waitFor(() => expect(locations.at(-1)).toBe("/vaults?manage=positions"));
    expect(await screen.findByTestId("vault-manage-positions-panel")).toBeInTheDocument();
    // Route-local: no address, email, or provider identifier ever enters the
    // URL, and the handoff never leaves /vaults for /fund.
    expect(locations.join(" ")).not.toMatch(/0x[a-fA-F0-9]{6,}|@|onramp|session|token=|fund/);
  });

  it("caches a safe pending-funded recovery entry and stays recoverable when the batch fails", async () => {
    const user = userEvent.setup();
    const locations: string[] = [];
    thirdwebMocks.sendBatchTransaction.mockRejectedValueOnce(new Error("batch unsupported"));

    renderViewWithLocationProbe("/vaults", (location) => {
      locations.push(location);
    });

    await openGreenpillCardCheckout(user);
    await recoverEmailWallet(user);
    await user.click(await screen.findByRole("button", { name: "Open secure card checkout" }));

    await waitFor(() => expect(thirdwebMocks.sendBatchTransaction).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId("vault-card-endow-settle")).toBeInTheDocument();

    // The recovery state is route-local (no identifiers in the URL) and
    // recoverable (the inline fallback can finish the deposit).
    expect(locations.at(-1)).toBe("/vaults");
    expect(await screen.findByRole("button", { name: "Finish vault deposit" })).toBeEnabled();

    // The pending-funded cache entry carries ONLY safe public metadata.
    const raw = window.localStorage.getItem("gg:octant-vault-card-wallets:v1") ?? "";
    const entries = JSON.parse(raw) as Array<Record<string, unknown>>;
    const pending = entries.find((entry) => entry.status === "pending_funded");
    expect(pending).toMatchObject({
      recoveredWalletAddress: thirdwebMocks.receiverAddress,
      campaignSlug: "greenpill-nyc",
      vaultAddress: "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5",
      chainId: 1,
      tokenAddress: thirdwebMocks.wethTokenAddress,
      expectedAmount: thirdwebMocks.expectedFundingAmount.toString(),
      status: "pending_funded",
    });
    expect(raw).not.toMatch(/qa@example\.org|otp|receipt|session/i);
  });

  it("returns to setup from the pay screen before a card session starts", async () => {
    const user = userEvent.setup();

    renderView();

    await openGreenpillCardCheckout(user);
    await recoverEmailWallet(user);

    // The session is prefetched on this step, but a prefetched session alone must
    // not lock Back — the donor can still return to editable setup until they open
    // checkout (locking is gated on opening, not on a session existing).
    await waitFor(() => expect(thirdwebMocks.onrampPrepare).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByLabelText("Amount to endow")).toBeInTheDocument();
    expect(screen.getByTestId("vault-checkout-method-card")).toBeEnabled();

    // Re-entering the card path restarts at email verification (state was reset).
    await user.click(screen.getByRole("button", { name: "Continue to Card" }));
    expect(await screen.findByTestId("vault-card-endow-flow")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });

  it("waits for the batch receipt before confirming shares", async () => {
    const user = userEvent.setup();
    type MockReceipt = { transactionHash: `0x${string}`; status: "success" };
    let resolveReceipt: ((value: MockReceipt) => void) | undefined;
    thirdwebMocks.waitForReceipt.mockImplementationOnce(
      () =>
        new Promise<MockReceipt>((resolve) => {
          resolveReceipt = resolve;
        })
    );

    renderView();

    await openGreenpillCardCheckout(user);
    await recoverEmailWallet(user);
    await user.click(await screen.findByRole("button", { name: "Open secure card checkout" }));

    await waitFor(() => expect(thirdwebMocks.sendBatchTransaction).toHaveBeenCalledTimes(1));
    expect(thirdwebMocks.waitForReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      })
    );
    // The WETH funding-balance proof read already ran before settlement, but the
    // vault SHARE read must wait for the batch receipt.
    const vaultShareReads = () =>
      thirdwebMocks.readContract.mock.calls.filter(
        ([options]) =>
          (options as { contract?: { address?: string } })?.contract?.address?.toLowerCase() ===
          "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5".toLowerCase()
      );
    expect(vaultShareReads()).toHaveLength(0);
    expect(screen.getByText("Depositing into the vault")).toBeInTheDocument();
    expect(
      screen.queryByText("Receipt recorded for your vault contribution.")
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveReceipt?.({
        transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        status: "success",
      });
    });

    await waitFor(() => expect(vaultShareReads()).toHaveLength(1));
    expect(
      await screen.findByText("Receipt recorded for your vault contribution.")
    ).toBeInTheDocument();
  });

  it("keeps the supporter on the payment step when the card payment is still pending", async () => {
    const user = userEvent.setup();
    thirdwebMocks.onrampStatus.mockResolvedValueOnce({ status: "PENDING", transactions: [] });

    renderView();

    await openGreenpillCardCheckout(user);
    await recoverEmailWallet(user);
    await user.click(await screen.findByRole("button", { name: "Open secure card checkout" }));

    // PENDING never leaves Step 2 or runs an on-chain transaction.
    await waitFor(() => expect(thirdwebMocks.onrampStatus).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(
        "Your card payment is still processing. Finish it in the checkout tab, then check the status again."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    expect(screen.queryByText("Step 3 of 3")).not.toBeInTheDocument();
    expect(thirdwebMocks.sendBatchTransaction).not.toHaveBeenCalled();
    expect(thirdwebMocks.sendAndConfirmTransaction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Check payment status" })).toBeEnabled();

    // A manual status check keeps the pending notice mounted — the upfront state
    // clear that blanked the notice during every poll is gone.
    thirdwebMocks.onrampStatus.mockResolvedValueOnce({ status: "PENDING", transactions: [] });
    await user.click(screen.getByRole("button", { name: "Check payment status" }));
    expect(
      screen.getByText(
        "Your card payment is still processing. Finish it in the checkout tab, then check the status again."
      )
    ).toBeInTheDocument();
  });

  it("keeps the pending notice steady across silent background polls", async () => {
    const user = userEvent.setup();
    let resolveSecondCheck: ((value: { status: string; transactions: never[] }) => void) | null =
      null;
    thirdwebMocks.onrampStatus
      .mockResolvedValueOnce({ status: "PENDING", transactions: [] })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondCheck = resolve;
          })
      );

    renderView();

    await openGreenpillCardCheckout(user);
    await recoverEmailWallet(user);
    await user.click(screen.getByRole("button", { name: "Open secure card checkout" }));

    await waitFor(() => expect(thirdwebMocks.onrampStatus).toHaveBeenCalledTimes(1));
    const pendingNotice = await screen.findByText(
      "Your card payment is still processing. Finish it in the checkout tab, then check the status again."
    );

    // The next background poll fires after the real 5s interval and is held
    // in flight by the deferred mock.
    await waitFor(() => expect(thirdwebMocks.onrampStatus).toHaveBeenCalledTimes(2), {
      timeout: 7_000,
    });

    // Mid-flight the poll is visually silent: the notice is the same mounted
    // node (never blanked by an upfront state clear) and the manual button
    // never flips to its busy label.
    expect(
      screen.getByText(
        "Your card payment is still processing. Finish it in the checkout tab, then check the status again."
      )
    ).toBe(pendingNotice);
    expect(screen.getByRole("button", { name: "Check payment status" })).toBeEnabled();
    expect(screen.queryByText("Checking payment...")).not.toBeInTheDocument();

    await act(async () => {
      resolveSecondCheck?.({ status: "PENDING", transactions: [] });
    });
    expect(
      screen.getByText(
        "Your card payment is still processing. Finish it in the checkout tab, then check the status again."
      )
    ).toBe(pendingNotice);
  }, 15_000);

  it("falls back to Stripe when the Coinbase onramp prepare fails", async () => {
    const user = userEvent.setup();
    thirdwebMocks.onrampPrepare.mockRejectedValueOnce(new Error("coinbase unavailable"));
    thirdwebMocks.onrampStatus.mockResolvedValueOnce({ status: "PENDING", transactions: [] });

    renderView();

    await openGreenpillCardCheckout(user);
    await recoverEmailWallet(user);

    // Coinbase failed in a controlled way during prefetch, so the panel falls back
    // to Stripe and still prepares a usable session before the donor opens checkout.
    const openCheckoutButton = await screen.findByRole("button", {
      name: "Open secure card checkout",
    });
    await waitFor(() => expect(thirdwebMocks.onrampPrepare).toHaveBeenCalledTimes(2));
    expect(thirdwebMocks.onrampPrepare.mock.calls[0]?.[0]).toMatchObject({ onramp: "coinbase" });
    expect(thirdwebMocks.onrampPrepare.mock.calls[1]?.[0]).toMatchObject({ onramp: "stripe" });

    await user.click(openCheckoutButton);
    expect(windowOpenMock).toHaveBeenCalledWith(
      "https://onramp.test/session",
      "_blank",
      "noopener"
    );
    expect(screen.getByRole("link", { name: "Open secure checkout link" })).toHaveAttribute(
      "href",
      "https://onramp.test/session"
    );
  });

  it("keeps a direct checkout link available when the browser blocks the new tab", async () => {
    const user = userEvent.setup();
    windowOpenMock.mockReturnValueOnce(null);
    thirdwebMocks.onrampStatus.mockResolvedValueOnce({ status: "PENDING", transactions: [] });

    renderView();

    await openGreenpillCardCheckout(user);
    await recoverEmailWallet(user);

    const openCheckoutButton = await screen.findByRole("button", {
      name: "Open secure card checkout",
    });
    await waitFor(() => expect(thirdwebMocks.onrampPrepare).toHaveBeenCalledTimes(1));
    await user.click(openCheckoutButton);

    // The new-tab open was blocked, but the prefetched link stays available
    // in-panel so the donor can still reach checkout.
    expect(windowOpenMock).toHaveBeenCalledWith(
      "https://onramp.test/session",
      "_blank",
      "noopener"
    );
    expect(
      await screen.findByText(
        "Card checkout is ready. If a new tab did not open, use the secure checkout link below, then return here to confirm your vault position."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open secure checkout link" })).toHaveAttribute(
      "href",
      "https://onramp.test/session"
    );
    expect(screen.getByRole("button", { name: "Check payment status" })).toBeEnabled();
  });

  it("keeps provider prepare errors generic across providers", async () => {
    const user = userEvent.setup();
    thirdwebMocks.onrampPrepare.mockRejectedValue(new Error("stripe unavailable: provider trace"));

    renderView();

    await openGreenpillCardCheckout(user);
    await recoverEmailWallet(user);

    // Prefetch tries both providers on mount; both fail, so the donor-facing error
    // stays generic and no provider trace leaks, with no session accepted.
    await waitFor(() => expect(thirdwebMocks.onrampPrepare).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't open card checkout. Please try again."
    );
    expect(screen.queryByText(/provider trace/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open secure checkout link" })
    ).not.toBeInTheDocument();
  });

  it("keeps provider status errors generic", async () => {
    const user = userEvent.setup();
    thirdwebMocks.onrampStatus.mockRejectedValueOnce(new Error("coinbase session trace"));

    renderView();

    await openGreenpillCardCheckout(user);
    await recoverEmailWallet(user);
    await user.click(await screen.findByRole("button", { name: "Open secure card checkout" }));

    await waitFor(() => expect(thirdwebMocks.onrampStatus).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't check your payment yet. Please try again."
    );
    expect(screen.queryByText(/session trace/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Step 4 of 4")).not.toBeInTheDocument();
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    });
    expect(thirdwebMocks.onrampStatus).toHaveBeenCalledTimes(1);
    expect(thirdwebMocks.sendBatchTransaction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Check payment status" }));
    await waitFor(() => expect(thirdwebMocks.sendBatchTransaction).toHaveBeenCalledTimes(1));
  });

  it("surfaces a recoverable error and never advances when the card payment fails", async () => {
    const user = userEvent.setup();
    thirdwebMocks.onrampStatus.mockResolvedValueOnce({ status: "FAILED", transactions: [] });

    renderView();

    await openGreenpillCardCheckout(user);
    await recoverEmailWallet(user);
    await user.click(await screen.findByRole("button", { name: "Open secure card checkout" }));

    await waitFor(() => expect(thirdwebMocks.onrampStatus).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(
        "That card payment didn't go through. You can open checkout again to try once more."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("Step 4 of 4")).not.toBeInTheDocument();
    expect(thirdwebMocks.sendBatchTransaction).not.toHaveBeenCalled();
    expect(thirdwebMocks.sendAndConfirmTransaction).not.toHaveBeenCalled();
    // Retry creates a fresh provider session rather than sending the donor back to
    // the failed checkout session.
    expect(
      screen.queryByRole("link", { name: "Open secure checkout link" })
    ).not.toBeInTheDocument();
    // The failed session is cleared, so the donor can also step back to setup.
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Open secure card checkout" }));
    await waitFor(() => expect(thirdwebMocks.onrampPrepare).toHaveBeenCalledTimes(2));
  });

  it("shows an inline fallback when the batch fails and finishes with sequential transactions", async () => {
    const user = userEvent.setup();
    thirdwebMocks.sendBatchTransaction.mockRejectedValueOnce(new Error("batch unsupported"));

    renderView();

    await openGreenpillCardCheckout(user);
    await recoverEmailWallet(user);
    await user.click(await screen.findByRole("button", { name: "Open secure card checkout" }));

    await waitFor(() => expect(thirdwebMocks.onrampStatus).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(thirdwebMocks.sendBatchTransaction).toHaveBeenCalledTimes(1));
    // The failed batch keeps the donor on Step 3 with the inline fallback.
    expect(await screen.findByTestId("vault-card-endow-settle")).toBeInTheDocument();
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vault deposit and proof" })).toBeInTheDocument();
    expect(screen.queryByText("batch unsupported")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "The vault deposit could not finish automatically. Use the button below to finish the deposit."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Fallback ready")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Finish vault deposit" })).toBeEnabled();
    expect(thirdwebMocks.sendAndConfirmTransaction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Finish vault deposit" }));

    await waitFor(() => expect(thirdwebMocks.sendAndConfirmTransaction).toHaveBeenCalledTimes(2));
    const firstSequentialTx = thirdwebMocks.sendAndConfirmTransaction.mock.calls[0]?.[0] as {
      options: { method: string };
    };
    const secondSequentialTx = thirdwebMocks.sendAndConfirmTransaction.mock.calls[1]?.[0] as {
      options: { method: string };
    };
    expect(firstSequentialTx.options.method).toBe(
      "function approve(address spender, uint256 value)"
    );
    expect(secondSequentialTx.options.method).toBe(
      "function deposit(uint256 assets, address receiver) returns (uint256)"
    );
    expect(
      await screen.findByText(
        "Endowment complete. Your verified email wallet now holds the vault position for this campaign."
      )
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Receipt recorded for your vault contribution.")
    ).toBeInTheDocument();
  });

  it("uses the sequential fallback when the batch account differs from the recovered wallet", async () => {
    const user = userEvent.setup();
    thirdwebMocks.adminAddress = "0x5555555555555555555555555555555555555555";

    renderView();

    await openGreenpillCardCheckout(user);
    await recoverEmailWallet(user);
    expect(screen.queryByRole("button", { name: "Finish vault deposit" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Open secure card checkout" }));

    await waitFor(() => expect(thirdwebMocks.onrampStatus).toHaveBeenCalledTimes(1));
    expect(thirdwebMocks.sendBatchTransaction).not.toHaveBeenCalled();
    expect(screen.getByText("Fallback ready")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Finish vault deposit" }));

    await waitFor(() => expect(thirdwebMocks.sendAndConfirmTransaction).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText("Receipt recorded for your vault contribution.")
    ).toBeInTheDocument();
  });

  it("locks the sheet while the combined Card Endow runs, then finishes after it resolves", async () => {
    const user = userEvent.setup();
    stubMatchMedia(390);
    let resolveBatch: ((value: { transactionHash: `0x${string}` }) => void) | undefined;
    // Hold the batch open to observe the in-flight lock after card funding completes.
    thirdwebMocks.sendBatchTransaction.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveBatch = resolve;
        })
    );

    renderView();

    await openGreenpillCardCheckout(user);
    await recoverEmailWallet(user);
    await openSecureCardCheckout(user);

    await waitFor(() => expect(thirdwebMocks.sendBatchTransaction).toHaveBeenCalledTimes(1));

    // Structural lock: amount/method are collapsed to a read-only summary, the
    // back/edit path is gone, and the sheet cannot be closed mid-transaction.
    expect(screen.queryByLabelText("Amount to endow")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vault-checkout-method-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vault-checkout-method-wallet")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.queryByTestId("vault-checkout-sheet-drag-handle")).not.toBeInTheDocument()
    );

    // Pending feedback, and the summary still shows the locked amount.
    expect(screen.getByText("Depositing into the vault")).toBeInTheDocument();
    expect(screen.getByText("$30.00")).toBeInTheDocument();
    expect(screen.getByText("Settles into the Octant vault as 0.01 WETH")).toBeInTheDocument();

    // Resolving the batch confirms shares and finishes the flow.
    resolveBatch?.({
      transactionHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    await waitFor(() => expect(thirdwebMocks.sendAndConfirmTransaction).not.toHaveBeenCalled());
    expect(
      await screen.findByText(
        "Endowment complete. Your verified email wallet now holds the vault position for this campaign."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("resets OTP and recovered wallet state when the payer email changes", async () => {
    const user = userEvent.setup();

    renderView();

    await openGreenpillCardCheckout(user);
    await user.type(screen.getByLabelText("Email"), "qa@example.org");
    await user.click(screen.getByRole("button", { name: "Send email code" }));

    expect(thirdwebMocks.preAuthenticate).toHaveBeenCalledWith({
      client: { clientId: "test-thirdweb-client" },
      strategy: "email",
      email: "qa@example.org",
    });

    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "ops@example.org");

    // Changing the email withdraws the sent code: the code field disappears
    // entirely instead of lingering as a locked input.
    expect(screen.queryByLabelText("Email code")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Verify email" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send email code" })).toBeInTheDocument();
    expect(screen.queryByTestId("vault-card-payment-panel")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send email code" }));
    expect(thirdwebMocks.preAuthenticate).toHaveBeenLastCalledWith({
      client: { clientId: "test-thirdweb-client" },
      strategy: "email",
      email: "ops@example.org",
    });
  });

  it("does not let an existing active wallet bypass email-wallet recovery for Card Endow", async () => {
    const user = userEvent.setup();
    thirdwebMocks.activeAccount = { address: "0x5555555555555555555555555555555555555555" };

    renderView();

    await user.click(screen.getByRole("button", { name: "Endow to Greenpill NYC" }));
    await user.click(screen.getByTestId("vault-checkout-method-card"));
    await user.type(screen.getByLabelText("Amount to endow"), "30");
    await user.click(screen.getByRole("button", { name: "Continue to Card" }));
    await screen.findByTestId("vault-card-endow-flow");

    expect(screen.queryByTestId("vault-card-payment-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("thirdweb-buy-widget")).not.toBeInTheDocument();
    expect(
      screen.queryByText("0x5555555555555555555555555555555555555555")
    ).not.toBeInTheDocument();
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

    await openGreenpillCardCheckout(user);
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

    // Success is a terminal screen — the confirm action is replaced by Done.
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
      // and no Retry is offered — so an in-flight deposit can never be double-submitted.
      act(() => {
        vi.advanceTimersByTime(30_000);
      });

      expect(screen.getByText(/Taking longer than expected/)).toBeInTheDocument();
      // The slow state no longer points to the Fund page — vault positions are
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

  it("shows the on-chain vault total on the campaign card", () => {
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
    expect(within(strip).getByText("Just launched — be the first to endow")).toBeInTheDocument();
  });
});
