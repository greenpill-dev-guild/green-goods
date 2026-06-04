/**
 * Public vault crowdfunding route tests.
 *
 * @vitest-environment jsdom
 */

import { render, screen, waitFor, within } from "@testing-library/react";
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

async function openGreenpillCardCheckout(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Endow to Greenpill NYC" }));
  await user.type(screen.getByLabelText("Amount"), "0.01");
  expect(screen.queryByTestId("vault-checkout-method-card")).not.toBeInTheDocument();
  expect(screen.queryByTestId("vault-checkout-method-wallet")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByTestId("vault-checkout-method-card"));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByTestId("vault-card-endow-flow");
}

async function recoverEmailWallet(
  user: ReturnType<typeof userEvent.setup>,
  email = "qa@example.org"
) {
  await user.type(screen.getByLabelText("Email"), email);
  await user.click(screen.getByRole("button", { name: "Send email code" }));
  await user.type(screen.getByLabelText("Thirdweb code"), "123456");
  await user.click(screen.getByRole("button", { name: "Verify email wallet" }));
  await screen.findByTestId("vault-card-endow-tuple");
}

async function confirmTupleAndFundCard(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByLabelText(
      "I confirm this exact campaign, chain, vault, token, amount, receiver, and provider route before live card payment."
    )
  );
  expect(screen.queryByTestId("thirdweb-buy-widget")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Confirm and continue" }));
  await user.click(screen.getByTestId("thirdweb-buy-widget"));
  await screen.findByText(
    "Thirdweb reported card funding success for the recovered wallet. The user can now approve the vault allowance."
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

  it("shows one Endow CTA on Greenpill NYC and a blocked explanation for incomplete fixtures", () => {
    renderView();

    const nycCard = screen.getByTestId("vault-campaign-card-greenpill-nyc");
    const evmavericksCard = screen.getByTestId("vault-campaign-card-evmavericks");

    // Greenpill NYC collapses both payment paths into a single Endow CTA.
    expect(within(nycCard).getByRole("button", { name: "Endow to Greenpill NYC" })).toBeEnabled();
    expect(
      within(nycCard).queryByRole("button", { name: /choose amount/i })
    ).not.toBeInTheDocument();
    expect(within(nycCard).queryByRole("button", { name: /pay by card/i })).not.toBeInTheDocument();

    // EVMavericks stays blocked with a human explanation and no payment affordance.
    expect(within(evmavericksCard).queryByRole("button")).not.toBeInTheDocument();
    expect(within(evmavericksCard).getByText("Blocked pending manifest")).toBeInTheDocument();
    expect(
      within(
        within(evmavericksCard).getByRole("list", { name: "Missing manifest fields" })
      ).getByText("Protocol Guild destination context")
    ).toBeInTheDocument();
  });

  it("keeps Donate and Card Donate labels out of the vault campaign route", () => {
    renderView();

    expect(screen.queryByText("Donate")).not.toBeInTheDocument();
    expect(screen.queryByText("Card Donate")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Endow to Greenpill NYC" })).toBeEnabled();
  });

  it("renders one Endow CTA for a complete manifest card", () => {
    renderCard(makeCompleteCampaign());

    expect(screen.getByText("Manifest complete")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Endow to Synthetic complete campaign" })
    ).toBeEnabled();
    // No early payment-method or Card Endow exposure on the card itself.
    expect(screen.queryByText(/Card Endow/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("vault-checkout-method-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vault-checkout-method-wallet")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Connect Wallet" })).not.toBeInTheDocument();
  });

  it("offers a complete non-production campaign Wallet checkout only — never Card", async () => {
    const user = userEvent.setup();

    renderContent([makeCompleteCampaign()]);

    await user.click(screen.getByRole("button", { name: "Endow to Synthetic complete campaign" }));

    // Amount-first: no payment method appears before a valid amount.
    expect(screen.queryByTestId("vault-checkout-method-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vault-checkout-method-wallet")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Amount"), "2.5");
    expect(screen.queryByTestId("vault-checkout-method-wallet")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // Card stays gated to the production campaign; this fixture exposes Wallet only.
    expect(screen.getByTestId("vault-checkout-method-wallet")).toBeInTheDocument();
    expect(screen.queryByTestId("vault-checkout-method-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vault-card-endow-flow")).not.toBeInTheDocument();
    expect(screen.queryByTestId("thirdweb-buy-widget")).not.toBeInTheDocument();
  });

  it("runs the Card Endow checkout amount-first and records proof", async () => {
    const user = userEvent.setup();

    renderView();

    expect(screen.getByRole("heading", { name: "Greenpill NYC" })).toBeInTheDocument();

    // One Endow CTA opens the checkout; amount is entered before any method choice.
    await user.click(screen.getByRole("button", { name: "Endow to Greenpill NYC" }));
    expect(screen.queryByTestId("vault-checkout-method-card")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Amount"), "0.01");
    expect(screen.queryByTestId("vault-checkout-method-card")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByTestId("vault-checkout-method-card"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByTestId("vault-card-endow-flow")).toBeInTheDocument();

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
    expect(tuple).toHaveTextContent("Greenpill NYC");
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

    const confirmAndContinue = screen.getByRole("button", { name: "Confirm and continue" });
    expect(confirmAndContinue).toBeDisabled();
    await user.click(
      screen.getByLabelText(
        "I confirm this exact campaign, chain, vault, token, amount, receiver, and provider route before live card payment."
      )
    );

    expect(screen.queryByTestId("thirdweb-buy-widget")).not.toBeInTheDocument();
    expect(confirmAndContinue).toBeEnabled();
    await user.click(confirmAndContinue);
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
    await waitFor(() => expect(thirdwebMocks.sendAndConfirmTransaction).toHaveBeenCalledTimes(2));
    await expect(
      thirdwebMocks.sendAndConfirmTransaction.mock.results[1]?.value
    ).resolves.toMatchObject({
      transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
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
      await screen.findByText("Funding proof recorded for the recovered wallet receipt.")
    ).toBeInTheDocument();
  });

  it("locks amount and method while Card Endow approval is pending", async () => {
    const user = userEvent.setup();
    let resolveApproval: ((value: { transactionHash: `0x${string}` }) => void) | undefined;
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

    await user.click(screen.getByRole("button", { name: "Approve token -> vault" }));

    // Structural lock: amount/method are collapsed to a read-only summary, the
    // back/edit path is gone, and the sheet cannot be closed mid-transaction.
    expect(screen.queryByLabelText("Amount")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vault-checkout-method-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vault-checkout-method-wallet")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();

    // Pending feedback, and the summary still shows the locked amount.
    expect(screen.getByRole("button", { name: "Approving..." })).toBeDisabled();
    expect(screen.getByText("0.01 WETH")).toBeInTheDocument();

    resolveApproval?.({
      transactionHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Deposit to receiver" })).toBeEnabled()
    );
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

    expect(screen.getByLabelText("Thirdweb code")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Verify email wallet" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send email code" })).toBeInTheDocument();
    expect(screen.queryByTestId("vault-card-endow-tuple")).not.toBeInTheDocument();

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
    await user.type(screen.getByLabelText("Amount"), "0.01");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByTestId("vault-checkout-method-card"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByTestId("vault-card-endow-flow");

    expect(screen.queryByTestId("vault-card-endow-tuple")).not.toBeInTheDocument();
    expect(screen.queryByTestId("thirdweb-buy-widget")).not.toBeInTheDocument();
    expect(
      screen.queryByText("0x5555555555555555555555555555555555555555")
    ).not.toBeInTheDocument();
  });

  it("keeps wallet connection at the method-pick step after the user chooses an amount", async () => {
    const user = userEvent.setup();

    renderContent([makeCompleteCampaign()]);

    expect(screen.queryByRole("button", { name: "Connect Wallet" })).not.toBeInTheDocument();
    expect(sharedHookMocks.walletRuntimeProviderRender).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Endow to Synthetic complete campaign" }));

    // The wallet runtime must not mount before a valid amount or a method choice.
    expect(screen.queryByTestId("wallet-runtime-provider")).not.toBeInTheDocument();
    expect(sharedHookMocks.walletRuntimeProviderRender).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Amount"), "2.5");
    expect(screen.queryByTestId("vault-checkout-method-wallet")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wallet-runtime-provider")).not.toBeInTheDocument();
    expect(sharedHookMocks.walletRuntimeProviderRender).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByTestId("vault-checkout-method-wallet"));

    // The wallet runtime must not mount on method pick — only after Continue.
    expect(screen.queryByTestId("wallet-runtime-provider")).not.toBeInTheDocument();
    expect(sharedHookMocks.walletRuntimeProviderRender).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByTestId("wallet-runtime-provider")).toBeInTheDocument();
    expect(sharedHookMocks.walletRuntimeProviderRender).toHaveBeenCalled();
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

    await user.click(screen.getByRole("button", { name: "Endow to Synthetic complete campaign" }));
    await user.type(screen.getByLabelText("Amount"), "2.5");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByTestId("vault-checkout-method-wallet"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Connect Wallet" }));

    expect(sharedHookMocks.loginWithWallet).toHaveBeenCalledTimes(1);
    expect(sharedHookMocks.octantVaultWalletEndowMutate).not.toHaveBeenCalled();
  });

  it("submits Wallet Endow only after a complete manifest, amount, and connected wallet", async () => {
    const user = userEvent.setup();
    sharedHookMocks.authMode = "wallet";
    sharedHookMocks.primaryAddress = VALID_RECEIVER_ADDRESS;

    renderContent([makeCompleteCampaign()]);

    await user.click(screen.getByRole("button", { name: "Endow to Synthetic complete campaign" }));
    await user.type(screen.getByLabelText("Amount"), "2.5");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByTestId("vault-checkout-method-wallet"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
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
