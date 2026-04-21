import type { Address } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withAdminIdentity } from "../../../../shared/.storybook/decorators";
import { GardenProfileModal } from "./GardenProfileModal";

const GARDEN_ADDRESS = "0x1234567890123456789012345678901234567890" as Address;

const POPULATED_GARDEN = {
  id: GARDEN_ADDRESS,
  name: "Rio Rainforest Lab",
  description: "Community-driven restoration in the Atlantic Forest biome.",
  location: "Rio de Janeiro, Brazil",
  bannerImage: "",
  openJoining: true,
  maxGardeners: 0,
  tokenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  tokenID: "42",
  chainId: 42161,
};

const meta: Meta<typeof GardenProfileModal> = {
  title: "Admin/Workflows/Garden/GardenProfileModal",
  component: GardenProfileModal,
  tags: ["autodocs"],
  decorators: [withAdminIdentity],
  parameters: {
    docs: {
      description: {
        component:
          "Real `GardenProfileModal`. Composes `GardenSettingsEditor` (wagmi mutations inert) and `GardenMetadata` inside a `DialogShell`. Review individual editor states under `Admin/Workflows/Garden/GardenSettingsEditor`.",
      },
    },
  },
  args: {
    isOpen: true,
    onClose: fn(),
    gardenAddress: GARDEN_ADDRESS,
    garden: POPULATED_GARDEN,
    canManage: true,
    isOwner: true,
  },
};

export default meta;
type Story = StoryObj<typeof GardenProfileModal>;

export const OwnerView: Story = {};

export const ReadOnly: Story = {
  args: { canManage: false, isOwner: false },
};

export const Closed: Story = {
  args: { isOpen: false },
};
