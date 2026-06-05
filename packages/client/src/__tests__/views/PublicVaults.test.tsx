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

import type { OctantVaultCampaignManifest } from "@green-goods/shared";
import VaultsPage, { CampaignCard, VaultsPageContent } from "../../views/Public/Vaults";

const sharedHookMocks = vi.hoisted(() => ({
  loginWithWallet: vi.fn(),
  octantVaultWalletEndowMutate: vi.fn(),
  octantVaultWalletEndowReset: vi.fn(),
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
}));

const thirdwebMocks = vi.hoisted(() => {
  const receiverAddress = "0x4444444444444444444444444444444444444444";

  return {
    receiverAddress,
    activeAccount: undefined as { address: string } | undefined,
    activeWallet: { id: "inApp" },
    buyWidgetProps: [] as unknown[],
    createThirdwebClient: vi.fn((options: { clientId: string }) => ({
      clientId: options.clientId,
    })),
    getContract: vi.fn((options: unknown) => options),
    inAppWallet: vi.fn(() => ({
      connect: vi.fn(async () => ({ address: receiverAddress })),
    })),
    preAuthenticate: vi.fn(async () => undefined),
    prepareContractCall: vi.fn((options: unknown) => ({ kind: "prepared", options })),
    readContract: vi.fn(async () => 12n),
    sendAndConfirmTransaction: vi.fn(async () => ({
      transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    })),
    useConnectConnect: vi.fn(async (walletOrFn: unknown) => {
      if (typeof walletOrFn === "function") {
        return await (walletOrFn as () => Promise<unknown>)();
      }
      return walletOrFn;
    }),
  };
});

const fetchMock = vi.hoisted(() => vi.fn());

vi.stubGlobal("fetch", fetchMock);

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
      error: null,
      isPending: false,
    }),
    useEthUsdPrice: () => ({
      hasFeed: sharedHookMocks.ethUsdHasFeed,
      priceAnswer: sharedHookMocks.ethUsdPriceAnswer,
      isLoading: false,
      isError: false,
      isStale: false,
      updatedAt: 1770000000n,
    }),
    useOctantVaultStats: () => sharedHookMocks.octantVaultStats,
  };
});

vi.mock("thirdweb", () => ({
  createThirdwebClient: thirdwebMocks.createThirdwebClient,
  getContract: thirdwebMocks.getContract,
  prepareContractCall: thirdwebMocks.prepareContractCall,
  readContract: thirdwebMocks.readContract,
}));

vi.mock("thirdweb/chains", () => ({
  defineChain: (chainId: number) => ({ id: chainId, name: `Chain ${chainId}` }),
  ethereum: { id: 1, name: "Ethereum" },
}));

vi.mock("thirdweb/react", async () => {
  const { createElement } = await import("react");

  return {
    BuyWidget: (props: {
      onSuccess?: (data: { quote: { type: "buy" }; statuses: unknown[] }) => void;
    }) => {
      thirdwebMocks.buyWidgetProps.push(props);
      return createElement(
        "button",
        {
          type: "button",
          "data-testid": "thirdweb-buy-widget",
          onClick: () => props.onSuccess?.({ quote: { type: "buy" }, statuses: [] }),
        },
        "Thirdweb card funding widget"
      );
    },
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
  await screen.findByTestId("vault-card-endow-review");
}

async function confirmTupleAndFundCard(user: ReturnType<typeof userEvent.setup>) {
  expect(screen.queryByTestId("thirdweb-buy-widget")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Continue to card payment" }));
  await user.click(screen.getByTestId("thirdweb-buy-widget"));
  await screen.findByText(
    "Card funding is complete. Next, approve the vault transfer for this endowment."
  );
}

describe("VaultsPage", () => {
  beforeEach(() => {
    sharedHookMocks.loginWithWallet.mockClear();
    sharedHookMocks.octantVaultWalletEndowMutate.mockClear();
    sharedHookMocks.octantVaultWalletEndowReset.mockClear();
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
    stubMatchMedia();
    thirdwebMocks.activeAccount = undefined;
    thirdwebMocks.buyWidgetProps = [];
    thirdwebMocks.createThirdwebClient.mockClear();
    thirdwebMocks.getContract.mockClear();
    thirdwebMocks.inAppWallet.mockClear();
    thirdwebMocks.preAuthenticate.mockClear();
    thirdwebMocks.prepareContractCall.mockClear();
    thirdwebMocks.readContract.mockClear();
    thirdwebMocks.sendAndConfirmTransaction.mockClear();
    thirdwebMocks.useConnectConnect.mockClear();
    vi.stubGlobal("fetch", fetchMock);
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
    expect(screen.getByText("No wallet connection needed to browse.")).toBeInTheDocument();
    expect(sharedHookMocks.walletRuntimeProviderRender).not.toHaveBeenCalled();
    expect(screen.queryByTestId("wallet-runtime-provider")).not.toBeInTheDocument();
  });

  it("scrubs the deprecated Card Endow QA query param while preserving valid route params", async () => {
    const locations: string[] = [];

    renderViewWithLocationProbe("/vaults?cardEndowQa=1&manage=positions", (location) => {
      locations.push(location);
    });

    await waitFor(() => expect(locations.at(-1)).toBe("/vaults?manage=positions"));
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
    const review = await screen.findByTestId("vault-card-endow-review");
    expect(review).toHaveTextContent("EVMavericks Fantasy Football League");
    expect(review).toHaveTextContent("Ethereum chain 1");
    expect(review).toHaveTextContent("0x0bCe8c16974FFD3B410A32365c5bCf27a5A630Fc");
    expect(review).toHaveTextContent("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    expect(screen.queryByTestId("thirdweb-buy-widget")).not.toBeInTheDocument();
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

  it("runs the Card Endow checkout from one setup screen and records proof", async () => {
    const user = userEvent.setup();

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
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    expect(screen.getByText("Verify email wallet")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("qa@example.org")).not.toBeInTheDocument();
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
    expect(screen.getByText("qa@example.org")).toBeInTheDocument();

    const review = await screen.findByTestId("vault-card-endow-review");
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
    expect(screen.getByText("Review card route")).toBeInTheDocument();
    expect(review).toHaveTextContent("Greenpill NYC");
    expect(review).toHaveTextContent("ETH contribution");
    expect(review).toHaveTextContent("0.01 ETH");
    expect(review).toHaveTextContent("Receiver");
    expect(review).toHaveTextContent("Verified email wallet");
    expect(review).toHaveTextContent("Route");
    expect(review).toHaveTextContent("Card -> email wallet -> Octant vault");
    expect(review).toHaveTextContent("Technical WETH details");
    expect(review).toHaveTextContent("Ethereum chain 1");
    expect(review).toHaveTextContent("0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5");
    expect(review).toHaveTextContent("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    expect(review).toHaveTextContent("Checkout wallet");
    expect(screen.queryByText("Provider route")).not.toBeInTheDocument();
    expect(screen.queryByText(/base units/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/exact campaign/i)).not.toBeInTheDocument();
    expect(screen.getByText("No card payment starts until you continue.")).toBeInTheDocument();
    expect(screen.queryByTestId("thirdweb-buy-widget")).not.toBeInTheDocument();

    // The confirm checkbox is gone — the explicit button is the confirmation.
    expect(
      screen.queryByLabelText(
        "I confirm the campaign, receiver, token, and amount are correct before live card payment."
      )
    ).not.toBeInTheDocument();
    const confirmAndContinue = screen.getByRole("button", { name: "Continue to card payment" });
    expect(confirmAndContinue).toBeEnabled();
    await user.click(confirmAndContinue);
    expect(screen.getByTestId("thirdweb-buy-widget")).toBeInTheDocument();
    await user.click(screen.getByTestId("thirdweb-buy-widget"));

    // Card funding lands on the single combined complete step (approve + deposit).
    expect(screen.getByText("Step 4 of 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Complete endowment" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Card funding is complete. Next, approve the vault transfer for this endowment."
      )
    ).toBeInTheDocument();

    // One click runs approve -> deposit in order (two on-chain transactions).
    await user.click(screen.getByRole("button", { name: "Complete endowment" }));
    await waitFor(() => expect(thirdwebMocks.sendAndConfirmTransaction).toHaveBeenCalledTimes(2));
    await expect(
      thirdwebMocks.sendAndConfirmTransaction.mock.results[1]?.value
    ).resolves.toMatchObject({
      transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(thirdwebMocks.prepareContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "function approve(address spender, uint256 value)",
      })
    );
    expect(thirdwebMocks.prepareContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "function deposit(uint256 assets, address receiver) returns (uint256)",
      })
    );
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

  it("locks the sheet while the combined Card Endow runs, then finishes after it resolves", async () => {
    const user = userEvent.setup();
    stubMatchMedia(390);
    let resolveApproval: ((value: { transactionHash: `0x${string}` }) => void) | undefined;
    // Hold the first on-chain call (approve) open to observe the in-flight lock.
    thirdwebMocks.sendAndConfirmTransaction.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveApproval = resolve;
        })
    );

    renderView();

    await openGreenpillCardCheckout(user);
    await recoverEmailWallet(user);
    await confirmTupleAndFundCard(user);

    // One combined action runs approve -> deposit.
    await user.click(screen.getByRole("button", { name: "Complete endowment" }));

    // Structural lock: amount/method are collapsed to a read-only summary, the
    // back/edit path is gone, and the sheet cannot be closed mid-transaction.
    expect(screen.queryByLabelText("Amount to endow")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vault-checkout-method-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vault-checkout-method-wallet")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("vault-checkout-sheet-drag-handle")).not.toBeInTheDocument();

    // Pending feedback, and the summary still shows the locked amount.
    expect(screen.getByRole("button", { name: "Approving..." })).toBeDisabled();
    expect(screen.getByText("$30.00")).toBeInTheDocument();
    expect(screen.getByText("Settles into the Octant vault as 0.01 WETH")).toBeInTheDocument();

    // Resolving the approval lets the deposit run automatically and finish the flow.
    resolveApproval?.({
      transactionHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    await waitFor(() => expect(thirdwebMocks.sendAndConfirmTransaction).toHaveBeenCalledTimes(2));
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

    expect(screen.getByLabelText("Email code")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Verify email" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send email code" })).toBeInTheDocument();
    expect(screen.queryByTestId("vault-card-endow-review")).not.toBeInTheDocument();

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

    expect(screen.queryByTestId("vault-card-endow-review")).not.toBeInTheDocument();
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
      expect(screen.getByRole("link", { name: "View on Fund page" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
      expect(sharedHookMocks.octantVaultWalletEndowMutate).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
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
