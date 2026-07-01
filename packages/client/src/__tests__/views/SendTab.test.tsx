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
let mockIsOnline = true;

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
    useSendableTokens: () => ({ tokens: [goodsToken, usdcToken], isLoading: false }),
    useSendToken: () => ({ mutate: mockSend, isPending: false }),
  };
});

import { SendTab } from "../../views/Home/WalletDrawer/SendTab";

async function pickMemberAndToken(user: ReturnType<typeof userEvent.setup>, tokenName: RegExp) {
  await user.click(await screen.findByRole("button", { name: /alice\.eth/i }));
  await user.click(await screen.findByRole("button", { name: tokenName }));
  await user.type(screen.getByRole("textbox", { name: "How much" }), "10");
}

describe("SendTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOnline = true;
  });

  it("walks recipient → token+amount → review and confirms a GOODS send", async () => {
    const user = userEvent.setup();
    render(<SendTab />);

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

  it("returns to the recipient step when the reset nonce changes (tab re-tap)", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SendTab resetNonce={0} />);
    await user.click(await screen.findByRole("button", { name: /alice\.eth/i }));
    expect(screen.getByText(/Sending to/i)).toBeInTheDocument();

    rerender(<SendTab resetNonce={1} />);

    expect(await screen.findByRole("button", { name: /alice\.eth/i })).toBeInTheDocument();
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
});
