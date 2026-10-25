import { Button } from "@green-goods/shared/components/Button";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { ConnectPrompt } from "./ConnectPrompt";

const connect = fn();
const meta: Meta<typeof ConnectPrompt> = {
  title: "Admin/Shell/ConnectPrompt",
  component: ConnectPrompt,
  tags: ["autodocs"],
  beforeEach: () => {
    connect.mockClear();
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The real provider-free ConnectPrompt with an actual shared Button action. The callback is an inert Storybook spy: clicks prove action wiring and layout, not a wallet connection or authenticated session.",
      },
    },
  },
  args: {
    title: "Connect to continue",
    description: "Connect your wallet or sign in with a passkey to access this feature.",
    lang: "en",
    action: (
      <Button type="button" size="lg" onClick={connect}>
        Connect Wallet
      </Button>
    ),
  },
  argTypes: { action: { control: false }, icon: { control: false } },
};
export default meta;
type Story = StoryObj<typeof ConnectPrompt>;
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Connect to continue" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Connect Wallet" }));
    await expect(connect).toHaveBeenCalledTimes(1);
  },
};
export const DisabledAction: Story = {
  args: {
    action: (
      <Button type="button" size="lg" disabled onClick={connect}>
        Connect Wallet
      </Button>
    ),
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Connect Wallet" })
    ).toBeDisabled();
    await expect(connect).not.toHaveBeenCalled();
  },
};
