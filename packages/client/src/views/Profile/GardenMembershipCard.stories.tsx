import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import {
  JOURNEY_GARDEN,
  JOURNEY_GARDEN_RECORD,
  JOURNEY_VIEWER,
} from "../../../../shared/.storybook/clientJourneyFixtures";
import { withAppPage } from "../../../../shared/.storybook/decorators";
import { GardenMembershipCard } from "./GardenMembershipCard";

const meta = {
  title: "Client/Profile/GardenMembershipCard",
  component: GardenMembershipCard,
  tags: ["autodocs", "storybook-ci"],
  decorators: [
    withAppPage,
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
  globals: { viewport: { value: "mobile" } },
  args: {
    garden: JOURNEY_GARDEN_RECORD,
    role: "gardener",
    history: {
      garden: JOURNEY_GARDEN,
      account: JOURNEY_VIEWER,
      joinedAt: Date.UTC(2026, 5, 12, 12),
      memberSince: Date.UTC(2026, 5, 12, 12),
      roleSince: { gardener: Date.UTC(2026, 5, 12, 12) },
    },
    onHome: true,
    recovering: false,
    onOpen: fn(),
    onLeave: fn(),
  },
} satisfies Meta<typeof GardenMembershipCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ActiveGarden: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: `Leave Garden: ${args.garden.name}` })
    );
    await expect(args.onLeave).toHaveBeenCalledOnce();
    await expect(args.onOpen).not.toHaveBeenCalled();
  },
};
export const AnotherGarden: Story = {
  args: {
    onHome: false,
    role: "steward",
    roles: ["steward", "gardener"],
    history: {
      garden: JOURNEY_GARDEN,
      account: JOURNEY_VIEWER,
      joinedAt: Date.UTC(2026, 5, 12, 12),
      memberSince: Date.UTC(2026, 5, 12, 12),
      roleSince: {
        gardener: Date.UTC(2026, 5, 12, 12),
        steward: Date.UTC(2026, 8, 1, 12),
      },
    },
  },
};
export const Owner: Story = { args: { role: "owner" } };
export const PreviousDeparture: Story = {
  args: {
    role: undefined,
    onHome: false,
    recovering: true,
    history: {
      garden: JOURNEY_GARDEN,
      account: JOURNEY_VIEWER,
      joinedAt: Date.UTC(2026, 5, 12, 12),
      memberSince: null,
      roleSince: {},
    },
  },
};
export const Rejoined: Story = {
  args: {
    history: {
      garden: JOURNEY_GARDEN,
      account: JOURNEY_VIEWER,
      joinedAt: Date.UTC(2026, 5, 12, 12),
      memberSince: Date.UTC(2026, 9, 4, 12),
      roleSince: { gardener: Date.UTC(2026, 9, 4, 12) },
    },
  },
};
export const HistoryUnavailable: Story = { args: { history: undefined, historyError: true } };
