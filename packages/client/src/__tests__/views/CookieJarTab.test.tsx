/**
 * CookieJarTab Tests
 * @vitest-environment jsdom
 */

import type { Address } from "@green-goods/shared/types/domain";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders as render, screen } from "../test-utils";

const TEST_GARDEN = "0x1111111111111111111111111111111111111111" as const;
const TEST_GARDEN_TOKEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const TEST_JAR = "0x2222222222222222222222222222222222222222" as const;
const TEST_TOKEN = "0x3333333333333333333333333333333333333333" as const;
const TEST_DAI = "0x5555555555555555555555555555555555555555" as const;

const mockWithdrawMutate = vi.fn();
const mockUseAccessibleCookieJars = vi.fn();
let mockIsOnline = true;

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

vi.mock("@green-goods/shared/components/Dialog/ConfirmDialog", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    ConfirmDialog: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div /> : null),
  };
});

vi.mock("@green-goods/shared/utils/blockchain/vaults", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    getVaultAssetSymbol: (asset: Address) => (asset === TEST_DAI ? "DAI" : "USDC"),
  };
});

vi.mock("@green-goods/shared/hooks/cookie-jar/useCookieJarWithdraw", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useCookieJarWithdraw: () => ({ mutate: mockWithdrawMutate, isPending: false }),
  };
});

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useGardens: () => ({
      data: [{ id: TEST_GARDEN, tokenAddress: TEST_GARDEN_TOKEN, name: "Garden Alpha" }],
    }),
  };
});

vi.mock("@green-goods/shared/hooks/app/useOffline", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useOffline: () => ({ isOnline: mockIsOnline }),
  };
});

vi.mock("@green-goods/shared/hooks/cookie-jar/useAccessibleCookieJars", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useAccessibleCookieJars: () => mockUseAccessibleCookieJars(),
  };
});

import { CookieJarTab } from "../../views/Home/WalletSheet/CookieJarTab";

describe("CookieJarTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOnline = true;
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

  it("leads with the claimable-now amount using each jar's actual decimals", () => {
    render(<CookieJarTab />);

    // The card leads with what can be claimed right now: min(maxWithdrawal,
    // balance) = min(100000, 123456) = 100000 / 10^6 → "0.1".
    expect(screen.getByText("0.1 USDC")).toBeInTheDocument();
    // The label names the limit and the cooldown, so the number stops reading like a balance.
    expect(screen.getByText("Up to 0.1 USDC per claim, once an hour")).toBeInTheDocument();
    // The group header names the garden once; the card no longer restates it.
    expect(screen.getAllByText("Garden Alpha")).toHaveLength(1);
  });

  it("caps the claimable-now figure at the jar's remaining balance", () => {
    mockUseAccessibleCookieJars.mockReturnValue({
      jars: [{ ...testJar, balance: 50000n }],
      isLoading: false,
      moduleConfigured: true,
      eligibleGardenCount: 1,
      confirmedGardenCount: 1,
      unconfirmedGardenCount: 0,
      eligibilityErrorCount: 0,
      hasEligibilityReadFailure: false,
    });

    render(<CookieJarTab />);

    // The jar holds less (0.05) than the per-claim cap (0.1) — never overstate.
    expect(screen.getByText("0.05 USDC")).toBeInTheDocument();
  });

  it("orders claimable jars before drained jars", () => {
    mockUseAccessibleCookieJars.mockReturnValue({
      jars: [
        { ...testJar, balance: 0n },
        { ...testJar, jarAddress: "0x4444444444444444444444444444444444444444" },
      ],
      isLoading: false,
      moduleConfigured: true,
      eligibleGardenCount: 1,
      confirmedGardenCount: 1,
      unconfirmedGardenCount: 0,
      eligibilityErrorCount: 0,
      hasEligibilityReadFailure: false,
    });

    render(<CookieJarTab />);

    const claimableJar = screen.getByText("0.1 USDC");
    const drainedJar = screen.getByText("0 USDC");
    expect(
      Boolean(claimableJar.compareDocumentPosition(drainedJar) & Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBe(true);
  });

  it("tells a gardener to ask their steward when the jar's claim limit is low", async () => {
    const user = userEvent.setup();
    // The live shape: 9.98 DAI in a jar that pays one cent per claim, once a day.
    const oneCentJar = {
      ...testJar,
      assetAddress: TEST_DAI,
      currency: TEST_DAI,
      decimals: 18,
      balance: 998n * 10n ** 16n,
      maxWithdrawal: 10n ** 16n,
      withdrawalInterval: 86_400n,
    };
    mockUseAccessibleCookieJars.mockReturnValue({
      jars: [oneCentJar, { ...testJar, jarAddress: "0x4444444444444444444444444444444444444444" }],
      isLoading: false,
      moduleConfigured: true,
    });

    render(<CookieJarTab />);

    expect(screen.getByText("Up to 0.01 DAI per claim, once a day")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /0\.01 DAI/ }));
    await user.click(screen.getByRole("button", { name: /0\.1 USDC/ }));

    // One message, on the low jar only; claiming the allowed amount still works.
    expect(
      screen.getAllByText("This jar's claim limit is low. Ask your garden steward to raise it.")
    ).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Claim" })).toHaveLength(2);
  });

  it("shows the jar's total holdings as detail once expanded", async () => {
    const user = userEvent.setup();
    render(<CookieJarTab />);

    await user.click(screen.getByRole("button", { name: /0\.1 USDC/i }));

    expect(screen.getByText("Jar holds 0.1234 USDC")).toBeInTheDocument();
  });

  it("groups jars by the Garden account id instead of the Garden token address", () => {
    render(<CookieJarTab />);

    expect(screen.getAllByText("Garden Alpha")).toHaveLength(1);
    expect(screen.queryByText(TEST_GARDEN)).not.toBeInTheDocument();
  });

  it("uses each jar's actual decimals for the max withdrawal input", async () => {
    const user = userEvent.setup();

    render(<CookieJarTab />);

    await user.click(screen.getByRole("button", { name: /0\.1 USDC/i }));
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

  it("explains offline instead of claiming there are no jars", () => {
    mockIsOnline = false;
    mockUseAccessibleCookieJars.mockReturnValue({
      jars: [],
      isLoading: false,
      moduleConfigured: true,
      eligibleGardenCount: 0,
      confirmedGardenCount: 0,
      unconfirmedGardenCount: 0,
      eligibilityErrorCount: 0,
      hasEligibilityReadFailure: false,
    });

    render(<CookieJarTab />);

    // Offline reads fail closed — an empty list proves nothing.
    expect(
      screen.getByText("You're offline — cookie jars can't refresh right now.")
    ).toBeInTheDocument();
    expect(screen.queryByText("No cookie jars yet")).not.toBeInTheDocument();
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
    const jar = screen.getByText("0.1 USDC");
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

    const jarToggle = screen.getByRole("button", { name: /0\.1 USDC/i });
    expect(jarToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Paused")).toBeInTheDocument();

    await user.click(jarToggle);

    expect(jarToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("textbox", { name: "How much" })).not.toBeInTheDocument();
  });
});
