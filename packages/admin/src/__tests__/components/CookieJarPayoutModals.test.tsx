import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { Address } from "@green-goods/shared/types/domain";
import { getCampaignCookieJarPayoutAsset } from "@green-goods/shared/utils/cookie-jar-campaign";
import { renderWithProviders, screen } from "../test-utils";

const QUIET_PLAN = {
  signatures: null,
  signatureLine: null,
  isHeld: false,
  isSettlingHold: false,
  unconfirmedIsHeld: false,
  holdFeedback: null,
};

const cookieJarMutationState = vi.hoisted(() => ({
  plan: vi.fn(),
  depositError: null as Error | null,
  depositPending: false,
  withdrawPending: false,
  depositMutate: vi.fn(),
  withdrawMutate: vi.fn(),
  depositReset: vi.fn(),
  withdrawReset: vi.fn(),
  jarOverrides: {} as Record<string, unknown>,
  extraJars: [] as Record<string, unknown>[],
  readOverrides: {} as Record<string, unknown>,
}));

const GARDEN_ADDRESS = "0x1111111111111111111111111111111111111111" as Address;
const JAR_ADDRESS = "0x2222222222222222222222222222222222222222" as Address;
const ASSET_ADDRESS = "0x3333333333333333333333333333333333333333" as Address;

vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: "0x9999999999999999999999999999999999999999" }),
}));

vi.mock("@green-goods/shared/hooks/cookie-jar/useCookieJarDeposit", () => ({
  useCookieJarDeposit: () => ({
    error: cookieJarMutationState.depositError,
    isPending: cookieJarMutationState.depositPending,
    mutate: cookieJarMutationState.depositMutate,
    reset: cookieJarMutationState.depositReset,
  }),
}));

vi.mock("@green-goods/shared/hooks/vault/useVaultDeposit", () => ({
  useDepositPlan: cookieJarMutationState.plan,
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
      ...cookieJarMutationState.extraJars,
    ],
    isLoading: false,
    moduleConfigured: true,
    ...cookieJarMutationState.readOverrides,
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
    cookieJarMutationState.plan.mockReturnValue(QUIET_PLAN);
    cookieJarMutationState.depositError = null;
    cookieJarMutationState.depositPending = false;
    cookieJarMutationState.withdrawPending = false;
    cookieJarMutationState.jarOverrides = {};
    cookieJarMutationState.extraJars = [];
    cookieJarMutationState.readOverrides = {};
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

  it("plans the deposit for the chosen jar and says how many signatures it takes", () => {
    cookieJarMutationState.plan.mockReturnValue({ ...QUIET_PLAN, signatureLine: "2 signatures" });
    renderWithProviders(
      <CookieJarDepositModal isOpen onClose={vi.fn()} gardenAddress={GARDEN_ADDRESS} />
    );

    expect(screen.getByText("2 signatures")).toBeInTheDocument();
    expect(cookieJarMutationState.plan).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enabled: true,
        gardenAddress: GARDEN_ADDRESS,
        target: { kind: "jar", address: JAR_ADDRESS, asset: ASSET_ADDRESS },
      })
    );
  });

  it.each([
    ["Deposit", vi.fn().mockReturnValue(false)],
    ["Deposit Anyway", vi.fn().mockReturnValue(true)],
  ])("pauses %s while an earlier deposit is unknown", (name, lowLimit) => {
    if (lowLimit()) {
      cookieJarMutationState.jarOverrides = {
        assetAddress: getCampaignCookieJarPayoutAsset(DEFAULT_CHAIN_ID, "dai")?.address,
        decimals: 18,
        maxWithdrawal: 10n ** 16n,
        withdrawalInterval: 86400n,
      };
    }
    cookieJarMutationState.plan.mockReturnValue({
      ...QUIET_PLAN,
      isHeld: true,
      holdFeedback: {
        title: "We couldn’t confirm your last deposit.",
        message: "Deposits here are paused.",
        detail: "This jar holds 3 DAI now.",
        hasUnreadValues: false,
        isSettling: false,
        onCheckAgain: vi.fn(),
        onMoveOn: vi.fn(),
      },
    });
    renderWithProviders(
      <CookieJarDepositModal
        isOpen
        onClose={vi.fn()}
        gardenAddress={GARDEN_ADDRESS}
        defaultJarAddress={JAR_ADDRESS}
        onFixLimit={vi.fn()}
      />
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "1" } });

    expect(screen.getByRole("button", { name })).toBeDisabled();
    expect(screen.getByText(/This jar holds 3 DAI now/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check Again" })).toBeEnabled();
  });

  it.each([
    ["an unknown outcome on today's path", "TransactionConfirmationPendingError", false, true],
    [
      "an unknown outcome on a route that holds it",
      "TransactionConfirmationPendingError",
      true,
      false,
    ],
    ["any other failure on a route that holds", "Error", true, true],
  ])("for %s, the error line reads as expected", (_case, name, unconfirmedIsHeld, shown) => {
    cookieJarMutationState.depositError = Object.assign(new Error("No luck"), { name });
    cookieJarMutationState.plan.mockReturnValue({ ...QUIET_PLAN, unconfirmedIsHeld });
    renderWithProviders(
      <CookieJarDepositModal
        isOpen
        onClose={vi.fn()}
        gardenAddress={GARDEN_ADDRESS}
        defaultJarAddress={JAR_ADDRESS}
      />
    );

    expect(Boolean(screen.queryByRole("alert") ?? screen.queryByRole("status"))).toBe(shown);
  });

  it("starts on the garden's first jar when the caller names none", () => {
    cookieJarMutationState.extraJars = [
      {
        jarAddress: "0x4444444444444444444444444444444444444444",
        assetAddress: ASSET_ADDRESS,
        balance: 7_000_000n,
        decimals: 6,
        maxWithdrawal: 1_000_000n,
        withdrawalInterval: 3600n,
      },
    ];

    renderWithProviders(
      <CookieJarDepositModal isOpen onClose={vi.fn()} gardenAddress={GARDEN_ADDRESS} />
    );

    // The balance tile is the first jar's 5, not the second jar's 7.
    expect(screen.getByText("Jar Balance").parentElement).toHaveTextContent(/^Jar Balance5\b/);
  });

  // An unread currency would parse a 6-decimal deposit with the 18-decimal fallback.
  it.each([
    ["reading", { jars: [] }, /Checking which cookie jars/],
    ["waiting on decimals", { hasUnreadDecimals: true }, /Checking which cookie jars/],
    ["back without decimals", { hasDecimalsReadFailure: true }, /Couldn't read this garden's/],
    ["offline", { jars: [], isPaused: true }, /Cookie jars need a connection/],
    ["failing", { jars: [], error: new Error("RPC timeout") }, /Couldn't read this garden's/],
    ["finding no jar", { jars: [], hasNoJar: true }, /No cookie jars found for this garden/],
    ["unconfigured", { jars: [], moduleConfigured: false }, /Cookie jars aren't available/],
  ])("offers no amount while the jar read is %s, and Cancel still closes", (_state, read, notice) => {
    cookieJarMutationState.readOverrides = read;
    const onClose = vi.fn();

    renderWithProviders(
      <CookieJarDepositModal isOpen onClose={onClose} gardenAddress={GARDEN_ADDRESS} />
    );

    const dialog = screen.getByRole("dialog", { name: "Fund Cookie Jar" });
    expect(dialog).toHaveTextContent(notice);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deposit" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
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
