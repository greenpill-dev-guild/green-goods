import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import esMessages from "@green-goods/shared/i18n/es.json";
import ptMessages from "@green-goods/shared/i18n/pt.json";
import { IntlProvider } from "react-intl";
import { fn } from "storybook/test";
import {
  withAdminIdentity,
  withDataRouter,
  withSeededQueryClient,
} from "../../../../../shared/.storybook/decorators";
import { FIXTURE_IMAGE_PROFILE } from "../../../../../shared/.storybook/fixtures";
import { CommunityMembersTab } from "./CommunityMembersTab";
import {
  storyDirectory,
  storyGarden,
  storyRoleSummary,
  storyRoster,
  storyRosterIdentity,
  storyRosterRoleSummary,
} from "./communityStoryFixtures";

const joinRequestsAvailable = [
  queryKeys.gardenJoinRequests.availability(),
  { enabled: true, supportedKinds: ["garden_membership", "steward_access"] },
] as const;

const meta = {
  title: "Admin/Workflows/Community/Members",
  component: CommunityMembersTab,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    withDataRouter("/community/members"),
    withSeededQueryClient([joinRequestsAvailable]),
  ],
  parameters: { layout: "padded" },
  args: {
    garden: storyGarden,
    canManage: true,
    keepJoinRequestCountGrant: fn(),
    memberCount: storyDirectory.length,
    memberSearch: "",
    noteJoinRequestsRead: fn(),
    roleSummary: storyRoleSummary,
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
    roleSummary: storyRoleSummary.map((entry) =>
      entry.role === "evaluator" ? { ...entry, count: 1 } : entry
    ),
    visibleDirectory: storyDirectory.map((entry) =>
      entry.roles.includes("steward") ? { ...entry, roles: ["steward", "evaluator"] } : entry
    ),
  },
};

const withRosterIdentity = withSeededQueryClient([
  joinRequestsAvailable,
  ...storyRosterIdentity(FIXTURE_IMAGE_PROFILE),
]);

function inLocale(locale: string, messages: Record<string, string>): Decorator {
  return (Story) => (
    <IntlProvider locale={locale} messages={messages}>
      <Story />
    </IntlProvider>
  );
}

/**
 * A fuller garden: a Green Goods name, ENS names and bare addresses, two profile photos, and
 * people who hold several roles, each named through the shared address display.
 */
export const Roster: Story = {
  decorators: [withRosterIdentity],
  args: {
    memberCount: storyRoster.length,
    roleSummary: storyRosterRoleSummary,
    visibleDirectory: storyRoster,
  },
};

export const RosterSpanish: Story = {
  ...Roster,
  decorators: [inLocale("es", esMessages), withRosterIdentity],
};

export const RosterPortuguese: Story = {
  ...Roster,
  decorators: [inLocale("pt", ptMessages), withRosterIdentity],
};
