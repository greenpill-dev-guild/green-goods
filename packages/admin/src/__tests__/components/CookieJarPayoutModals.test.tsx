import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "@green-goods/shared";
import { renderWithProviders, screen } from "../test-utils";

const cookieJarMutationState = vi.hoisted(() => ({
  depositPending: false,
  withdrawPending: false,
  depositMutate: vi.fn(),
  withdrawMutate: vi.fn(),
  depositReset: vi.fn(),
  withdrawReset: vi.fn(),
}));

const GARDEN_ADDRESS = "0x1111111111111111111111111111111111111111" as Address;
const JAR_ADDRESS = "0x2222222222222222222222222222222222222222" as Address;
const ASSET_ADDRESS = "0x3333333333333333333333333333333333333333" as Address;

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    useUser: () => ({ primaryAddress: "0x9999999999999999999999999999999999999999" }),
    useGardenCookieJars: () => ({
      jars: [
        {
          jarAddress: JAR_ADDRESS,
          gardenAddress: GARDEN_ADDRESS,
          assetAddress: ASSET_ADDRESS,
          balance: 5_000_000n,
          currency: ASSET_ADDRESS,
          decimals: 6,
          maxWithdrawal: 1_000_000n,
          withdrawalInterval: 3600n,
          // Non-zero on-chain minimum (mirrors the jar's hardcoded MIN_DEPOSIT
          // constant) — the modal must ignore it, never gate deposits on it.
          minDeposit: 5_000_000_000n,
          isPaused: false,
          emergencyWithdrawalEnabled: false,
        },
      ],
      isLoading: false,
      moduleConfigured: true,
    }),
    useCookieJarDeposit: () => ({
      error: null,
      isPending: cookieJarMutationState.depositPending,
      mutate: cookieJarMutationState.depositMutate,
      reset: cookieJarMutationState.depositReset,
    }),
    useCookieJarWithdraw: () => ({
      error: null,
      isPending: cookieJarMutationState.withdrawPending,
      mutate: cookieJarMutationState.withdrawMutate,
      reset: cookieJarMutationState.withdrawReset,
    }),
  };
});

vi.mock("wagmi", () => ({
  useBalance: () => ({
    data: {
      value: 10_000_000n,
      decimals: 6,
      symbol: "USDC",
    },
  }),
}));

import { CookieJarDepositModal } from "@/views/Hub/components/CookieJarDepositModal";
import { CookieJarWithdrawModal } from "@/views/Hub/components/CookieJarWithdrawModal";

describe("CookieJar payout modals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieJarMutationState.depositPending = false;
    cookieJarMutationState.withdrawPending = false;
  });

  it("prevents closing the deposit modal while the deposit mutation is pending", () => {
    cookieJarMutationState.depositPending = true;
    const onClose = vi.fn();

    renderWithProviders(
      <CookieJarDepositModal isOpen onClose={onClose} gardenAddress={GARDEN_ADDRESS} />
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByLabelText(/close/i)).toBeDisabled();

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Fund Cookie Jar" }), {
      key: "Escape",
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("surfaces no minimum-deposit gate when the jar reports a large on-chain minimum", () => {
    // Regression guard: the modal used to read the CookieJar `MIN_DEPOSIT()`
    // constant (~1 token), display it, and disable deposits below it — blocking
    // valid sub-1-token deposits even though the contract enforces no floor.
    // The mock jar reports a large minimum; the modal must ignore it entirely:
    // no min-deposit line, no minimum error copy. (The Deposit button is now
    // gated only by a positive amount.)
    renderWithProviders(
      <CookieJarDepositModal
        isOpen
        onClose={vi.fn()}
        gardenAddress={GARDEN_ADDRESS}
        defaultJarAddress={JAR_ADDRESS}
      />
    );

    // The jar is selected — the prominent balance tile renders…
    expect(screen.getByText("Jar Balance")).toBeInTheDocument();
    // …but the misleading minimum-deposit copy is gone.
    expect(screen.queryByText(/min\.? deposit/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/minimum deposit/i)).not.toBeInTheDocument();
  });

  it("prevents closing the withdraw modal while the withdrawal mutation is pending", () => {
    cookieJarMutationState.withdrawPending = true;
    const onClose = vi.fn();

    renderWithProviders(
      <CookieJarWithdrawModal isOpen onClose={onClose} gardenAddress={GARDEN_ADDRESS} />
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByLabelText(/close/i)).toBeDisabled();

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Cookie Jar Withdrawal" }), {
      key: "Escape",
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
