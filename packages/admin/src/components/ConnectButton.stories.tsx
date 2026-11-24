import { AuthStateContext, useAuthState } from "@green-goods/shared/providers/Auth";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { withAdminIdentity, withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { ConnectButton } from "./ConnectButton";

const meta: Meta<typeof ConnectButton> = {
  title: "Admin/Primitives/ConnectButton",
  component: ConnectButton,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame, withAdminIdentity],
  parameters: {
    docs: {
      description: {
        component:
          "Real ConnectButton rendered with the Storybook mock wagmi connector and DevAuthProvider. It renders the shared Button so wallet auth follows the same M3 button grammar.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary"],
    },
    size: {
      control: "select",
      options: ["compact", "sm", "lg"],
    },
  },
  args: {
    variant: "primary",
    size: "sm",
  },
};

export default meta;
type Story = StoryObj<typeof ConnectButton>;

export const Default: Story = {};

export const Secondary: Story = {
  args: { variant: "secondary" },
};

export const Large: Story = {
  args: { size: "lg" },
};

function StalledWalletFixture() {
  const state = useAuthState();
  return (
    <AuthStateContext.Provider value={{ ...state, walletReleaseStalled: true }}>
      <ConnectButton size="lg" />
    </AuthStateContext.Provider>
  );
}

export const StalledWallet: Story = {
  tags: ["storybook-ci"],
  render: () => <StalledWalletFixture />,
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Reload to retry wallet" })
    ).toBeEnabled();
  },
};

export const WithCustomLabel: Story = {
  args: { children: "Sign in with a Wallet" },
};

export const StateCatalog: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <ConnectButton />
      <ConnectButton variant="secondary" />
      <ConnectButton size="lg" />
      <ConnectButton>Sign in with a Wallet</ConnectButton>
    </div>
  ),
};
