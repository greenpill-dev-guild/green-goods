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
vi.mock("@/components/Work/CookieJarWithdrawModal", () => ({
  CookieJarWithdrawModal: () => null,
}));
vi.mock("@/components/Work/CookieJarDepositModal", () => ({
  CookieJarDepositModal: () => null,
}));
vi.mock("@/components/Work/CookieJarManageModal", () => ({
  CookieJarManageModal: () => null,
}));

import { CookieJarPayoutPanel } from "@/components/Work/CookieJarPayoutPanel";

describe("CookieJarPayoutPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders jar balance and action buttons for admins", () => {
    renderWithProviders(
      <CookieJarPayoutPanel gardenAddress={"0xgarden" as `0x${string}`} canManage isOwner={false} />
    );

    // The panel shows the jar balance badge
    expect(screen.getByText(/5/)).toBeInTheDocument();
    expect(screen.getByText(/0xasset/)).toBeInTheDocument();

    // Action buttons are rendered
    expect(screen.getByRole("button", { name: /Withdraw/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fund Jars/ })).toBeInTheDocument();
    // Manage Jars is shown when canManage is true
    expect(screen.getByRole("button", { name: /Manage Jars/ })).toBeInTheDocument();
  });

  it("hides Manage Jars button when canManage is false", () => {
    renderWithProviders(
      <CookieJarPayoutPanel
        gardenAddress={"0xgarden" as `0x${string}`}
        canManage={false}
        isOwner={false}
      />
    );

    expect(screen.getByRole("button", { name: /Withdraw/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fund Jars/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Manage Jars/ })).not.toBeInTheDocument();
  });
});
