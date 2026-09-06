/**
 * SendTab Tests
 * @vitest-environment jsdom
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { useCeloWallet } from "@green-goods/shared/hooks/client-ui/wallet/useCeloWallet";
import type { SendableTokenBalance } from "@green-goods/shared/hooks/blockchain/useSendableTokens";
import { renderWithProviders as render, screen } from "../test-utils";

const SELF = "0x1111111111111111111111111111111111111111" as const;
const MEMBER = "0x2222222222222222222222222222222222222222" as const;
const GOODS_ADDR = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const USDC_ADDR = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;

const goodsToken: SendableTokenBalance = {
  chainId: 42161,
  symbol: "GOODS",
  label: "Green Goods",
  address: GOODS_ADDR,
  decimals: 18,
  confersGovernance: true,
  supported: true,
  balance: 1000n * 10n ** 18n,
  errored: false,
};
const usdcToken: SendableTokenBalance = {
  chainId: 42161,
  symbol: "USDC",
  label: "USDC",
  address: USDC_ADDR,
  decimals: 6,
  confersGovernance: false,
  supported: true,
  balance: 50n * 10n ** 6n,
  errored: false,
};

const celoToken: SendableTokenBalance = {
  chainId: 42220,
  symbol: "G$",
  label: "GoodDollar",
  address: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A",
  decimals: 18,
  confersGovernance: false,
  supported: true,
  balance: 25n * 10n ** 18n,
  errored: false,
};
const mockFeeRead = vi.fn();
let mockSendFailed = false;
let mockSendPending = false;
const mockCeloRefetch = vi.fn();
let mockAuthMode = "passkey";
let mockCeloState = makeCeloState();
function makeCeloState(): ReturnType<typeof useCeloWallet> {
  return {
    token: { ...celoToken, balance: 0n },
    deliveryEnabled: false,
    deliveryLoading: false,
    deliveryError: null,
    readiness: "ready",
    balanceLoading: false,
    balanceError: null,
    receipts: [],
    historyLoading: false,
    historyError: null,
    canSend: false,
    isOffline: false,
    refetch: mockCeloRefetch,
  };
}

const mockSend = vi.fn();
const mockRefetch = vi.fn();
let mockIsOnline = true;
let mockRealConfirm = false;

let mockTokensState: { tokens: SendableTokenBalance[]; isLoading: boolean; isError: boolean } = {
  tokens: [goodsToken, usdcToken],
  isLoading: false,
  isError: false,
};

vi.mock("@green-goods/shared/components/Dialog/ConfirmDialog", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@green-goods/shared/components/Dialog/ConfirmDialog")>();
  return {
    ...original,
    ConfirmDialog: (
      props: import("@green-goods/shared/components/Dialog/ConfirmDialog").ConfirmDialogProps
    ) =>
      mockRealConfirm ? (
        <original.ConfirmDialog {...props} />
      ) : props.isOpen ? (
        <div role="dialog" aria-label="Confirm Send">
          <button type="button" data-testid="confirm-send" onClick={props.onConfirm}>
            confirm
          </button>
          <button type="button" onClick={props.onClose}>
            Cancel
          </button>
        </div>
      ) : null,
  };
});

vi.mock("@green-goods/shared/hooks/auth/useUser", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useUser: () => ({ primaryAddress: SELF, authMode: mockAuthMode }),
  };
});

vi.mock("@green-goods/shared/hooks/blockchain/useChainConfig", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useCurrentChain: () => 42161,
  };
});

vi.mock("@green-goods/shared/hooks/app/useOffline", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useOffline: () => ({ isOnline: mockIsOnline }),
  };
});

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useGardens: () => ({
      data: [
        {
          id: "0xgarden",
          name: "Garden Alpha",
          gardeners: [MEMBER],
          stewards: [SELF],
          evaluators: [],
          owners: [],
          funders: [],
          communities: [],
        },
      ],
    }),
  };
});

vi.mock("@green-goods/shared/hooks/blockchain/useRecentRecipients", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useRecentRecipients: () => [],
  };
});

vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useEnsName: () => ({ data: "alice.eth" }),
  };
});

vi.mock("@green-goods/shared/hooks/blockchain/useEnsAvatar", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useEnsAvatar: () => ({ data: null }),
  };
});

vi.mock("@green-goods/shared/hooks/blockchain/useEnsAddress", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useEnsAddress: () => ({ data: null, isFetching: false }),
  };
});

vi.mock("@green-goods/shared/hooks/blockchain/useSendableTokens", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useSendableTokens: () => ({ ...mockTokensState, refetch: mockRefetch }),
  };
});

vi.mock("@green-goods/shared/hooks/blockchain/useSendToken", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useSendToken: () => ({ mutate: mockSend, isPending: mockSendPending, isError: mockSendFailed }),
  };
});

vi.mock("@green-goods/shared/hooks/client-ui/wallet/useCeloWallet", async (importOriginal) => ({
  ...(await importOriginal()),
  useCeloWallet: () => mockCeloState,
}));

vi.mock("@green-goods/shared/config/pimlico", async (importOriginal) => ({
  ...(await importOriginal()),
  createPublicClientForChain: () => ({ readContract: mockFeeRead }),
}));

import { SendTab } from "../../views/Home/WalletDrawer/SendTab";

async function pickMemberAndToken(user: ReturnType<typeof userEvent.setup>, tokenName: RegExp) {
  // The Tokens tab opens on Balance — switch to the Send flow first.
  await user.click(screen.getByRole("tab", { name: "Send" }));
  await user.click(await screen.findByRole("button", { name: /alice\.eth/i }));
  await user.click(await screen.findByRole("button", { name: tokenName }));
  await user.type(screen.getByRole("textbox", { name: "How much" }), "10");
}

describe("SendTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockReset();
    mockSendFailed = false;
    mockRealConfirm = false;
    mockSendPending = false;
    mockFeeRead.mockResolvedValue([10n ** 18n, true]);
    mockIsOnline = true;
    mockAuthMode = "passkey";
    mockCeloState = makeCeloState();
    mockTokensState = { tokens: [goodsToken, usdcToken], isLoading: false, isError: false };
  });

  it("walks recipient → token+amount → review and confirms a GOODS send", async () => {
    const user = userEvent.setup();
    render(<SendTab />);

    // Enter the Send flow (the tab opens on Balance).
    await user.click(screen.getByRole("tab", { name: "Send" }));

    // Step 1: pick a fellow garden member.
    await user.click(await screen.findByRole("button", { name: /alice\.eth/i }));
    expect(screen.getByText(/Sending to/i)).toBeInTheDocument();

    // Step 2: choose GOODS and enter an amount.
    await user.click(await screen.findByRole("button", { name: /GOODS/ }));
    await user.type(screen.getByRole("textbox", { name: "How much" }), "10");
    await user.click(screen.getByRole("button", { name: "Review" }));

    // Step 3: governance callout for GOODS, then confirm.
    expect(screen.getByText("Sending governance")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.click(screen.getByTestId("confirm-send"));

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toMatchObject({
      to: MEMBER,
      amount: 10n * 10n ** 18n,
    });
    expect(mockSend.mock.calls[0][0].token.symbol).toBe("GOODS");
  });

  it("does not show the governance callout for a non-governance token", async () => {
    const user = userEvent.setup();
    render(<SendTab />);
    await pickMemberAndToken(user, /USDC/);
    await user.click(screen.getByRole("button", { name: "Review" }));

    expect(screen.queryByText("Sending governance")).not.toBeInTheDocument();
  });

  it("disables sending and explains why when offline", async () => {
    mockIsOnline = false;
    const user = userEvent.setup();
    render(<SendTab />);
    await pickMemberAndToken(user, /GOODS/);
    await user.click(screen.getByRole("button", { name: "Review" }));

    expect(screen.getByText("You're offline. Reconnect to send.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("shows the wallet QR code on the Receive tab", async () => {
    const user = userEvent.setup();
    render(<SendTab />);
    await user.click(screen.getByRole("tab", { name: "Receive" }));

    expect(screen.getByRole("img", { name: "Your wallet QR code" })).toBeInTheDocument();
  });

  it("returns to the Balance view when the reset nonce changes (tab re-tap)", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SendTab resetNonce={0} />);
    await user.click(screen.getByRole("tab", { name: "Send" }));
    await user.click(await screen.findByRole("button", { name: /alice\.eth/i }));
    expect(screen.getByText(/Sending to/i)).toBeInTheDocument();

    rerender(<SendTab resetNonce={1} />);

    // The send flow reset — back on the Balance list.
    expect(await screen.findByRole("button", { name: /^Send GOODS/ })).toBeInTheDocument();
    expect(screen.queryByText(/Sending to/i)).not.toBeInTheDocument();
  });

  it("lands back on the Balance view after a successful send", async () => {
    mockSend.mockImplementation((_params, opts) => opts?.onSuccess?.());
    const user = userEvent.setup();
    render(<SendTab />);
    await pickMemberAndToken(user, /GOODS/);
    await user.click(screen.getByRole("button", { name: "Review" }));
    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.click(screen.getByTestId("confirm-send"));

    expect(await screen.findByRole("button", { name: /^Send GOODS/ })).toBeInTheDocument();
    expect(screen.queryByText(/Sending to/i)).not.toBeInTheDocument();
  });

  it("lets you edit the recipient from the review step", async () => {
    const user = userEvent.setup();
    render(<SendTab />);
    await pickMemberAndToken(user, /GOODS/);
    await user.click(screen.getByRole("button", { name: "Review" }));

    // The "To" row is the first tappable "Change" affordance on the review step.
    await user.click(screen.getAllByRole("button", { name: "Change" })[0]);

    expect(await screen.findByRole("button", { name: /alice\.eth/i })).toBeInTheDocument();
  });

  it("opens on the Balance view listing holdings", async () => {
    render(<SendTab />);
    expect(await screen.findByRole("button", { name: /^Send GOODS/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Send USDC/ })).toBeInTheDocument();
  });

  it("shows a load error with retry — never a fake empty state — when balances fail", async () => {
    mockTokensState = { tokens: [], isLoading: false, isError: true };
    const user = userEvent.setup();
    render(<SendTab />);

    expect(await screen.findByText("Some balances couldn't load.")).toBeInTheDocument();
    expect(screen.queryByText("No tokens yet")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("explains offline instead of claiming an empty wallet when nothing is cached", () => {
    mockIsOnline = false;
    mockTokensState = { tokens: [], isLoading: false, isError: true };
    render(<SendTab />);

    expect(
      screen.getByText("You're offline — balances can't refresh right now.")
    ).toBeInTheDocument();
    expect(screen.queryByText("No tokens yet")).not.toBeInTheDocument();
    // Retry is pointless without a connection.
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("keeps cached balances visible offline, with a status note", () => {
    mockIsOnline = false;
    render(<SendTab />);

    expect(
      screen.getByText("You're offline — balances can't refresh right now.")
    ).toHaveTextContent("You're offline — balances can't refresh right now.");
    expect(screen.getByRole("button", { name: /^Send GOODS/ })).toBeInTheDocument();
  });

  it("shows a dash — not a zero — when a token balance can't be read", () => {
    mockTokensState = {
      tokens: [{ ...goodsToken, balance: null, errored: true }],
      isLoading: false,
      isError: false,
    };
    render(<SendTab />);

    expect(
      screen.getByRole("button", { name: "Send GOODS · Balance unavailable" })
    ).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Some balances couldn't load.")).toBeInTheDocument();
  });

  it("tells you there's nothing to send when the token list is empty mid-flow", async () => {
    mockTokensState = { tokens: [], isLoading: false, isError: false };
    const user = userEvent.setup();
    render(<SendTab />);

    await user.click(screen.getByRole("tab", { name: "Send" }));
    await user.click(await screen.findByRole("button", { name: /alice\.eth/i }));

    expect(screen.getByText("No tokens to send yet.")).toBeInTheDocument();
  });

  it("starts a pre-filled send from a Balance token", async () => {
    const user = userEvent.setup();
    render(<SendTab />);

    // Tap GOODS in the Balance list → send flow with GOODS pre-selected.
    await user.click(await screen.findByRole("button", { name: /^Send GOODS/ }));
    await user.click(await screen.findByRole("button", { name: /alice\.eth/i }));

    // The amount step is reached directly, with the token already chosen.
    expect(screen.getByRole("textbox", { name: "How much" })).toBeInTheDocument();
  });
});

describe("Celo wallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockReset();
    mockSendFailed = false;
    mockRealConfirm = false;
    mockSendPending = false;
    mockFeeRead.mockResolvedValue([10n ** 18n, true]);
    mockIsOnline = true;
    mockAuthMode = "passkey";
    mockCeloState = { ...makeCeloState(), token: celoToken, canSend: true, deliveryEnabled: true };
    mockTokensState = { tokens: [goodsToken, usdcToken], isLoading: false, isError: false };
  });

  it("uses the same balance list for G$ and other tokens, and receives through the network picker", async () => {
    const user = userEvent.setup();
    render(<SendTab />);
    expect(screen.queryByRole("heading", { name: "G$ · Celo" })).not.toBeInTheDocument();
    expect(screen.getByText("GoodDollar · Celo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Send GOODS/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Send G\$ ·/ })).toBeEnabled();
    await user.click(screen.getByRole("tab", { name: "Receive" }));
    await user.click(screen.getByRole("radio", { name: "Celo" }));
    expect(screen.getByRole("img", { name: "Your Celo wallet QR code" })).toBeInTheDocument();
    expect(screen.getByText("Receive G$ on the Celo network at this address.")).toBeInTheDocument();
  });

  it("keeps loaded balances visible while the Celo balance is still pending", () => {
    mockCeloState = {
      ...mockCeloState,
      token: { ...celoToken, balance: null },
      balanceLoading: true,
      canSend: false,
    };
    const { rerender } = render(<SendTab />);
    expect(screen.getByRole("button", { name: "Send USDC · 50" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send G$ · Loading..." })).toBeDisabled();
    expect(screen.getByText("Checking your Celo wallet…")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send G$ · Balance unavailable" })
    ).not.toBeInTheDocument();
    mockCeloState = { ...mockCeloState, token: celoToken, balanceLoading: false, canSend: true };
    rerender(<SendTab />);
    expect(screen.getByRole("button", { name: "Send G$ · 25" })).toBeEnabled();
    expect(screen.queryByText("Checking your Celo wallet…")).not.toBeInTheDocument();
  });

  it("starts a G$ send from the shared balance row", async () => {
    const user = userEvent.setup();
    render(<SendTab />);
    await user.click(screen.getByRole("button", { name: "Send G$ · 25" }));
    await user.click(await screen.findByRole("button", { name: /alice\.eth/i }));
    expect(screen.getByRole("textbox", { name: "How much" })).toBeInTheDocument();
    expect(screen.getByText("G$ · Celo")).toBeInTheDocument();
  });

  it("switches receive networks without initiating a transfer", async () => {
    const user = userEvent.setup();
    render(<SendTab />);
    await user.click(screen.getByRole("tab", { name: "Receive" }));
    expect(screen.getByRole("img", { name: "Your wallet QR code" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Celo" }));
    expect(screen.getByRole("img", { name: "Your Celo wallet QR code" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Arbitrum One" }));
    expect(screen.getByRole("img", { name: "Your wallet QR code" })).toBeInTheDocument();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it.each([
    "wallet",
    "embedded",
  ])("discloses user-paid network fees for %s users", async (authMode) => {
    mockAuthMode = authMode;
    const user = userEvent.setup();
    render(<SendTab />);
    await pickMemberAndToken(user, /G\$ · Celo/);
    expect(
      screen.getByText(
        "Your wallet will switch to Celo. You pay the Celo network fee, plus any G$ token fee."
      )
    ).toBeInTheDocument();
  });

  it.each([
    ["policy-unavailable", "Celo network fee coverage is unavailable. Try again later."],
    [
      "address-mismatch",
      "We couldn't verify that this Celo account matches your wallet. Sending is paused.",
    ],
    ["unavailable", "Your Celo account couldn't be prepared. Try again."],
  ] as const)("explains %s and blocks sending", (readiness, message) => {
    mockCeloState = { ...mockCeloState, readiness, canSend: false };
    render(<SendTab />);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Send G\$ ·/ })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Receive" })).toBeEnabled();
  });

  it("keeps receiving available while delivery is blocked", () => {
    mockCeloState = { ...mockCeloState, deliveryEnabled: false, canSend: false };
    render(<SendTab />);
    expect(
      screen.getByText("G$ sending is paused. Your balance and past support remain here.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Send G\$ ·/ })).toBeDisabled();
  });

  it("shows unavailable for a failed Celo read and retries independently", async () => {
    mockCeloState = {
      ...mockCeloState,
      balanceError: new Error("unavailable"),
      token: { ...celoToken, balance: null, errored: true },
      canSend: false,
    };
    const user = userEvent.setup();
    render(<SendTab />);
    expect(
      screen.getByRole("button", { name: "Send G$ · Balance unavailable" })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry Celo wallet" }));
    expect(mockCeloRefetch).toHaveBeenCalledOnce();
  });

  it("retains a cached Celo balance and disables sending offline", () => {
    mockIsOnline = false;
    mockCeloState = { ...mockCeloState, isOffline: true, canSend: false };
    render(<SendTab />);
    expect(
      screen.getByText("You're offline. Showing your last Celo wallet details; reconnect to send.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send G$ · 25" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Send G\$ ·/ })).toBeDisabled();
  });

  it("shows sender-paid G$ fees on amount and review, hides Max, and sends the reviewed quote", async () => {
    const user = userEvent.setup();
    render(<SendTab />);
    await pickMemberAndToken(user, /G\$ · Celo/);
    expect(await screen.findByText("11 G$")).toBeInTheDocument();
    expect(screen.getByText("Total from your balance")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Max" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(await screen.findByText("To")).toBeInTheDocument();
    expect(screen.getByText("11 G$")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.click(await screen.findByTestId("confirm-send"));
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.objectContaining({ chainId: 42220 }),
        amount: 10n * 10n ** 18n,
        reviewedFee: expect.objectContaining({ fee: 10n ** 18n, totalDebit: 11n * 10n ** 18n }),
      }),
      expect.anything()
    );
  });

  it("shows the recipient's net G$ amount for receiver-paid fees", async () => {
    mockFeeRead.mockResolvedValue([10n ** 18n, false]);
    const user = userEvent.setup();
    render(<SendTab />);
    await pickMemberAndToken(user, /G\$ · Celo/);
    expect(await screen.findByText("9 G$")).toBeInTheDocument();
    expect(screen.getByText("Recipient receives")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Max" })).toBeInTheDocument();
  });

  it("blocks Review when the balance cannot cover the sender-paid token fee", async () => {
    mockCeloState = { ...mockCeloState, token: { ...celoToken, balance: 10n * 10n ** 18n } };
    const user = userEvent.setup();
    render(<SendTab />);
    await pickMemberAndToken(user, /G\$ · Celo/);
    expect(
      await screen.findByText("Your balance doesn't cover the amount and G$ token fee.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
  });

  it("blocks invalid quotes and preserves the amount when retrying the fee", async () => {
    mockFeeRead.mockResolvedValue(["invalid", true]);
    const user = userEvent.setup();
    render(<SendTab />);
    await pickMemberAndToken(user, /G\$ · Celo/);
    expect(
      await screen.findByText("The G$ token fee couldn't be checked. Retry before sending.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
    mockFeeRead.mockResolvedValue([10n ** 18n, true]);
    await user.click(screen.getByRole("button", { name: "Retry G$ fee" }));
    expect(await screen.findByText("11 G$")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "How much" })).toHaveValue("10");
  });

  it("retains recipient and amount and restores Send focus after cancellation", async () => {
    const user = userEvent.setup();
    render(<SendTab />);
    await pickMemberAndToken(user, /G\$ · Celo/);
    await screen.findByText("11 G$");
    await user.click(screen.getByRole("button", { name: "Review" }));
    await user.click(await screen.findByRole("button", { name: "Send" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Send" })).toHaveFocus();
    expect(screen.getAllByText("10 G$")).toHaveLength(2);
    expect(screen.getByText(/Sending to: alice.eth/)).toBeInTheDocument();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("announces pending and failed sends while retaining the review for retry", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SendTab />);
    await pickMemberAndToken(user, /G\$ · Celo/);
    await screen.findByText("11 G$");
    await user.click(screen.getByRole("button", { name: "Review" }));
    await screen.findByRole("button", { name: "Send" });
    mockSendPending = true;
    rerender(<SendTab />);
    expect(screen.getByText("Sending G$ on Celo. Waiting for confirmation…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    mockSendPending = false;
    mockSendFailed = true;
    rerender(<SendTab />);
    expect(
      screen.getByText(
        "The send didn't complete. Your recipient and amount are saved here; try again when you're ready."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    expect(screen.getByText(/Sending to: alice.eth/)).toBeInTheDocument();
  });

  it("asks for another review when the fresh G$ fee changes", async () => {
    const user = userEvent.setup();
    render(<SendTab />);
    await pickMemberAndToken(user, /G\$ · Celo/);
    await screen.findByText("11 G$");
    await user.click(screen.getByRole("button", { name: "Review" }));
    await screen.findByRole("button", { name: "Send" });
    mockFeeRead.mockResolvedValue([2n * 10n ** 18n, true]);
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(
      await screen.findByText("The G$ token fee changed. Check the updated amounts before sending.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("12 G$")).toBeInTheDocument();
  });

  it("refreshes a stale delivery gate from Balance without navigation", async () => {
    mockCeloState = {
      ...mockCeloState,
      deliveryEnabled: false,
      deliveryError: null,
      canSend: false,
    };
    const user = userEvent.setup();
    const { rerender } = render(<SendTab />);
    expect(screen.getByRole("button", { name: /^Send G\$ ·/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Retry Celo wallet" }));
    expect(mockCeloRefetch).toHaveBeenCalledOnce();
    mockCeloState = { ...mockCeloState, deliveryEnabled: true, canSend: true };
    rerender(<SendTab />);
    expect(screen.getByRole("button", { name: /^Send G\$ ·/ })).toBeEnabled();
  });

  it("refreshes delivery availability mid-send and retains the recipient and amount", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SendTab />);
    await pickMemberAndToken(user, /G\$ · Celo/);
    await screen.findByText("11 G$");
    mockCeloState = {
      ...mockCeloState,
      deliveryEnabled: false,
      deliveryError: null,
      canSend: false,
    };
    rerender(<SendTab />);
    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
    expect(
      screen.getByText("G$ sending is paused. Your balance and past support remain here.")
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry Celo wallet" }));
    expect(mockCeloRefetch).toHaveBeenCalledOnce();
    mockCeloState = { ...mockCeloState, deliveryEnabled: true, canSend: true };
    rerender(<SendTab />);
    expect(screen.getByRole("textbox", { name: "How much" })).toHaveValue("10");
    expect(screen.getByText(/Sending to: alice.eth/)).toBeInTheDocument();
  });

  it("keeps the address mismatch explanation when receiving at the stored address", async () => {
    mockCeloState = { ...mockCeloState, readiness: "address-mismatch", canSend: false };
    const user = userEvent.setup();
    render(<SendTab />);
    await user.click(screen.getByRole("tab", { name: "Receive" }));
    await user.click(screen.getByRole("radio", { name: "Celo" }));
    expect(
      screen.getByText(
        "We couldn't verify that this Celo account matches your wallet. Sending is paused."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Your Celo wallet QR code" })).toBeInTheDocument();
  });

  it("restores Send focus after closing the actual confirmation dialog", async () => {
    mockRealConfirm = true;
    const user = userEvent.setup();
    render(<SendTab />);
    await pickMemberAndToken(user, /G\$ · Celo/);
    await screen.findByText("11 G$");
    await user.click(screen.getByRole("button", { name: "Review" }));
    await user.click(await screen.findByRole("button", { name: "Send" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Send" })).toHaveFocus();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("shows tiny G$ fees and the exact total debit without rounding", async () => {
    mockFeeRead.mockResolvedValue([10n ** 13n, true]);
    const user = userEvent.setup();
    render(<SendTab />);
    await pickMemberAndToken(user, /G\$ · Celo/);
    const amount = screen.getByRole("textbox", { name: "How much" });
    await user.clear(amount);
    await user.type(amount, "1");
    expect(await screen.findByText("1.00001 G$")).toBeInTheDocument();
    expect(screen.getByText("0.00001 G$")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review" }));
    await screen.findByRole("button", { name: "Send" });
    expect(screen.getByText("1.00001 G$")).toBeInTheDocument();
    expect(screen.getByText("0.00001 G$")).toBeInTheDocument();
  });
});
