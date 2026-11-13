import type { Meta, StoryObj } from "@storybook/react";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { fn } from "storybook/test";
import {
  withAdminIdentity,
  withDataRouter,
  withSeededQueryClient,
} from "../../../../../shared/.storybook/decorators";
import { CommunityMembersDialogs } from "./CommunityMembersDialogs";
import { storyGarden, storyMemberHistory, storyRoleMembers } from "./communityStoryFixtures";

const meta = {
  title: "Admin/Workflows/Community/MemberDialogs",
  component: CommunityMembersDialogs,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    withDataRouter("/community/members"),
    withSeededQueryClient([
      [
        queryKeys.gardens.memberHistory(storyGarden.id, undefined, storyGarden.chainId),
        storyMemberHistory,
      ],
    ]),
  ],
  args: {
    garden: storyGarden,
    canManage: true,
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
