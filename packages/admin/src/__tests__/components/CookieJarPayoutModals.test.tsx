import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { Address } from "@green-goods/shared/types/domain";
import { getCampaignCookieJarPayoutAsset } from "@green-goods/shared/utils/cookie-jar-campaign";
import { renderWithProviders, screen } from "../test-utils";

const cookieJarMutationState = vi.hoisted(() => ({
  depositPending: false,
  withdrawPending: false,
  depositMutate: vi.fn(),
  withdrawMutate: vi.fn(),
  depositReset: vi.fn(),
  withdrawReset: vi.fn(),
  jarOverrides: {} as Record<string, unknown>,
}));

const GARDEN_ADDRESS = "0x1111111111111111111111111111111111111111" as Address;
const JAR_ADDRESS = "0x2222222222222222222222222222222222222222" as Address;
const ASSET_ADDRESS = "0x3333333333333333333333333333333333333333" as Address;

vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: "0x9999999999999999999999999999999999999999" }),
}));

vi.mock("@green-goods/shared/hooks/cookie-jar/useCookieJarDeposit", () => ({
  useCookieJarDeposit: () => ({
    error: null,
    isPending: cookieJarMutationState.depositPending,
    mutate: cookieJarMutationState.depositMutate,
    reset: cookieJarMutationState.depositReset,
  }),
}));

vi.mock("@green-goods/shared/hooks/cookie-jar/useCookieJarWithdraw", () => ({
  useCookieJarWithdraw: () => ({
    error: null,
    isPending: cookieJarMutationState.withdrawPending,
    mutate: cookieJarMutationState.withdrawMutate,
    reset: cookieJarMutationState.withdrawReset,
  }),
}));

vi.mock("@green-goods/shared/hooks/cookie-jar/useGardenCookieJars", () => ({
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
        ...cookieJarMutationState.jarOverrides,
      },
    ],
    isLoading: false,
    moduleConfigured: true,
  }),
}));

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
    cookieJarMutationState.jarOverrides = {};
  });

  it("warns before funding a jar whose claim limit is low, and offers the fix first", () => {
    // The live shape: a DAI jar that pays one cent per claim, once a day.
    cookieJarMutationState.jarOverrides = {
      assetAddress: getCampaignCookieJarPayoutAsset(DEFAULT_CHAIN_ID, "dai")?.address,
      decimals: 18,
      maxWithdrawal: 10n ** 16n,
      withdrawalInterval: 86_400n,
    };
    const onFixLimit = vi.fn();

    renderWithProviders(
      <CookieJarDepositModal
        isOpen
        onClose={vi.fn()}
        gardenAddress={GARDEN_ADDRESS}
        defaultJarAddress={JAR_ADDRESS}
        onFixLimit={onFixLimit}
      />
    );

    expect(screen.getByText("This jar pays out 0.01 DAI per claim")).toBeInTheDocument();
    expect(screen.getByText(/Each gardener can claim once a day\./)).toBeInTheDocument();
    // A warning, not a block: the deposit is still on offer.
    expect(screen.getByRole("button", { name: "Deposit Anyway" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fix Limit First" }));
    expect(onFixLimit).toHaveBeenCalledWith(JAR_ADDRESS);
  });

  it("funds a jar with a sensible limit without the warning", () => {
    renderWithProviders(
      <CookieJarDepositModal
        isOpen
        onClose={vi.fn()}
        gardenAddress={GARDEN_ADDRESS}
        defaultJarAddress={JAR_ADDRESS}
        onFixLimit={vi.fn()}
      />
    );

    expect(screen.queryByText(/per claim/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deposit" })).toBeInTheDocument();
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
