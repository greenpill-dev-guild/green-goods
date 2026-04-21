import type { Address } from "@green-goods/shared";
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
          "External-links card inside the garden profile modal: garden account address, NFT identifier, explorer and OpenSea links.",
      },
    },
  },
  argTypes: {
    chainId: {
      control: "select",
      options: [11155111, 42161, 10],
      description: "11155111 = Sepolia (OpenSea testnet), 42161 = Arbitrum",
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
};

export const LargeTokenId: Story = {
  args: {
    tokenId: 123_456_789n,
  },
};
