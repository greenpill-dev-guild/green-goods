import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withAdminIdentity, withDataRouter } from "../../../../../shared/.storybook/decorators";
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
  decorators: [withAdminIdentity, withDataRouter("/community/members")],
  parameters: { layout: "padded" },
  args: {
    garden: storyGarden,
    canManage: true,
    closeMembersModal: fn(),
    memberCount: storyDirectory.length,
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

/**
 * The steward also evaluates: the filter counts two roles for one person, and
 * the total counts people, so it still reads 2 (DL-049).
 */
export const PersonWithSeveralRoles: Story = {
  args: {
    memberCount: storyDirectory.length,
    // Manage Members builds each person's role chips from these seats, so the
    // steward's evaluator seat lives here too.
    roleMembers: { ...storyRoleMembers, evaluator: storyRoleMembers.steward },
    roleSummary: storyRoleSummary.map((entry) =>
      entry.role === "evaluator" ? { ...entry, count: 1 } : entry
    ),
    visibleDirectory: storyDirectory.map((entry) =>
      entry.roles.includes("steward") ? { ...entry, roles: ["steward", "evaluator"] } : entry
    ),
  },
};
