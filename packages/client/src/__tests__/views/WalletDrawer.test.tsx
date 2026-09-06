/**
 * WalletDrawer Tests — host drawer: tab badge counting and tab membership.
 * @vitest-environment jsdom
 */

import { within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import { renderWithProviders as render, screen } from "../test-utils";

const TEST_GARDEN = "0x1111111111111111111111111111111111111111" as const;
const TEST_GARDEN_TOKEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const TEST_TOKEN = "0x3333333333333333333333333333333333333333" as const;

const mockUseAccessibleCookieJars = vi.fn();

const baseJar = {
  jarAddress: "0x2222222222222222222222222222222222222222" as const,
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
const emptyJar = {
  ...baseJar,
  jarAddress: "0x4444444444444444444444444444444444444444" as const,
  balance: 0n,
};
const pausedJar = {
  ...baseJar,
  jarAddress: "0x5555555555555555555555555555555555555555" as const,
  isPaused: true,
};

function jarsState(jars: CookieJar[]) {
  return {
    jars,
    isLoading: false,
    moduleConfigured: true,
    eligibleGardenCount: 1,
    confirmedGardenCount: 1,
    unconfirmedGardenCount: 0,
    eligibilityErrorCount: 0,
    hasEligibilityReadFailure: false,
  };
}

vi.mock("@green-goods/shared/components/Dialog/ConfirmDialog", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    ConfirmDialog: () => null,
  };
});

vi.mock("@green-goods/shared/utils/blockchain/vaults", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    getVaultAssetSymbol: () => "USDC",
  };
});

vi.mock("@green-goods/shared/hooks/cookie-jar/useCookieJarWithdraw", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useCookieJarWithdraw: () => ({ mutate: vi.fn(), isPending: false }),
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

vi.mock("@green-goods/shared/hooks/app/useOnlineStatus", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useOnlineStatus: () => true,
  };
});

vi.mock("@green-goods/shared/hooks/cookie-jar/useAccessibleCookieJars", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useAccessibleCookieJars: () => mockUseAccessibleCookieJars(),
  };
});

import { WalletDrawer } from "../../views/Home/WalletDrawer";

describe("WalletDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAccessibleCookieJars.mockReturnValue(jarsState([baseJar]));
  });

  it("counts only jars that can actually be claimed in the Cookies badge", () => {
    // One claimable, one drained (balance 0), one paused → badge shows 1.
    mockUseAccessibleCookieJars.mockReturnValue(jarsState([baseJar, emptyJar, pausedJar]));

    render(<WalletDrawer isOpen onClose={() => {}} />);

    expect(within(screen.getByTestId("tab-cookie-jar")).getByText("1")).toBeInTheDocument();
  });

  it("shows no badge when nothing is claimable", () => {
    mockUseAccessibleCookieJars.mockReturnValue(jarsState([emptyJar, pausedJar]));

    render(<WalletDrawer isOpen onClose={() => {}} />);

    const cookiesTab = within(screen.getByTestId("tab-cookie-jar"));
    expect(cookiesTab.queryByText("0")).not.toBeInTheDocument();
    expect(cookiesTab.queryByText("2")).not.toBeInTheDocument();
  });

  it("holds only the two balances, with commitments gone to their own sheet", () => {
    render(<WalletDrawer isOpen onClose={() => {}} />);

    expect(screen.getByTestId("tab-cookie-jar")).toBeInTheDocument();
    expect(screen.getByTestId("tab-send")).toBeInTheDocument();
    expect(screen.queryByTestId("tab-pools")).not.toBeInTheDocument();
  });
});
