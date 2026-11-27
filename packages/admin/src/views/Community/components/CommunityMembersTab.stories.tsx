import {
  useGardenMemberContributions,
  useGardenMemberReadiness,
} from "@green-goods/shared/hooks/garden/useGardenMemberContributions";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import esMessages from "@green-goods/shared/i18n/es.json";
import ptMessages from "@green-goods/shared/i18n/pt.json";
import { IntlProvider } from "react-intl";
import { expect, fn, mocked, userEvent, within } from "storybook/test";
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
  storyMemberHistory,
  storyRoleSummary,
  storyRoster,
  storyRosterIdentity,
  storyRosterRoleSummary,
} from "./communityStoryFixtures";

const joinRequestsAvailable = [
  queryKeys.gardenJoinRequests.availability(),
  { enabled: true, supportedKinds: ["garden_membership", "steward_access"] },
] as const;
const membershipHistory = [
  queryKeys.gardens.memberHistory(storyGarden.id, undefined, storyGarden.chainId),
  storyMemberHistory,
] as const;

const meta = {
  title: "Admin/Workflows/Community/Members",
  component: CommunityMembersTab,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    withDataRouter("/community/members"),
    withSeededQueryClient([joinRequestsAvailable, membershipHistory]),
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
 * The steward also evaluates: the rail counts two roles for one person, and
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
  membershipHistory,
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

/** Public contribution fixtures use only synthetic accounts from the garden roster. */
export const Contributions: Story = {
  beforeEach: () => {
    mocked(useGardenMemberContributions).mockReturnValue({
      canView: true,
      byAccount: Object.fromEntries(
        storyDirectory.map((entry, index) => [
          entry.address.toLowerCase(),
          index === 0 ? { status: "recorded", at: Date.UTC(2026, 10, 15, 12) } : { status: "none" },
        ])
      ),
    });
    return resetHookMocks(useGardenMemberContributions);
  },
};

/**
 * Readiness mode (PRD-1537): each person's stage from what the garden records of them, the
 * evidence for it and one hint. A person whose records could not be read is "Not known".
 */
export const Readiness: Story = {
  tags: ["storybook-ci"],
  args: {
    memberCount: storyRoster.length,
    roleSummary: storyRosterRoleSummary,
    visibleDirectory: storyRoster,
  },
  beforeEach: () => {
    mocked(useGardenMemberReadiness).mockReturnValue({
      canView: true,
      byAccount: Object.fromEntries(
        storyRoster.map((entry, index) => [
          entry.address.toLowerCase(),
          index % 4 === 0
            ? {
                status: "read",
                stage: "contributing",
                firstSentAt: Date.UTC(2026, 9, 2, 12),
                firstApprovedAt: Date.UTC(2026, 9, 6, 12),
              }
            : index % 4 === 1
              ? {
                  status: "read",
                  stage: "gettingStarted",
                  firstSentAt: Date.UTC(2026, 10, 14, 12),
                  firstApprovedAt: null,
                }
              : index % 4 === 2
                ? { status: "read", stage: "registered", firstSentAt: null, firstApprovedAt: null }
                : { status: "unavailable" },
        ])
      ),
    });
    return resetHookMocks(useGardenMemberReadiness);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Readiness" }));
    await expect(canvas.getAllByText("Help them send a first report").length).toBeGreaterThan(0);
    await expect(
      canvas.getByText(/people who share a phone are not counted separately/)
    ).toBeVisible();
  },
};
