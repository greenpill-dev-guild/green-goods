import type { Address } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { withAdminIdentity } from "../../../../shared/.storybook/decorators";
import { FIXTURE_IMAGE_BANNER } from "../../../../shared/.storybook/fixtures";
import { GardenSettingsEditor } from "./GardenSettingsEditor";

const GARDEN_ADDRESS = "0x1234567890123456789012345678901234567890" as Address;

const POPULATED_GARDEN = {
  name: "Rio Rainforest Lab",
  description: "Community-driven restoration in the Atlantic Forest biome.",
  location: "Rio de Janeiro, Brazil",
  bannerImage: "",
  openJoining: true,
  maxGardeners: 0,
};

const meta: Meta<typeof GardenSettingsEditor> = {
  title: "Admin/Workflows/Garden/GardenSettingsEditor",
  component: GardenSettingsEditor,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    (Story) => (
      <div className="mx-auto max-w-2xl p-4">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Real `GardenSettingsEditor` rendered against the Storybook mock wagmi connector and `DevAuthProvider`. The banner field is an upload-to-IPFS control with a live preview (PRD-513); the other fields use inline `EditableField` save. The underlying update mutations (`useUpdateGardenName`, `useUpdateGarden{Description,Location,BannerImage}`, `useSetOpenJoining`, `useSetMaxGardeners`) are wired but inert — actions trigger the real mutation which fails silently against the mock transport. Render states (view / edit / read-only) reflect the live component.",
      },
    },
  },
  args: {
    gardenAddress: GARDEN_ADDRESS,
    garden: POPULATED_GARDEN,
    canManage: true,
    isOwner: true,
  },
};

export default meta;
type Story = StoryObj<typeof GardenSettingsEditor>;

export const OwnerView: Story = {};

export const ManagerView: Story = {
  args: { isOwner: false },
};

export const ReadOnly: Story = {
  args: { isOwner: false, canManage: false },
};

export const InviteOnly: Story = {
  args: {
    garden: { ...POPULATED_GARDEN, openJoining: false, maxGardeners: 50 },
  },
};

export const EmptyFields: Story = {
  args: {
    garden: {
      name: "",
      description: "",
      location: "",
      bannerImage: "",
      openJoining: false,
      maxGardeners: 0,
    },
  },
};

// PRD-513: a saved banner renders as a live preview above the uploader, not as
// a bare URL link. Read-only operators see the preview without the upload control.
export const WithBannerImage: Story = {
  args: {
    garden: { ...POPULATED_GARDEN, bannerImage: FIXTURE_IMAGE_BANNER },
  },
};
