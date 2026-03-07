/**
 * CookieJarPayoutPanel Tests
 * @vitest-environment jsdom
 */

import { renderWithProviders as render, screen, waitFor } from "../../__tests__/test-utils";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_GARDEN = "0x1111111111111111111111111111111111111111" as const;
const TEST_JAR = "0x2222222222222222222222222222222222222222" as const;
const TEST_TOKEN = "0x3333333333333333333333333333333333333333" as const;

const mockUpdateMaxWithdrawal = vi.fn().mockResolvedValue("0xmax");
const mockUpdateInterval = vi.fn().mockResolvedValue("0xinterval");

const testJar = {
  jarAddress: TEST_JAR,
  gardenAddress: TEST_GARDEN,
  assetAddress: TEST_TOKEN,
  balance: 5000000n,
  currency: TEST_TOKEN,
  decimals: 6,
  maxWithdrawal: 1000000n,
  withdrawalInterval: 3600n,
  minDeposit: 0n,
  isPaused: false,
  emergencyWithdrawalEnabled: false,
};

vi.mock("wagmi", () => ({
  useBalance: () => ({
    data: {
      value: 10000000n,
      decimals: 6,
      symbol: "USDC",
    },
  }),
}));

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");

  return {
    ...actual,
    ConfirmDialog: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div /> : null),
    getVaultAssetSymbol: () => "USDC",
    useCookieJarDeposit: () => ({ mutate: vi.fn(), isPending: false }),
    useCookieJarEmergencyWithdraw: () => ({ mutate: vi.fn(), isPending: false }),
    useCookieJarPause: () => ({ mutate: vi.fn(), isPending: false }),
    useCookieJarUnpause: () => ({ mutate: vi.fn(), isPending: false }),
    useCookieJarUpdateInterval: () => ({ mutateAsync: mockUpdateInterval, isPending: false }),
    useCookieJarUpdateMaxWithdrawal: () => ({
      mutateAsync: mockUpdateMaxWithdrawal,
      isPending: false,
    }),
    useCookieJarWithdraw: () => ({ mutate: vi.fn(), isPending: false }),
    useGardenCookieJars: () => ({
      jars: [testJar],
      isLoading: false,
      moduleConfigured: true,
    }),
    useUser: () => ({ primaryAddress: TEST_GARDEN }),
  };
});

import { CookieJarPayoutPanel } from "./CookieJarPayoutPanel";

describe("CookieJarPayoutPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets admins update jar caps and cooldowns with jar-specific decimals", async () => {
    const user = userEvent.setup();

    render(<CookieJarPayoutPanel gardenAddress={TEST_GARDEN} canManage isOwner={false} />);

    await user.click(screen.getByRole("button", { name: "Manage Jars" }));

    const maxWithdrawalInput = screen.getByRole("textbox", { name: "Max Withdrawal" });
    const intervalInput = screen.getByRole("spinbutton", { name: "Withdrawal Cooldown" });

    await user.clear(maxWithdrawalInput);
    await user.type(maxWithdrawalInput, "2.5");
    await user.clear(intervalInput);
    await user.type(intervalInput, "7200");
    await user.click(screen.getByRole("button", { name: "Update Limits" }));

    await waitFor(() => {
      expect(mockUpdateMaxWithdrawal).toHaveBeenCalledWith({
        jarAddress: TEST_JAR,
        maxWithdrawal: 2500000n,
      });
      expect(mockUpdateInterval).toHaveBeenCalledWith({
        jarAddress: TEST_JAR,
        withdrawalInterval: 7200n,
      });
    });
  });
});
