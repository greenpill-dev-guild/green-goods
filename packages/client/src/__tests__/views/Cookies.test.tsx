/**
 * Campaign Cookie Jar public page tests.
 *
 * @vitest-environment jsdom
 */

import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders as render, screen, userEvent, waitFor, within } from "../test-utils";

const TEST_JAR = "0x1111111111111111111111111111111111111111" as const;
const TEST_TOKEN = "0x2222222222222222222222222222222222222222" as const;
const TEST_WALLET = "0x3333333333333333333333333333333333333333" as const;

const mockOpenWallet = vi.fn();
const mockClaimMutate = vi.fn();
const mockDepositMutate = vi.fn();
const mockClaimReset = vi.fn();
const mockDepositReset = vi.fn();
const mockUseCampaignCookieJar = vi.fn();
const mockUseCampaignCookieJarCampaigns = vi.fn();
const mockUsePublicGardens = vi.fn();
const mockUseUser = vi.fn();
let claimError: Error | null = null;
let depositError: Error | null = null;

const eligibleJar = {
  jarAddress: TEST_JAR,
  assetAddress: TEST_TOKEN,
  balance: 100000000000000000000n,
  decimals: 18,
  symbol: "GOOD",
  fixedAmount: 10000000000000000000n,
  maxWithdrawal: 10000000000000000000n,
  minDeposit: 0n,
  withdrawalInterval: 0n,
  withdrawalType: "fixed",
  accessType: "allowlist",
  oneTimeWithdrawal: true,
  strictPurpose: true,
  isPaused: false,
  isEligible: true,
  canClaimNow: true,
  totalWithdrawn: 0n,
  nextClaimAt: null,
  allowlist: [TEST_WALLET],
  metadata: {
    title: "Earth Week Cookie Jar",
    slug: "earth-week",
    description: "Garden operator rewards for Earth Week.",
    image: "https://cdn.greengoods.app/campaigns/earth-week.webp",
    externalUrl: "https://greengoods.app/cookies?campaign=earth-week",
  },
};

vi.mock("@/routes/WalletRuntimeProviders", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("wagmi", () => ({
  useBalance: () => ({ data: { formatted: "42", symbol: "GOOD" } }),
}));

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");

  return {
    ...actual,
    Button: ({
      children,
      loading: _loading,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    TxInlineFeedback: ({
      visible,
      title,
      message,
    }: {
      visible: boolean;
      title: string;
      message: string;
    }) => (visible ? <div role="alert">{`${title}: ${message}`}</div> : null),
    useAppKit: () => ({ open: mockOpenWallet }),
    useCampaignCookieJar: (jarAddress: string) => mockUseCampaignCookieJar(jarAddress),
    useCampaignCookieJarCampaigns: () => mockUseCampaignCookieJarCampaigns(),
    useCampaignCookieJarDeposit: () => ({
      mutate: mockDepositMutate,
      isPending: false,
      error: depositError,
      reset: mockDepositReset,
    }),
    useCampaignCookieJarWithdraw: () => ({
      mutate: mockClaimMutate,
      isPending: false,
      error: claimError,
      reset: mockClaimReset,
    }),
    usePublicGardens: () => mockUsePublicGardens(),
    useUser: () => mockUseUser(),
  };
});

import CookiesPage from "../../views/Public/Cookies";

function renderPage(path = `/cookies?jar=${TEST_JAR}`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CookiesPage />
    </MemoryRouter>
  );
}

describe("CookiesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    claimError = null;
    depositError = null;
    mockUseUser.mockReturnValue({ primaryAddress: TEST_WALLET });
    mockUsePublicGardens.mockReturnValue({ data: [], isLoading: false });
    mockUseCampaignCookieJarCampaigns.mockReturnValue({
      campaigns: [
        {
          address: TEST_JAR,
          jarAddress: TEST_JAR,
          slug: "earth-week",
          label: "Earth Week",
          title: "Earth Week",
          metadata: null,
          rawMetadata: "",
          source: "indexed",
        },
      ],
      indexedCampaigns: [],
      fallbackCampaigns: [],
      isLoading: false,
      isFallback: false,
      error: null,
    });
    mockUseCampaignCookieJar.mockReturnValue({
      jar: eligibleJar,
      isLoading: false,
      error: null,
      hasDetailReadFailure: false,
    });
    mockClaimMutate.mockImplementation((_params, options) => options?.onSuccess?.());
    mockDepositMutate.mockImplementation((_params, options) => options?.onSuccess?.());
  });

  it("asks disconnected visitors to connect before claiming", async () => {
    mockUseUser.mockReturnValue({ primaryAddress: undefined });

    renderPage();

    expect(
      screen.getByRole("heading", {
        name: /Shared cookie jars for seasonal campaign work/i,
        level: 1,
      })
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Connect a wallet to check claim access and add funds/i)
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Connect wallet" }).length).toBeGreaterThanOrEqual(
      1
    );
  });

  it("claims a fixed cookie amount for an eligible wallet", async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(await screen.findByRole("button", { name: "Claim cookie" }));

    expect(mockClaimMutate).toHaveBeenCalledWith(
      {
        jarAddress: TEST_JAR,
        amount: 10000000000000000000n,
        purpose: "Green Goods campaign cookie claim",
      },
      expect.any(Object)
    );
    expect(mockClaimMutate.mock.calls[0]?.[0].purpose.length).toBeGreaterThanOrEqual(27);
  });

  it("resolves campaign aliases from the indexed campaign list", async () => {
    renderPage("/cookies?campaign=earth-week");

    expect((await screen.findAllByText("Earth Week Cookie Jar")).length).toBeGreaterThan(0);
    expect(mockUseCampaignCookieJar).toHaveBeenCalledWith(TEST_JAR);
    await waitFor(() =>
      expect(screen.getByRole("article", { name: "Earth Week Cookie Jar" })).toHaveFocus()
    );
  });

  it("renders campaign image and description metadata", async () => {
    renderPage();

    expect(
      (await screen.findAllByText("Garden operator rewards for Earth Week.")).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("img", { name: "Earth Week Cookie Jar campaign artwork" })
    ).toHaveAttribute("src", "https://cdn.greengoods.app/campaigns/earth-week.webp");
    expect(screen.getByRole("link", { name: "Campaign page" })).toHaveAttribute(
      "href",
      "https://greengoods.app/cookies?campaign=earth-week"
    );
  });

  it("renders configured campaign jars with inline actions instead of a dialog", async () => {
    renderPage("/cookies");

    expect(await screen.findByRole("heading", { name: /Seasonal jars/i }));
    const card = await screen.findByRole("article", { name: "Earth Week Cookie Jar" });

    expect(within(card).getByRole("button", { name: "Claim cookie" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Deposit" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("submits a smaller variable claim when the jar balance is below max withdrawal", async () => {
    const user = userEvent.setup();
    mockUseCampaignCookieJar.mockReturnValue({
      jar: {
        ...eligibleJar,
        balance: 5000000000000000000n,
        fixedAmount: 0n,
        maxWithdrawal: 100000000000000000000n,
        withdrawalType: "variable",
        canClaimNow: true,
      },
      isLoading: false,
      error: null,
      hasDetailReadFailure: false,
    });

    renderPage();

    await user.type(await screen.findByLabelText("Amount to claim"), "3");
    await user.click(screen.getByRole("button", { name: "Claim cookie" }));

    expect(mockClaimMutate).toHaveBeenCalledWith(
      {
        jarAddress: TEST_JAR,
        amount: 3000000000000000000n,
        purpose: "Green Goods campaign cookie claim",
      },
      expect.any(Object)
    );
    expect(mockClaimMutate.mock.calls[0]?.[0].purpose.length).toBeGreaterThanOrEqual(27);
  });

  it("keeps the claim action disabled for an ineligible wallet", async () => {
    mockUseCampaignCookieJar.mockReturnValue({
      jar: { ...eligibleJar, isEligible: false, canClaimNow: false },
      isLoading: false,
      error: null,
      hasDetailReadFailure: false,
    });

    renderPage();

    expect(await screen.findByText(/wallet is not on the list yet/i));
    expect(screen.getByRole("button", { name: "Claim cookie" })).toBeDisabled();
  });

  it("submits a deposit from the same public page", async () => {
    const user = userEvent.setup();

    renderPage();

    await user.type(await screen.findByLabelText("Deposit amount"), "2.5");
    await user.click(screen.getByRole("button", { name: "Deposit" }));

    expect(mockDepositMutate).toHaveBeenCalledWith(
      {
        jarAddress: TEST_JAR,
        assetAddress: TEST_TOKEN,
        amount: 2500000000000000000n,
      },
      expect.any(Object)
    );
  });

  it("surfaces failed transaction state inline", async () => {
    claimError = new Error("No cookies today");

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("No cookies today");
  });

  it("keeps empty jars in the main grid as needs funding", async () => {
    mockUseCampaignCookieJar.mockReturnValue({
      jar: { ...eligibleJar, balance: 0n, canClaimNow: false },
      isLoading: false,
      error: null,
      hasDetailReadFailure: false,
    });

    renderPage("/cookies");

    const card = await screen.findByRole("article", { name: "Earth Week Cookie Jar" });
    expect(within(card).getByText("Needs funding")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Deposit" })).toBeInTheDocument();
    expect(screen.queryByText(/Closed drops/i)).not.toBeInTheDocument();
  });

  it("keeps paused jars in the main grid as claims paused", async () => {
    mockUseCampaignCookieJar.mockReturnValue({
      jar: { ...eligibleJar, isPaused: true, canClaimNow: false },
      isLoading: false,
      error: null,
      hasDetailReadFailure: false,
    });

    renderPage("/cookies");

    const card = await screen.findByRole("article", { name: "Earth Week Cookie Jar" });
    expect(within(card).getByText("Claims paused")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Deposit" })).toBeInTheDocument();
    expect(screen.queryByText(/Closed drops/i)).not.toBeInTheDocument();
  });
});
