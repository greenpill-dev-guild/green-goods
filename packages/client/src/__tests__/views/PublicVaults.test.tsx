/**
 * Public vault crowdfunding route tests.
 *
 * @vitest-environment jsdom
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
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
    sendAndConfirmTransaction: vi.fn(async () => ({ transactionHash: "0xreceipt" })),
    useConnectConnect: vi.fn(async (walletOrFn: unknown) => {
      if (typeof walletOrFn === "function") {
        return await (walletOrFn as () => Promise<unknown>)();
      }
      return walletOrFn;
    }),
  };
});

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
      createElement(IntlProvider, { locale: "en", messages: {} }, createElement(VaultsPage))
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
        { locale: "en", messages: {} },
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
        { locale: "en", messages: {} },
        createElement(CampaignCard, { campaign })
      )
    )
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
    vi.stubEnv("VITE_THIRDWEB_CLIENT_ID", "test-thirdweb-client");
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

  it("shows blocked transaction controls for incomplete manifest fixtures", () => {
    renderView();

    const nycCard = screen.getByTestId("vault-campaign-card-greenpill-nyc");
    const evmavericksCard = screen.getByTestId("vault-campaign-card-evmavericks");

    expect(
      within(nycCard).getByRole("button", { name: "Wallet Endow unavailable for Greenpill NYC" })
    ).toBeDisabled();
    expect(
      within(evmavericksCard).getByRole("button", {
        name: "Wallet Endow unavailable for EVMavericks Fantasy Football League",
      })
    ).toBeDisabled();
    expect(
      within(
        within(evmavericksCard).getByRole("list", { name: "Missing manifest fields" })
      ).getByText("Protocol Guild destination context")
    ).toBeInTheDocument();
  });

  it("keeps Donate, Card Donate, and hidden Card Endow labels out of the vault campaign route", () => {
    renderView();

    expect(screen.queryByText("Donate")).not.toBeInTheDocument();
    expect(screen.queryByText("Card Donate")).not.toBeInTheDocument();
    expect(screen.queryByText(/Card Endow/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pay by card/i })).not.toBeInTheDocument();
    expect(
      screen.getAllByText("Card funding stays hidden until the manifest and proof gates pass.")
    ).toHaveLength(2);
  });

  it("enables amount selection for complete manifests without exposing Card Endow early", () => {
    renderCard(makeCompleteCampaign());

    expect(screen.getByText("Manifest complete")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Choose amount for Synthetic complete campaign",
      })
    ).toBeEnabled();
    expect(
      screen.getByText(
        "This campaign is ready for the amount-first Wallet Endow confirmation flow."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Card funding stays hidden until custody, share, manage, and provider proof passes."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Card Endow/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /card endow/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Connect Wallet" })).not.toBeInTheDocument();
  });

  it("exposes the Card Endow human-QA flow only on the QA-gated route", async () => {
    const user = userEvent.setup();

    renderView("/vaults?cardEndowQa=1");

    expect(
      screen.getByRole("heading", { name: "Greenpill NYC Card Endow QA" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pay by card for Greenpill NYC Card Endow QA" })
    ).toBeEnabled();

    await user.click(
      screen.getByRole("button", { name: "Pay by card for Greenpill NYC Card Endow QA" })
    );
    expect(await screen.findByTestId("vault-card-endow-panel")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Amount"), "0.01");
    await user.type(screen.getByLabelText("Email"), "qa@example.org");
    await user.click(screen.getByRole("button", { name: "Send email code" }));

    expect(thirdwebMocks.preAuthenticate).toHaveBeenCalledWith({
      client: { clientId: "test-thirdweb-client" },
      strategy: "email",
      email: "qa@example.org",
    });

    await user.type(screen.getByLabelText("Thirdweb code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify email wallet" }));

    expect(thirdwebMocks.useConnectConnect).toHaveBeenCalledTimes(1);

    const tuple = await screen.findByTestId("vault-card-endow-tuple");
    expect(tuple).toHaveTextContent("Greenpill NYC Card Endow QA");
    expect(tuple).toHaveTextContent(thirdwebMocks.receiverAddress);
    expect(tuple).toHaveTextContent("Ethereum chain 1");
    expect(tuple).toHaveTextContent("0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5");
    expect(tuple).toHaveTextContent("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    expect(tuple).toHaveTextContent("10000000000000000 base units");
    expect(tuple).toHaveTextContent("Provider route");
    expect(tuple).toHaveTextContent("Thirdweb card funds the recovered email wallet first.");
    expect(
      screen.getByText(
        "Live card payment stays locked until the exact tuple confirmation is checked."
      )
    ).toBeInTheDocument();
    expect(screen.queryByTestId("thirdweb-buy-widget")).not.toBeInTheDocument();

    await user.click(
      screen.getByLabelText(
        "I confirm this exact campaign, chain, vault, token, amount, receiver, and provider route before live card payment."
      )
    );

    expect(screen.getByTestId("thirdweb-buy-widget")).toBeInTheDocument();
    await user.click(screen.getByTestId("thirdweb-buy-widget"));
    expect(
      screen.getByText(
        "Thirdweb reported card funding success for the recovered wallet. The user can now approve the vault allowance."
      )
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approve token -> vault" }));
    expect(thirdwebMocks.prepareContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "function approve(address spender, uint256 value)",
      })
    );

    await user.click(screen.getByRole("button", { name: "Deposit to receiver" }));
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
        "Verified positive vault.balanceOf(receiver): 12 shares are visible for the recovered wallet."
      )
    ).toBeInTheDocument();
  });

  it("does not let an existing active wallet bypass email-wallet recovery for Card Endow QA", async () => {
    const user = userEvent.setup();
    thirdwebMocks.activeAccount = { address: "0x5555555555555555555555555555555555555555" };

    renderView("/vaults?cardEndowQa=1");

    await user.click(
      screen.getByRole("button", { name: "Pay by card for Greenpill NYC Card Endow QA" })
    );
    await user.type(screen.getByLabelText("Amount"), "0.01");

    expect(screen.queryByTestId("vault-card-endow-tuple")).not.toBeInTheDocument();
    expect(screen.queryByTestId("thirdweb-buy-widget")).not.toBeInTheDocument();
    expect(
      screen.queryByText("0x5555555555555555555555555555555555555555")
    ).not.toBeInTheDocument();
  });

  it("keeps wallet connection at final confirmation after the user chooses an amount", async () => {
    const user = userEvent.setup();

    renderContent([makeCompleteCampaign()]);

    expect(screen.queryByRole("button", { name: "Connect Wallet" })).not.toBeInTheDocument();
    expect(sharedHookMocks.walletRuntimeProviderRender).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Choose amount for Synthetic complete campaign" })
    );

    expect(screen.getByRole("heading", { name: "Prepare Wallet Endow" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Connect Wallet" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("wallet-runtime-provider")).not.toBeInTheDocument();
    expect(sharedHookMocks.walletRuntimeProviderRender).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Amount"), "2.5");
    expect(screen.queryByTestId("wallet-runtime-provider")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue to wallet" }));

    expect(screen.getByTestId("wallet-runtime-provider")).toBeInTheDocument();
    expect(sharedHookMocks.walletRuntimeProviderRender).toHaveBeenCalledTimes(1);
    expect(screen.getByText("2.5 USDC")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Connect Wallet" }));

    expect(sharedHookMocks.loginWithWallet).toHaveBeenCalledTimes(1);
    expect(sharedHookMocks.octantVaultWalletEndowMutate).not.toHaveBeenCalled();
  });

  it("does not treat restored passkey auth as Wallet Endow readiness", async () => {
    const user = userEvent.setup();
    sharedHookMocks.authMode = "passkey";
    sharedHookMocks.primaryAddress = VALID_RECEIVER_ADDRESS;

    renderContent([makeCompleteCampaign()]);

    await user.click(
      screen.getByRole("button", { name: "Choose amount for Synthetic complete campaign" })
    );
    await user.type(screen.getByLabelText("Amount"), "2.5");
    await user.click(screen.getByRole("button", { name: "Continue to wallet" }));
    await user.click(screen.getByRole("button", { name: "Connect Wallet" }));

    expect(sharedHookMocks.loginWithWallet).toHaveBeenCalledTimes(1);
    expect(sharedHookMocks.octantVaultWalletEndowMutate).not.toHaveBeenCalled();
  });

  it("submits Wallet Endow only after a complete manifest, amount, and connected wallet", async () => {
    const user = userEvent.setup();
    sharedHookMocks.authMode = "wallet";
    sharedHookMocks.primaryAddress = VALID_RECEIVER_ADDRESS;

    renderContent([makeCompleteCampaign()]);

    await user.click(
      screen.getByRole("button", { name: "Choose amount for Synthetic complete campaign" })
    );
    await user.type(screen.getByLabelText("Amount"), "2.5");
    await user.click(screen.getByRole("button", { name: "Continue to wallet" }));
    await user.click(screen.getByRole("button", { name: "Confirm Wallet Endow" }));

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
});
