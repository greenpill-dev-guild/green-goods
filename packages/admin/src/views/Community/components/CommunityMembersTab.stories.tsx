import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withAdminIdentity, withRouter } from "../../../../../shared/.storybook/decorators";
import { CommunityMembersTab } from "./CommunityMembersTab";
import {
  storyDirectory,
  storyGarden,
  storyRoleMembers,
  storyRoleSummary,
} from "./communityStoryFixtures";

const meta = {
  title: "Admin/Workflows/Community/Members",
  component: CommunityMembersTab,
  tags: ["autodocs"],
  decorators: [withAdminIdentity, withRouter(["/community/members"])],
  parameters: { layout: "padded" },
  args: {
    garden: storyGarden,
    canManage: true,
    closeMembersModal: fn(),
    memberSearch: "",
    roleMembers: storyRoleMembers,
    roleSummary: storyRoleSummary,
    scheduleBackgroundRefetch: fn(),
    selectedItem: null,
    setMemberSearch: fn(),
    visibleDirectory: storyDirectory,
  },
} satisfies Meta<typeof CommunityMembersTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const ReadOnly: Story = { args: { canManage: false } };
