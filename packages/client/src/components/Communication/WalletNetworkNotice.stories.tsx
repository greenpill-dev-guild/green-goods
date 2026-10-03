import type { WalletNetworkNoticeState } from "@green-goods/shared/hooks/blockchain/useWalletNetworkNotice";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { WalletNetworkNotice } from "./WalletNetworkNotice";

/** What the hook hands over while a wallet is left on Celo and the app acts on Arbitrum One. */
function notice(overrides: Partial<WalletNetworkNoticeState> = {}): WalletNetworkNoticeState {
  return {
    message: "Wallet on Celo",
    switchLabel: "Switch to Arbitrum One",
    isSwitching: false,
    switchNetwork: fn(async () => {}),
    ...overrides,
  };
}

const withStatusBarFrame = (Story: React.ComponentType) => (
  <div className="min-h-40 bg-bg-white-0 pt-10 text-text-strong-950">
    <Story />
    <p className="px-4 text-sm text-text-sub-600">Status bar frame</p>
  </div>
);

const meta = {
  title: "Client/PWA/WalletNetworkNotice",
  component: WalletNetworkNotice,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The top status bar while a wallet sits on another network, in the install nudge's place. Acts switch the network themselves; the bar offers the switch first, so a browser wallet's prompt never arrives unannounced.",
      },
    },
  },
  globals: { viewport: { value: "mobile" } },
  decorators: [withStatusBarFrame],
} satisfies Meta<typeof WalletNetworkNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnAnotherNetwork: Story = {
  args: { notice: notice() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent("Wallet on Celo");
    await userEvent.click(canvas.getByRole("button", { name: "Switch to Arbitrum One" }));
    await expect(args.notice.switchNetwork).toHaveBeenCalledOnce();
  },
};

/** The longest wording: a switch that did not take, on a network the app does not list. */
export const SwitchDidNotTake: Story = {
  args: { notice: notice({ message: "Wallet still on another network" }) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Wallet still on another network"
    );
  },
};

export const Switching: Story = {
  args: { notice: notice({ isSwitching: true }) },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Switch to Arbitrum One" });
    await expect(button).toHaveAttribute("aria-busy", "true");
  },
};
