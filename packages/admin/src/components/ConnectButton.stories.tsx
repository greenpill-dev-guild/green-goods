import type { Meta, StoryObj } from "@storybook/react";
import { RiHeart2Line } from "@remixicon/react";
import { withAdminIdentity } from "../../../shared/.storybook/decorators";
import { ConnectButton } from "./ConnectButton";

const meta: Meta<typeof ConnectButton> = {
  title: "Admin/Primitives/ConnectButton",
  component: ConnectButton,
  tags: ["autodocs"],
  decorators: [withAdminIdentity],
  parameters: {
    docs: {
      description: {
        component:
          "Real `ConnectButton` rendered with the Storybook mock wagmi connector + `DevAuthProvider`. `isConnecting` reflects the mock connector's actual state (`false` at rest); the click handler calls the real `loginWithWallet` action against the dev auth provider.",
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
        <RiHeart2Line className="mr-2 h-4 w-4" aria-hidden="true" />
        Sign in with wallet
      </>
    ),
  },
};
