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
          "Real `GardenSettingsEditor` rendered against the Storybook mock wagmi connector and `DevAuthProvider`. Explicit-save form: every field (name, description, location, banner, open joining, max gardeners) edits a local draft; the pinned footer shows the dirty state with Save changes / Cancel. Banner selection shows a local object-URL preview and uploads to IPFS only during Save. The underlying mutations (`useUpdateGardenName`, `useUpdateGarden{Description,Location,BannerImage}`, `useSetOpenJoining`, `useSetMaxGardeners`) are wired but inert against the mock transport. Render states (editable / read-only / dirty footer) reflect the live component.",
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
