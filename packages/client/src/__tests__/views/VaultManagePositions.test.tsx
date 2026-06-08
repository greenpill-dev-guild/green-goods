/**
 * Route-local vault position management (`/vaults?manage=positions`) tests.
 *
 * @vitest-environment jsdom
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
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
  loginWithWallet: vi.fn(),
  walletRuntimeRender: vi.fn(),
  positionsByOwner: {} as Record<string, ReturnType<typeof emptyPositions> | undefined>,
  withdrawMutateAsync: vi.fn(async () => "0xhash"),
  withdrawReset: vi.fn(),
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
  // Thirdweb card session: by default a live session for CARD (no re-verify).
  activeAccount: { address: CARD } as { address: string } | undefined,
  autoConnectLoading: false,
  // Records useAutoConnect invocations so a test can prove the no-re-verify
  // rehydration mechanism is actually wired (with the email wallet), not bypassed.
  autoConnectSpy: vi.fn(),
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
    shares: 1_000_000_000_000_000_000n,
    positionValue: 1_200_000_000_000_000_000n,
    withdrawable: 1_000_000_000_000_000_000n,
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
    useOctantVaultPositions: (owner?: string | null) =>
      owner ? (mocks.positionsByOwner[owner.toLowerCase()] ?? emptyPositions()) : emptyPositions(),
    useOctantVaultWithdraw: () => ({
      mutateAsync: mocks.withdrawMutateAsync,
      mutate: vi.fn(),
      reset: mocks.withdrawReset,
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
  };
});

/** Wallet-only stablecoin campaign — avoids the ETH price feed and the card path. */
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
      fundingPurpose: "Support public-goods work through a dedicated vault.",
      recipientLogic: "Yield routes through the supplied recipient configuration.",
      riskNote: "Vault deposits depend on the underlying token and Octant vault strategy.",
    },
    vault: {
      chainId: 1,
      vaultAddress: "0x1111111111111111111111111111111111111111",
      asset: { address: "0x2222222222222222222222222222222222222222", symbol: "USDC", decimals: 6 },
      explorerLink: "https://etherscan.io/address/0x1111111111111111111111111111111111111111",
    },
    recipientRoutingSummary: "Yield routes to a verified public-goods recipient.",
    protocolGuildDestinationContext: "Protocol Guild allocation context is recorded.",
  };
}

// Thirdweb is only pulled in by the lazy card-management chunk; mock it so jsdom
// can render the card section without the real SDK.
vi.mock("thirdweb", () => ({
  createThirdwebClient: (o: { clientId: string }) => ({ clientId: o.clientId }),
  getContract: (o: unknown) => o,
  prepareContractCall: (o: unknown) => o,
  readContract: vi.fn(async () => 1_000_000_000_000_000_000n),
}));
vi.mock("thirdweb/chains", () => ({
  defineChain: (id: number) => ({ id }),
  ethereum: { id: 1 },
}));
vi.mock("thirdweb/react", async () => {
  const { createElement: ce } = await import("react");
  return {
    ThirdwebProvider: ({ children }: { children: unknown }) =>
      ce("div", { "data-testid": "thirdweb-provider" }, children),
    useActiveAccount: () => mocks.activeAccount,
    useAutoConnect: (options: unknown) => {
      mocks.autoConnectSpy(options);
      return { isLoading: mocks.autoConnectLoading, data: true };
    },
    useConnect: () => ({ connect: vi.fn(), isConnecting: false, error: null }),
    useSendAndConfirmTransaction: () => ({
      mutateAsync: vi.fn(async () => ({})),
      isPending: false,
    }),
  };
});
vi.mock("thirdweb/wallets/in-app", () => ({
  inAppWallet: () => ({ connect: vi.fn(async () => ({ address: CARD })) }),
  preAuthenticate: vi.fn(async () => undefined),
}));

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
  vi.stubEnv("VITE_THIRDWEB_CLIENT_ID", "test-thirdweb-client");
  vi.stubEnv("VITE_API_BASE_URL", "https://agent.test");
  mocks.authMode = null;
  mocks.primaryAddress = undefined;
  mocks.positionsByOwner = {};
  mocks.wrapEthToWethMutate.mockClear();
  mocks.wrapEthToWethReset.mockClear();
  mocks.walletBalancesRefetch.mockClear();
  mocks.activeAccount = { address: CARD };
  mocks.autoConnectLoading = false;
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
  it("renders without a wallet runtime and shows a Manage positions entry point", () => {
    renderPage("/vaults");
    // Browse must render with no wallet runtime mounted.
    expect(mocks.walletRuntimeRender).not.toHaveBeenCalled();
    expect(screen.queryByTestId("vault-manage-positions-panel")).toBeNull();
    expect(screen.getByTestId("vault-manage-positions-entry")).toBeInTheDocument();
  });
});

describe("/vaults?manage=positions", () => {
  it("opens the management panel directly from the query param", () => {
    mocks.authMode = "wallet";
    mocks.primaryAddress = CONNECTED;
    renderPage("/vaults?manage=positions");
    expect(screen.getByTestId("vault-manage-positions-panel")).toBeInTheDocument();
    expect(mocks.walletRuntimeRender).toHaveBeenCalled();
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
    expect(within(panel).getByText("WETH-backed vault position")).toBeInTheDocument();
    // Position value label is present (precise WETH wording, not Fund language).
    expect(within(panel).getByText(/Position value in WETH/)).toBeInTheDocument();
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
    renderPage("/vaults?manage=positions");

    const panel = screen.getByTestId("vault-manage-positions-panel");
    expect(within(panel).getByText("No vault positions for this wallet yet")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Endow a campaign" })).toBeInTheDocument();
  });

  it("gates withdraw: disabled over the withdrawable max, enabled and signs for a valid amount", async () => {
    const user = userEvent.setup();
    mocks.authMode = "wallet";
    mocks.primaryAddress = CONNECTED;
    mocks.positionsByOwner[CONNECTED.toLowerCase()] = {
      ...emptyPositions(),
      positions: [makePosition({ withdrawable: 1_000_000_000_000_000_000n })], // 1 WETH
      hasPositions: true,
    };
    renderPage("/vaults?manage=positions");

    const row = screen.getByTestId("vault-manage-position-greenpill-nyc");
    await user.click(within(row).getByRole("button", { name: "Withdraw" }));

    const amount = within(row).getByLabelText("Withdrawal amount");
    // Over the max → review stays disabled and an error shows.
    await user.type(amount, "2");
    expect(within(row).getByText(/higher than the withdrawable amount/i)).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Review withdrawal" })).toBeDisabled();

    // Valid amount → review enabled; confirm calls the chain-aware withdraw.
    await user.clear(amount);
    await user.type(amount, "0.5");
    const review = within(row).getByRole("button", { name: "Review withdrawal" });
    expect(review).toBeEnabled();
    await user.click(review);
    await user.click(within(row).getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(mocks.withdrawMutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.withdrawMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 1,
        vaultAddress: VAULT,
        owner: CONNECTED,
        amount: 500_000_000_000_000_000n,
      })
    );
  });

  it("Max fills the exact withdrawable and round-trips through parseUnits in a comma-decimal locale", async () => {
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
        positions: [makePosition({ withdrawable: 1_500_000_000_000_000_000n })], // 1.5 WETH
        hasPositions: true,
      };
      renderPage("/vaults?manage=positions");

      const row = screen.getByTestId("vault-manage-position-greenpill-nyc");
      await user.click(within(row).getByRole("button", { name: "Withdraw" }));
      await user.click(within(row).getByRole("button", { name: "Max" }));

      const amount = within(row).getByLabelText<HTMLInputElement>("Withdrawal amount");
      // Locale-independent: exactly "1.5", never "15" (the old comma-strip result).
      expect(amount.value).toBe("1.5");

      const review = within(row).getByRole("button", { name: "Review withdrawal" });
      expect(review).toBeEnabled();
      await user.click(review);
      await user.click(within(row).getByRole("button", { name: "Confirm" }));

      await waitFor(() => expect(mocks.withdrawMutateAsync).toHaveBeenCalledTimes(1));
      expect(mocks.withdrawMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1_500_000_000_000_000_000n })
      );
    } finally {
      Object.defineProperty(navigator, "language", { value: originalLanguage, configurable: true });
    }
  });

  it("preserves a leading decimal while typing and normalizes it before submit", async () => {
    const user = userEvent.setup();
    mocks.authMode = "wallet";
    mocks.primaryAddress = CONNECTED;
    mocks.positionsByOwner[CONNECTED.toLowerCase()] = {
      ...emptyPositions(),
      positions: [makePosition({ withdrawable: 1_000_000_000_000_000_000n })],
      hasPositions: true,
    };
    renderPage("/vaults?manage=positions");

    const row = screen.getByTestId("vault-manage-position-greenpill-nyc");
    await user.click(within(row).getByRole("button", { name: "Withdraw" }));

    const amount = within(row).getByLabelText<HTMLInputElement>("Withdrawal amount");
    await user.type(amount, ".001");
    expect(amount.value).toBe(".001");

    await user.click(within(row).getByRole("button", { name: "Review withdrawal" }));
    expect(amount.value).toBe("0.001");
    await user.click(within(row).getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(mocks.withdrawMutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.withdrawMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1_000_000_000_000_000n })
    );
  });

  it("renders card-wallet positions under a Card wallet tab without re-verifying email", async () => {
    // A cached card-wallet position + a live Thirdweb session (just-completed endow).
    window.localStorage.setItem(
      "gg:octant-vault-card-wallets:v1",
      JSON.stringify([
        {
          recoveredWalletAddress: CARD,
          campaignSlug: "greenpill-nyc",
          vaultAddress: VAULT,
          chainId: 1,
          updatedAt: 1000,
        },
      ])
    );
    mocks.positionsByOwner[CARD.toLowerCase()] = {
      ...emptyPositions(),
      positions: [makePosition()],
      hasPositions: true,
    };
    const user = userEvent.setup();
    renderPage("/vaults?manage=positions");

    // Both owner sources present → tabs render.
    await user.click(screen.getByRole("tab", { name: "Card wallet" }));

    const panel = screen.getByTestId("vault-manage-positions-panel");
    await waitFor(() =>
      expect(within(panel).getByTestId("vault-manage-position-greenpill-nyc")).toBeInTheDocument()
    );
    // No email/OTP restore prompt — the live session means no re-verification.
    expect(within(panel).queryByText("Restore email wallet to withdraw")).toBeNull();
    expect(within(panel).queryByText(/restore the email wallet/i)).toBeNull();
    // Withdraw is available (session live).
    expect(within(panel).getByRole("button", { name: "Withdraw" })).toBeInTheDocument();
    // The no-re-verify path is the autoConnect rehydration mechanism, wired with
    // the email in-app wallet — assert it is actually invoked, not bypassed.
    expect(mocks.autoConnectSpy).toHaveBeenCalledWith(
      expect.objectContaining({ wallets: expect.arrayContaining([expect.anything()]) })
    );
  });

  it("prompts email-wallet restoration for a returning card wallet whose session is gone", async () => {
    window.localStorage.setItem(
      "gg:octant-vault-card-wallets:v1",
      JSON.stringify([
        {
          recoveredWalletAddress: CARD,
          campaignSlug: "greenpill-nyc",
          vaultAddress: VAULT,
          chainId: 1,
          updatedAt: 1000,
        },
      ])
    );
    mocks.positionsByOwner[CARD.toLowerCase()] = {
      ...emptyPositions(),
      positions: [makePosition()],
      hasPositions: true,
    };
    // Session gone, autoConnect already settled.
    mocks.activeAccount = undefined;
    mocks.autoConnectLoading = false;

    const user = userEvent.setup();
    renderPage("/vaults?manage=positions");
    await user.click(screen.getByRole("tab", { name: "Card wallet" }));

    const panel = screen.getByTestId("vault-manage-positions-panel");
    await waitFor(() =>
      expect(within(panel).getByText("Restore email wallet to withdraw")).toBeInTheDocument()
    );
    // Position still visible read-only, but no active Withdraw control.
    expect(within(panel).getByTestId("vault-manage-position-greenpill-nyc")).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Withdraw" })).toBeNull();
  });
});

describe("checkout success no longer points to Fund", () => {
  it("wallet-endow success offers Manage vault position and never links to /fund", async () => {
    const user = userEvent.setup();
    mocks.authMode = "wallet";
    mocks.primaryAddress = CONNECTED;
    const { container } = renderContent([makeStableCampaign()]);

    await user.click(screen.getByRole("button", { name: "Endow to Synthetic complete campaign" }));
    await user.click(screen.getByTestId("vault-checkout-method-wallet"));
    await user.type(screen.getByLabelText("Amount to endow"), "2.50");
    await user.click(screen.getByRole("button", { name: "Continue to Wallet" }));
    await user.click(screen.getByRole("button", { name: "Confirm endowment" }));

    const success = await screen.findByTestId("vault-wallet-endow-success");
    expect(mocks.walletEndowMutate).toHaveBeenCalledTimes(1);
    // No Fund-page CTA or copy remains in the success state.
    expect(container.querySelector('a[href="/fund"]')).toBeNull();
    expect(within(success).queryByText(/Fund page/i)).toBeNull();
    // Primary CTA is now Manage vault position.
    expect(screen.getByRole("button", { name: "Manage vault position" })).toBeInTheDocument();
  });
});
