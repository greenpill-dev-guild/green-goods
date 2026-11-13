import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withAdminIdentity, withDataRouter } from "../../../../../shared/.storybook/decorators";
import { CommunityMembersDialogs } from "./CommunityMembersDialogs";
import { storyGarden, storyRoleMembers } from "./communityStoryFixtures";

const meta = {
  title: "Admin/Workflows/Community/MemberDialogs",
  component: CommunityMembersDialogs,
  tags: ["autodocs"],
  decorators: [withAdminIdentity, withDataRouter("/community/members")],
  args: {
    garden: storyGarden,
    canManage: true,
    canManageStewards: false,
    isOwner: false,
    closeMembersModal: fn(),
    roleMembers: storyRoleMembers,
    scheduleBackgroundRefetch: fn(),
    selectedItem: "add-member",
  },
} satisfies Meta<typeof CommunityMembersDialogs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AddMember: Story = {};
export const ManageRoles: Story = { args: { selectedItem: "manage-members" } };
export const TeamStewardAdministration: Story = {
  args: { canManage: false, canManageStewards: true, selectedItem: "add-member" },
};
