import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const useGardenCookieJars = vi.hoisted(() =>
  vi.fn(() => ({
    jars: [
      {
        jarAddress: "0xjar" as const,
        gardenAddress: "0xgarden" as const,
        assetAddress: "0xasset" as const,
        balance: 5000000n,
        currency: "0xasset" as const,
        decimals: 6,
        maxWithdrawal: 1000000n,
        withdrawalInterval: 3600n,
        minDeposit: 0n,
        isPaused: false,
        emergencyWithdrawalEnabled: false,
      },
    ],
    isLoading: false,
    error: null,
    jarCount: 1,
    moduleConfigured: true,
    detailErrorCount: 0,
    hasDetailReadFailure: false,
    decimalsErrorCount: 0,
    hasDecimalsReadFailure: false,
  }))
);

vi.mock(
  import("@green-goods/shared/hooks/cookie-jar/useGardenCookieJars"),
  async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, useGardenCookieJars };
  }
);

// Mock modal components to avoid deep hook dependencies (AuthProvider, wagmi, etc.)
vi.mock("@/views/Hub/components/CookieJarWithdrawModal", () => ({
  CookieJarWithdrawModal: () => null,
}));
vi.mock("@/views/Hub/components/CookieJarDepositModal", () => ({
  CookieJarDepositModal: () => null,
}));
vi.mock("@/views/Hub/components/CookieJarManageModal", () => ({
  CookieJarManageModal: () => null,
}));

import { CookieJarPayoutPanel } from "@/views/Hub/components/CookieJarPayoutPanel";

describe("CookieJarPayoutPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders each jar as an operational payout card", () => {
    renderWithProviders(<CookieJarPayoutPanel gardenAddress={"0xgarden" as `0x${string}`} />);

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Jar Balance")).toBeInTheDocument();
    expect(screen.getByText("Available now")).toBeInTheDocument();
    expect(screen.getByText("Withdrawal cooldown")).toBeInTheDocument();
    expect(screen.getByText("1h")).toBeInTheDocument();

    // The card shows the jar asset and balance details in multiple slots.
    expect(screen.getByText(/5/)).toBeInTheDocument();
    expect(screen.getAllByText(/0xasset/).length).toBeGreaterThan(0);

    // Focused payout actions live on the jar card.
    expect(screen.getByRole("button", { name: /Deposit/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Claim/ })).toBeInTheDocument();
  });

  it("does not expose a separate dense jar-management console", () => {
    renderWithProviders(<CookieJarPayoutPanel gardenAddress={"0xgarden" as `0x${string}`} />);

    expect(screen.queryByRole("button", { name: /Manage Jars/ })).not.toBeInTheDocument();
  });

  // Jars are funded from the PWA and other wallets; no mutation in this app can announce that.
  it("keeps re-reading the jars while it is open", () => {
    renderWithProviders(<CookieJarPayoutPanel gardenAddress={"0xgarden" as `0x${string}`} />);

    expect(useGardenCookieJars).toHaveBeenCalledWith(
      "0xgarden",
      expect.objectContaining({ refetchInterval: 15_000 })
    );
  });
});
