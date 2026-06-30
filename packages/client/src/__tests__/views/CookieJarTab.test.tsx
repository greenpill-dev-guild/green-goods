/**
 * CookieJarTab Tests
 * @vitest-environment jsdom
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders as render, screen } from "../test-utils";

const TEST_GARDEN = "0x1111111111111111111111111111111111111111" as const;
const TEST_GARDEN_TOKEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const TEST_JAR = "0x2222222222222222222222222222222222222222" as const;
const TEST_TOKEN = "0x3333333333333333333333333333333333333333" as const;

const mockWithdrawMutate = vi.fn();
const mockUseAccessibleCookieJars = vi.fn();

const testJar = {
  jarAddress: TEST_JAR,
  gardenAddress: TEST_GARDEN,
  assetAddress: TEST_TOKEN,
  balance: 123456n,
  currency: TEST_TOKEN,
  decimals: 6,
  maxWithdrawal: 100000n,
  withdrawalInterval: 3600n,
  minDeposit: 0n,
  isPaused: false,
  emergencyWithdrawalEnabled: false,
};

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");

  return {
    ...actual,
    ConfirmDialog: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div /> : null),
    getVaultAssetSymbol: () => "USDC",
    useCookieJarWithdraw: () => ({ mutate: mockWithdrawMutate, isPending: false }),
    useGardens: () => ({
      data: [{ id: TEST_GARDEN, tokenAddress: TEST_GARDEN_TOKEN, name: "Garden Alpha" }],
    }),
    useOffline: () => ({ isOnline: true }),
    useAccessibleCookieJars: () => mockUseAccessibleCookieJars(),
  };
});

import { CookieJarTab } from "../../views/Home/WalletDrawer/CookieJarTab";

describe("CookieJarTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAccessibleCookieJars.mockReturnValue({
      jars: [testJar],
      isLoading: false,
      moduleConfigured: true,
      eligibleGardenCount: 1,
      confirmedGardenCount: 1,
      unconfirmedGardenCount: 0,
      eligibilityErrorCount: 0,
      hasEligibilityReadFailure: false,
    });
  });

  it("renders balances using each jar's actual decimals", () => {
    render(<CookieJarTab />);

    // formatTokenAmount truncates to 4 fraction digits by default:
    // 123456 / 10^6 = 0.123456 → displayed as "0.1234"
    expect(screen.getByText("USDC - 0.1234")).toBeInTheDocument();
    expect(screen.getAllByText("Garden Alpha")).toHaveLength(2);
    expect(screen.getByText(/Available now:\s*0\.1/i)).toBeInTheDocument();
  });

  it("groups jars by the Garden account id instead of the Garden token address", () => {
    render(<CookieJarTab />);

    expect(screen.getAllByText("Garden Alpha")).toHaveLength(2);
    expect(screen.queryByText(TEST_GARDEN)).not.toBeInTheDocument();
  });

  it("uses each jar's actual decimals for the max withdrawal input", async () => {
    const user = userEvent.setup();

    render(<CookieJarTab />);

    await user.click(screen.getByRole("button", { name: /USDC - 0\.1234/i }));
    await user.click(screen.getByRole("button", { name: "Max" }));

    expect(screen.getByRole("textbox", { name: "How much" })).toHaveValue("0.1");
  });

  it("renders the empty state when no jars are confirmed", () => {
    mockUseAccessibleCookieJars.mockReturnValue({
      jars: [],
      isLoading: false,
      moduleConfigured: true,
      eligibleGardenCount: 0,
      confirmedGardenCount: 1,
      unconfirmedGardenCount: 0,
      eligibilityErrorCount: 0,
      hasEligibilityReadFailure: false,
    });

    render(<CookieJarTab />);

    expect(screen.getByText("No cookie jars yet")).toBeInTheDocument();
    expect(
      screen.getByText("Cookie jars you can claim from will appear here.")
    ).toBeInTheDocument();
  });

  it("shows access diagnostics before empty copy when eligibility could not be confirmed", () => {
    mockUseAccessibleCookieJars.mockReturnValue({
      jars: [],
      isLoading: false,
      moduleConfigured: true,
      eligibleGardenCount: 0,
      confirmedGardenCount: 0,
      unconfirmedGardenCount: 2,
      eligibilityErrorCount: 2,
      hasEligibilityReadFailure: true,
    });

    render(<CookieJarTab />);

    expect(
      screen.getByText("We couldn't confirm cookie jar access for 2 gardens.")
    ).toBeInTheDocument();
    expect(screen.getByText("No cookie jars yet")).toBeInTheDocument();
  });

  it("shows access diagnostics only when jars are otherwise present", () => {
    mockUseAccessibleCookieJars.mockReturnValue({
      jars: [testJar],
      isLoading: false,
      moduleConfigured: true,
      eligibleGardenCount: 1,
      confirmedGardenCount: 1,
      unconfirmedGardenCount: 1,
      eligibilityErrorCount: 1,
      hasEligibilityReadFailure: true,
    });

    render(<CookieJarTab />);

    expect(
      screen.getByText("We couldn't confirm cookie jar access for 1 garden.")
    ).toBeInTheDocument();
  });

  it("shows partial read diagnostics before rendered jars", () => {
    mockUseAccessibleCookieJars.mockReturnValue({
      jars: [testJar],
      isLoading: false,
      moduleConfigured: true,
      eligibleGardenCount: 1,
      confirmedGardenCount: 1,
      unconfirmedGardenCount: 0,
      eligibilityErrorCount: 0,
      hasEligibilityReadFailure: false,
      jarAddressErrorCount: 0,
      hasJarAddressReadFailure: false,
      detailErrorCount: 1,
      hasDetailReadFailure: true,
      decimalsErrorCount: 0,
      hasDecimalsReadFailure: false,
    });

    render(<CookieJarTab />);

    const warning = screen.getByText(
      "Some Cookie Jar details could not be confirmed. Available balances are shown below."
    );
    const jar = screen.getByText("USDC - 0.1234");
    expect(warning).toBeInTheDocument();
    expect(Boolean(warning.compareDocumentPosition(jar) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
      true
    );
  });

  it("shows partial read diagnostics before empty copy when no jars render", () => {
    mockUseAccessibleCookieJars.mockReturnValue({
      jars: [],
      isLoading: false,
      moduleConfigured: true,
      eligibleGardenCount: 1,
      confirmedGardenCount: 1,
      unconfirmedGardenCount: 0,
      eligibilityErrorCount: 0,
      hasEligibilityReadFailure: false,
      jarAddressErrorCount: 1,
      hasJarAddressReadFailure: true,
      detailErrorCount: 0,
      hasDetailReadFailure: false,
      decimalsErrorCount: 0,
      hasDecimalsReadFailure: false,
    });

    render(<CookieJarTab />);

    const warning = screen.getByText(
      "Some Cookie Jar details could not be confirmed. Available balances are shown below."
    );
    const emptyTitle = screen.getByText("No cookie jars yet");
    expect(warning).toBeInTheDocument();
    expect(
      Boolean(warning.compareDocumentPosition(emptyTitle) & Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBe(true);
  });

  it("marks paused jars and does not expose the claim form", async () => {
    const user = userEvent.setup();
    mockUseAccessibleCookieJars.mockReturnValue({
      jars: [{ ...testJar, isPaused: true }],
      isLoading: false,
      moduleConfigured: true,
      eligibleGardenCount: 1,
      confirmedGardenCount: 1,
      unconfirmedGardenCount: 0,
      eligibilityErrorCount: 0,
      hasEligibilityReadFailure: false,
    });

    render(<CookieJarTab />);

    const jarToggle = screen.getByRole("button", { name: /USDC - 0\.1234/i });
    expect(jarToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Paused")).toBeInTheDocument();

    await user.click(jarToggle);

    expect(jarToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("textbox", { name: "How much" })).not.toBeInTheDocument();
  });
});
