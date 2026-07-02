/**
 * SendTab Tests
 * @vitest-environment jsdom
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders as render, screen } from "../test-utils";

const SELF = "0x1111111111111111111111111111111111111111" as const;
const MEMBER = "0x2222222222222222222222222222222222222222" as const;
const GOODS_ADDR = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const USDC_ADDR = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;

const goodsToken = {
  symbol: "GOODS",
  label: "Green Goods",
  address: GOODS_ADDR,
  decimals: 18,
  confersGovernance: true,
  supported: true,
  balance: 1000n * 10n ** 18n,
  errored: false,
};
const usdcToken = {
  symbol: "USDC",
  label: "USDC",
  address: USDC_ADDR,
  decimals: 6,
  confersGovernance: false,
  supported: true,
  balance: 50n * 10n ** 6n,
  errored: false,
};

const mockSend = vi.fn();
const mockRefetch = vi.fn();
let mockIsOnline = true;

type MockToken = Omit<typeof goodsToken, "balance"> & { balance: bigint | null };
let mockTokensState: { tokens: MockToken[]; isLoading: boolean; isError: boolean } = {
  tokens: [goodsToken, usdcToken],
  isLoading: false,
  isError: false,
};

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");
  return {
    ...actual,
    ConfirmDialog: ({ isOpen, onConfirm }: { isOpen: boolean; onConfirm: () => void }) =>
      isOpen ? (
        <button type="button" data-testid="confirm-send" onClick={onConfirm}>
          confirm
        </button>
      ) : null,
    useUser: () => ({ primaryAddress: SELF }),
    useCurrentChain: () => 42161,
    useOffline: () => ({ isOnline: mockIsOnline }),
    useGardens: () => ({
      data: [
        {
          id: "0xgarden",
          name: "Garden Alpha",
          gardeners: [MEMBER],
          operators: [SELF],
          evaluators: [],
          owners: [],
          funders: [],
          communities: [],
        },
      ],
    }),
    useRecentRecipients: () => [],
    useEnsName: () => ({ data: "alice.eth" }),
    useEnsAvatar: () => ({ data: null }),
    useEnsAddress: () => ({ data: null, isFetching: false }),
    useSendableTokens: () => ({ ...mockTokensState, refetch: mockRefetch }),
    useSendToken: () => ({ mutate: mockSend, isPending: false }),
  };
});

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
    mockIsOnline = true;
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

    expect(await screen.findByText("Couldn't load your balances")).toBeInTheDocument();
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

    expect(screen.getByRole("status")).toHaveTextContent(
      "You're offline — balances can't refresh right now."
    );
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
