import type { Meta, StoryObj } from "@storybook/react";
import { withAdminIdentity, withDataRouter } from "../../../../../shared/.storybook/decorators";
import { CommunityPayoutsTab } from "./CommunityPayoutsTab";
import { storyAllocations, storyGarden } from "./communityStoryFixtures";

const meta = {
  title: "Admin/Workflows/Community/Payouts",
  component: CommunityPayoutsTab,
  tags: ["autodocs"],
  // The jar dialogs hold route changes while a deposit is in flight, which needs a data router.
  decorators: [withAdminIdentity, withDataRouter("/community/payouts")],
  parameters: { layout: "padded" },
  args: {
    garden: storyGarden,
    allocations: storyAllocations,
    allocationsAtLimit: false,
    allocationsUnread: false,
    selectedItem: null,
  },
} satisfies Meta<typeof CommunityPayoutsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Allocated: Story = {};
export const Empty: Story = { args: { allocations: [] } };
/** The payout history could not be read, so the panel says so instead of counting none. */
export const HistoryUnread: Story = { args: { allocations: [], allocationsUnread: true } };
