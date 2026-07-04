import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

vi.mock(import("@green-goods/shared"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useGardenCookieJars: () => ({
      jars: [
        {
          jarAddress: "0xjar",
          gardenAddress: "0xgarden",
          assetAddress: "0xasset",
          balance: 5000000n,
          currency: "0xasset",
          decimals: 6,
          maxWithdrawal: 1000000n,
          withdrawalInterval: 3600n,
          minDeposit: 0n,
          isPaused: false,
          emergencyWithdrawalEnabled: false,
        },
      ],
      isLoading: false,
      moduleConfigured: true,
    }),
  };
});

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

  it("renders jar balance and payout action buttons", () => {
    renderWithProviders(<CookieJarPayoutPanel gardenAddress={"0xgarden" as `0x${string}`} />);

    // The panel shows the jar balance badge
    expect(screen.getByText(/5/)).toBeInTheDocument();
    expect(screen.getByText(/0xasset/)).toBeInTheDocument();

    // Payout actions only — deposits and withdrawals
    expect(screen.getByRole("button", { name: /Claim/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fund Jars/ })).toBeInTheDocument();
  });

  it("carries no jar-management affordance (management lives in the Garden Profile dialog)", () => {
    renderWithProviders(<CookieJarPayoutPanel gardenAddress={"0xgarden" as `0x${string}`} />);

    // Pause/limits/cooldowns moved to GardenWorkspaceContent's cookie-jars
    // row — the payout surface must not re-grow a parallel manage path.
    expect(screen.queryByRole("button", { name: /Manage Jars/ })).not.toBeInTheDocument();
  });
});
