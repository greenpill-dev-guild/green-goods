import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import { useResolvedProfileAvatar } from "@green-goods/shared/hooks/profile/useProfileAvatar";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, mocked, userEvent, waitFor, within } from "storybook/test";
import { withSignedOutAuth } from "../../../../../shared/.storybook/decorators";
import {
  FIXTURE_IMAGE_PROFILE,
  STORYBOOK_NOW_SECONDS,
} from "../../../../../shared/.storybook/fixtures";
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
  args: { members },
  decorators: [
    (Story) => (
      <div style={{ width: "100%", maxWidth: 360 }}>
        <Story />
      </div>
    ),
    withSignedOutAuth,
  ],
  beforeEach: () => {
    mocked(useEnsName).mockReturnValue({ data: null } as ReturnType<typeof useEnsName>);
    mocked(useGreenGoodsEnsName).mockReturnValue({ data: null } as ReturnType<
      typeof useGreenGoodsEnsName
    >);
    mocked(useResolvedProfileAvatar).mockReturnValue({
      avatarUri: FIXTURE_IMAGE_PROFILE,
      isLoading: false,
    } as ReturnType<typeof useResolvedProfileAvatar>);
    return resetHookMocks(useEnsName, useGreenGoodsEnsName, useResolvedProfileAvatar);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      const cards = canvas.getAllByRole("button", { name: /Gardener \d+/ });
      expect(cards.length).toBeGreaterThan(1);
      const first = cards[0].getBoundingClientRect();
      const next = cards[1].getBoundingClientRect();
      expect(next.top - first.bottom).toBe(16);
    });
    await userEvent.click(canvas.getAllByRole("button", { name: /Gardener \d+/ })[0]);
    await waitFor(() => expect(within(document.body).getByRole("dialog")).toBeVisible());
  },
};

export default meta;
type Story = StoryObj<typeof GardenGardeners>;
export const FortyMembers: Story = { args: { members: members.slice(0, 40) } };
export const FortyOneMembers: Story = {};
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
    // The row renders its label, the colon and the date as separate text nodes of one span.
    await expect(canvas.getByText("Gardener since: Unknown")).toBeVisible();
  },
};
