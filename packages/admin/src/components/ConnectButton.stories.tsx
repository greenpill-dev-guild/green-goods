import { RiHeart2Line } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
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
          "Real ConnectButton rendered with the Storybook mock wagmi connector and DevAuthProvider. It composes AdminButton so wallet auth follows the same M3 button grammar.",
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
      options: ["sm", "md", "lg"],
    },
  },
  args: {
    variant: "primary",
    size: "md",
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

export const WithCustomLabel: Story = {
  args: {
    children: (
      <>
        <RiHeart2Line className="h-4 w-4" aria-hidden="true" />
        Sign in with wallet
      </>
    ),
  },
};

export const StateCatalog: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <ConnectButton />
      <ConnectButton variant="secondary" />
      <ConnectButton size="lg" />
      <ConnectButton>
        <RiHeart2Line className="h-4 w-4" aria-hidden="true" />
        Sign in with wallet
      </ConnectButton>
    </div>
  ),
};
