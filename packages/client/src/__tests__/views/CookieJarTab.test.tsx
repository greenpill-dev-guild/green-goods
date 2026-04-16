/**
 * CookieJarTab Tests
 * @vitest-environment jsdom
 */

import { renderWithProviders as render, screen } from "../test-utils";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_GARDEN = "0x1111111111111111111111111111111111111111" as const;
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
      data: [{ tokenAddress: TEST_GARDEN, name: "Garden Alpha" }],
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
    });
  });

  it("renders balances using each jar's actual decimals", () => {
    render(<CookieJarTab />);

    // formatTokenAmount truncates to 4 fraction digits by default:
    // 123456 / 10^6 = 0.123456 → displayed as "0.1234"
    expect(screen.getByText("USDC - 0.1234")).toBeInTheDocument();
    expect(screen.getByText(/Max Withdrawal:\s*0\.1/i)).toBeInTheDocument();
  });

  it("uses each jar's actual decimals for the max withdrawal input", async () => {
    const user = userEvent.setup();

    render(<CookieJarTab />);

    await user.click(screen.getByRole("button", { name: /USDC - 0\.1234/i }));
    await user.click(screen.getByRole("button", { name: "Max" }));

    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveValue("0.1");
  });

  it("renders the empty state when no jars are confirmed", () => {
    mockUseAccessibleCookieJars.mockReturnValue({
      jars: [],
      isLoading: false,
      moduleConfigured: true,
      eligibleGardenCount: 0,
      confirmedGardenCount: 1,
      unconfirmedGardenCount: 0,
    });

    render(<CookieJarTab />);

    expect(
      screen.getByText("No cookie jars are available for this wallet yet.")
    ).toBeInTheDocument();
  });

  it("shows the fail-closed message when eligibility could not be confirmed", () => {
    mockUseAccessibleCookieJars.mockReturnValue({
      jars: [],
      isLoading: false,
      moduleConfigured: true,
      eligibleGardenCount: 0,
      confirmedGardenCount: 0,
      unconfirmedGardenCount: 2,
    });

    render(<CookieJarTab />);

    expect(
      screen.getByText("2 gardens are hidden until onchain access can be confirmed.")
    ).toBeInTheDocument();
  });
});
