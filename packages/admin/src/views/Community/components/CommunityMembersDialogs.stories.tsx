import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withAdminIdentity, withRouter } from "../../../../../shared/.storybook/decorators";
import { CommunityMembersDialogs } from "./CommunityMembersDialogs";
import { storyGarden, storyRoleMembers } from "./communityStoryFixtures";

const meta = {
  title: "Admin/Workflows/Community/MemberDialogs",
  component: CommunityMembersDialogs,
  tags: ["autodocs"],
  decorators: [withAdminIdentity, withRouter(["/community/members"])],
  args: {
    garden: storyGarden,
    canManage: true,
    closeMembersModal: fn(),
    roleMembers: storyRoleMembers,
    scheduleBackgroundRefetch: fn(),
    selectedItem: "add-member",
  },
} satisfies Meta<typeof CommunityMembersDialogs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AddMember: Story = {};
export const ManageMembers: Story = { args: { selectedItem: "manage-members" } };
