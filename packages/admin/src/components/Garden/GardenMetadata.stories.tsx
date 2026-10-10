import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { GardenMetadata } from "./GardenMetadata";

const meta: Meta<typeof GardenMetadata> = {
  title: "Admin/Workflows/Garden/GardenMetadata",
  component: GardenMetadata,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "External-links card inside the garden profile modal: garden account address, NFT identifier, explorer links, and an OpenSea link on the chains OpenSea lists.",
      },
    },
  },
  argTypes: {
    chainId: {
      control: "select",
      options: [42161, 11155111, 42220],
      description:
        "42161 = Arbitrum, which links to OpenSea. 11155111 = Sepolia and 42220 = Celo have no OpenSea page, so the link is left out.",
    },
  },
  args: {
    gardenId: "0x1234567890123456789012345678901234567890" as Address,
    tokenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
    tokenId: 42n,
    chainId: 42161,
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof GardenMetadata>;

export const Arbitrum: Story = {};

export const Sepolia: Story = {
  args: { chainId: 11155111 },
  parameters: {
    docs: {
      description: {
        story:
          "A testnet garden. OpenSea has no testnet site, so only the explorer link is offered.",
      },
    },
  },
};

export const LargeTokenId: Story = {
  args: {
    tokenId: 123_456_789n,
  },
};
