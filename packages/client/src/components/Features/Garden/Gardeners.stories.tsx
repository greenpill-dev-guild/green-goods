import { useGardenMemberContributions } from "@green-goods/shared/hooks/garden/useGardenMemberContributions";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import {
  useGardenJoinRequestAvailability,
  useGardenJoinRequests,
} from "@green-goods/shared/hooks/garden/useGardenJoinRequests";
import { useGardenMemberHistory } from "@green-goods/shared/hooks/garden/useGardenMemberHistory";
import { useResolvedProfileAvatar } from "@green-goods/shared/hooks/profile/useProfileAvatar";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, mocked, userEvent, waitFor, within } from "storybook/test";
import { JOURNEY_GARDEN_RECORD } from "../../../../../shared/.storybook/clientJourneyFixtures";
import { withSignedOutAuth, withWagmi } from "../../../../../shared/.storybook/decorators";
import {
  FIXTURE_IMAGE_PROFILE,
  STORYBOOK_NOW_SECONDS,
} from "../../../../../shared/.storybook/fixtures";
import { expectItemRowsFit } from "../../../../../shared/.storybook/itemRowFit";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { GardenGardeners, type GardenMember } from "./Gardeners";

const members: GardenMember[] = Array.from({ length: 41 }, (_, index) => ({
  id: `member-${index}`,
  account: `0x${(index + 1).toString(16).padStart(40, "0")}`,
  username: `Gardener ${index + 1}`,
  avatar: FIXTURE_IMAGE_PROFILE,
  registeredAt: STORYBOOK_NOW_SECONDS * 1000,
  isSteward: index === 0,
  isGardener: true,
}));

const meta: Meta<typeof GardenGardeners> = {
  title: "Client/Garden/Gardeners",
  component: GardenGardeners,
  tags: ["autodocs", "storybook-ci"],
  args: { members, garden: JOURNEY_GARDEN_RECORD },
  decorators: [
    (Story) => (
      <div style={{ width: "100%", maxWidth: 360 }}>
        <Story />
      </div>
    ),
    withSignedOutAuth,
  ],
  beforeEach: () => {
    mocked(useGardenMemberContributions).mockReturnValue({ canView: false, byAccount: {} });
    mocked(useGardenMemberHistory).mockReturnValue({
      members: members.map((member) => ({
        garden: JOURNEY_GARDEN_RECORD.id,
        account: member.account,
        joinedAt: Date.UTC(2026, 5, 12, 12),
        memberSince: Date.UTC(2026, 5, 12, 12),
        roleSince: {
          gardener: Date.UTC(2026, 5, 12, 12),
          ...(member.isSteward ? { steward: Date.UTC(2026, 8, 1, 12) } : {}),
        },
      })),
      isLoading: false,
      isError: false,
      refetch: fn(),
    } as ReturnType<typeof useGardenMemberHistory>);
    mocked(useEnsName).mockReturnValue({ data: null } as ReturnType<typeof useEnsName>);
    mocked(useGreenGoodsEnsName).mockReturnValue({ data: null } as ReturnType<
      typeof useGreenGoodsEnsName
    >);
    mocked(useResolvedProfileAvatar).mockReturnValue({
      avatarUri: FIXTURE_IMAGE_PROFILE,
      isLoading: false,
    } as ReturnType<typeof useResolvedProfileAvatar>);
    return resetHookMocks(
      useEnsName,
      useGreenGoodsEnsName,
      useResolvedProfileAvatar,
      useGardenMemberHistory,
      useGardenMemberContributions
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      const cards = canvas.getAllByRole("button", { name: /Gardener \d+/ });
      expect(cards.length).toBeGreaterThan(1);
      const first = cards[0].getBoundingClientRect();
      const next = cards[1].getBoundingClientRect();
      expect(next.top - first.bottom).toBe(12);
    });
    await userEvent.click(canvas.getAllByRole("button", { name: /Gardener \d+/ })[0]);
    await waitFor(() => expect(within(document.body).getByRole("dialog")).toBeVisible());
  },
};

export default meta;
type Story = StoryObj<typeof GardenGardeners>;
export const FortyMembers: Story = { args: { members: members.slice(0, 40) } };
export const FortyOneMembers: Story = {};
export const HistoryUnavailable: Story = {
  args: { members: members.slice(0, 2) },
  beforeEach: () => {
    mocked(useGardenMemberHistory).mockReturnValue({
      members: [],
      isLoading: false,
      isError: true,
      refetch: fn(),
    } as ReturnType<typeof useGardenMemberHistory>);
    return resetHookMocks(useGardenMemberHistory);
  },
};
export const IdentityStates: Story = {
  args: {
    members: [
      {
        ...members[0],
        username: undefined,
        avatar: "blob:unpublished-preview",
        registeredAt: 1_700_000_000_000,
      },
      { ...members[1], username: undefined, registeredAt: null },
      {
        ...members[2],
        username: undefined,
        registeredAt: null,
        isGardener: false,
        isSteward: true,
      },
    ],
  },
  beforeEach: () => {
    mocked(useGreenGoodsEnsName).mockImplementation(
      (address) =>
        ({
          data: address === members[0].account ? "river.greengoods.eth" : null,
        }) as ReturnType<typeof useGreenGoodsEnsName>
    );
    mocked(useEnsName).mockImplementation(
      (address) =>
        ({
          data: address === members[1].account ? "ordinary.eth" : null,
        }) as ReturnType<typeof useEnsName>
    );
    mocked(useResolvedProfileAvatar).mockImplementation(
      (address) =>
        ({
          avatarUri: address === members[0].account ? FIXTURE_IMAGE_PROFILE : "/images/avatar.png",
          isLoading: address === members[2].account,
        }) as ReturnType<typeof useResolvedProfileAvatar>
    );
    return resetHookMocks(useEnsName, useGreenGoodsEnsName, useResolvedProfileAvatar);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // A Green Goods name reads as the username alone.
    await expect(canvas.getByText("river")).toBeVisible();
    await expect(canvas.queryByText("river.greengoods.eth")).toBeNull();
    await expect(canvas.getByText("ordinary.eth")).toBeVisible();
    // A garden's join date is independent of the first gardener role held anywhere.
    await expect(canvas.getAllByText("Joined Jun 12, 2026")).toHaveLength(3);
    await expectItemRowsFit(canvasElement);
  },
};

/** Synthetic members: the contribution date, an empty history and an unavailable read. */
export const Contributions: Story = {
  args: { members: members.slice(0, 3) },
  beforeEach: () => {
    mocked(useGardenMemberContributions).mockReturnValue({
      canView: true,
      byAccount: {
        [members[0].account.toLowerCase()]: { status: "recorded", at: Date.UTC(2026, 10, 15, 12) },
        [members[1].account.toLowerCase()]: { status: "none" },
        [members[2].account.toLowerCase()]: { status: "unavailable" },
      },
    });
    return resetHookMocks(useGardenMemberContributions);
  },
  play: undefined,
};
export const ContributionDetails: Story = {
  ...Contributions,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getAllByRole("button", { name: /Gardener 1/ })[0]);
    await waitFor(() => expect(within(document.body).getByRole("dialog")).toBeVisible());
  },
};

/** The role filter: the steward alone, then Show All from a filter nobody matches. */
export const RoleFilter: Story = {
  args: { members: members.slice(0, 4) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent("4 members");
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: "Role" }), "steward");
    await expect(canvas.getAllByRole("button", { name: /Gardener \d+/ })).toHaveLength(1);
    await expect(canvas.getByRole("status")).toHaveTextContent("1 member");
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: "Role" }), "gardener");
    // The steward also holds the Gardener hat, so they appear here once too.
    await expect(canvas.getAllByRole("button", { name: /Gardener \d+/ })).toHaveLength(4);
  },
};

export const RoleFilterEmpty: Story = {
  args: { members: members.slice(1, 4) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: "Role" }), "steward");
    await expect(canvas.getByText("No one in this garden holds this role.")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Show All" }));
    await expect(canvas.getAllByRole("button", { name: /Gardener \d+/ })).toHaveLength(3);
  },
};

/**
 * A steward's view of a member with the most details today: a Green Goods name and a recorded
 * contribution. The sheet opens with the photo, the address to copy, the roles and the history.
 */
export const DetailsFull: Story = {
  args: { members: members.slice(0, 3) },
  beforeEach: () => {
    mocked(useGardenMemberContributions).mockReturnValue({
      canView: true,
      byAccount: {
        [members[0].account.toLowerCase()]: { status: "recorded", at: Date.UTC(2026, 10, 15, 12) },
      },
    });
    mocked(useGreenGoodsEnsName).mockImplementation(
      (address) =>
        ({
          data: address === members[0].account ? "tomas.greengoods.eth" : null,
        }) as ReturnType<typeof useGreenGoodsEnsName>
    );
    return resetHookMocks(useGardenMemberContributions, useGreenGoodsEnsName);
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getAllByRole("button", { name: /tomas/ })[0]);
    const dialog = await within(document.body).findByRole("dialog");
    // The sheet fades in, so wait for it to settle before reading what it shows.
    await waitFor(() => expect(within(dialog).getByText("Joined as Gardener")).toBeVisible());
    await expect(within(dialog).getByText("Became Steward")).toBeVisible();
    await expect(within(dialog).getByText("Last recorded contribution")).toBeVisible();
    await expect(within(dialog).getByText("Steward and Gardener")).toBeVisible();
    await expect(within(dialog).getByRole("button", { name: "Copy Address" })).toBeVisible();
    await expect(within(dialog).getByText("tomas.greengoods.eth")).toBeVisible();
    await expect(within(dialog).getByRole("button", { name: "Copy Name" })).toBeVisible();
  },
};

/**
 * No source fills a member's contacts today. Once one does (an email sign-in), they join the
 * address in the one list of things to copy, each with its own copy.
 */
export const DetailsWithContact: Story = {
  args: {
    members: [
      { ...members[0], email: "tomas@example.org", phone: "+1 555 0100" },
      ...members.slice(1, 3),
    ],
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getAllByRole("button", { name: /Gardener 1/ })[0]);
    const dialog = await within(document.body).findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByText("tomas@example.org")).toBeVisible());
    await expect(within(dialog).getByRole("button", { name: "Copy Phone" })).toBeVisible();
    await expect(within(dialog).getByRole("button", { name: "Copy Email" })).toBeVisible();
  },
};

/**
 * A steward's join-request queue above the list. Each request reads as a person in the list
 * does, and its name sits under the queue's heading in weight.
 */
export const JoinRequests: Story = {
  args: { members: members.slice(0, 3), canManageRequests: true },
  // Welcome writes the role on chain, so the queue reads the wallet's operations.
  decorators: [withWagmi],
  beforeEach: () => {
    mocked(useGardenJoinRequestAvailability).mockReturnValue(true);
    mocked(useGardenJoinRequests).mockReturnValue({
      queue: [
        {
          id: "request-1",
          accountAddress: "0x00000000000000000000000000000000000000aa",
          displayName: "ana.greengoods.eth",
          state: "pending",
          revision: 1,
          requestedAt: "2026-11-15T15:40:00.000Z",
          note: "I tend the east beds on weekends and would like to log that work here.",
        },
        {
          id: "request-2",
          accountAddress: "0x00000000000000000000000000000000000000bb",
          displayName: "Kwame Mensah-Bonsu",
          state: "pending",
          revision: 1,
          requestedAt: "2026-11-16T09:05:00.000Z",
        },
      ],
      nextCursor: undefined,
      rateLimitedRecently: false,
      queueState: { isLoading: false, error: null },
      mutationState: { isLoading: false, error: null },
      loadQueue: fn(async () => undefined),
      resolveRequest: fn(async () => undefined),
    } as unknown as ReturnType<typeof useGardenJoinRequests>);
    return resetHookMocks(useGardenJoinRequestAvailability, useGardenJoinRequests);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = canvas.getByRole("heading", { level: 2, name: "Asking to Join" });
    const name = canvas.getByRole("heading", { level: 3, name: "ana" });
    await expect(parseFloat(getComputedStyle(name).fontSize)).toBeLessThan(
      parseFloat(getComputedStyle(heading).fontSize)
    );
  },
};

/** A member who joined holding both hats, with no photo: one dated row, the default avatar. */
export const DetailsSameDayNoPhoto: Story = {
  args: { members: members.slice(0, 3) },
  beforeEach: () => {
    mocked(useGardenMemberHistory).mockReturnValue({
      members: members.slice(0, 3).map((member) => ({
        garden: JOURNEY_GARDEN_RECORD.id,
        account: member.account,
        joinedAt: Date.UTC(2026, 5, 12, 12),
        memberSince: Date.UTC(2026, 5, 12, 12),
        roleSince: {
          gardener: Date.UTC(2026, 5, 12, 12),
          ...(member.isSteward ? { steward: Date.UTC(2026, 5, 12, 12) } : {}),
        },
      })),
      isLoading: false,
      isError: false,
      refetch: fn(),
    } as ReturnType<typeof useGardenMemberHistory>);
    mocked(useResolvedProfileAvatar).mockReturnValue({
      avatarUri: "/images/avatar.png",
      isLoading: false,
    } as ReturnType<typeof useResolvedProfileAvatar>);
    return resetHookMocks(useGardenMemberHistory, useResolvedProfileAvatar);
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getAllByRole("button", { name: /Gardener 1/ })[0]);
    const dialog = await within(document.body).findByRole("dialog");
    await waitFor(() =>
      expect(within(dialog).getByText("Joined as Steward and Gardener")).toBeVisible()
    );
    await expect(within(dialog).getAllByText("Jun 12, 2026")).toHaveLength(1);
  },
};
