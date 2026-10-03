import type { WalletNetworkNoticeState } from "@green-goods/shared/hooks/blockchain/useWalletNetworkNotice";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
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

const meta = {
  title: "Admin/Shell/WalletNetworkNotice",
  component: WalletNetworkNotice,
  tags: ["autodocs", "storybook-ci"],
  decorators: [withCanvasFrame({ className: "p-4", heightClassName: "min-h-[200px]" })],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Above every cockpit page while a wallet sits on another network. Acts switch the network themselves; the notice offers the switch first, so a browser wallet's prompt never arrives unannounced.",
      },
    },
  },
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
