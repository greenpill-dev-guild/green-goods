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

function renderView() {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/vaults"] },
      createElement(IntlProvider, { locale: "en", messages: {} }, createElement(VaultsPage))
    )
  );
}

function renderContent(campaigns: OctantVaultCampaignManifest[]) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/vaults"] },
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
