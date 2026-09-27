import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
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
    return resetHookMocks(useEnsName, useGreenGoodsEnsName);
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
    await expect(within(document.body).getByRole("dialog")).toBeVisible();
  },
};

export default meta;
type Story = StoryObj<typeof GardenGardeners>;
export const FortyMembers: Story = { args: { members: members.slice(0, 40) } };
export const FortyOneMembers: Story = {};
