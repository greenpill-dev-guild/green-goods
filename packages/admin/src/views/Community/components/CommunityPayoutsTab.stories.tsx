import type { Meta, StoryObj } from "@storybook/react";
import { withAdminIdentity, withRouter } from "../../../../../shared/.storybook/decorators";
import { CommunityPayoutsTab } from "./CommunityPayoutsTab";
import { storyAllocations, storyGarden } from "./communityStoryFixtures";

const meta = {
  title: "Admin/Workflows/Community/Payouts",
  component: CommunityPayoutsTab,
  tags: ["autodocs"],
  decorators: [withAdminIdentity, withRouter(["/community/payouts"])],
  parameters: { layout: "padded" },
  args: {
    garden: storyGarden,
    allocations: storyAllocations,
    selectedItem: null,
  },
} satisfies Meta<typeof CommunityPayoutsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Allocated: Story = {};
export const Empty: Story = { args: { allocations: [] } };
