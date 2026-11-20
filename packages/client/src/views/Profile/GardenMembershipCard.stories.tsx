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

/** Joined holding both hats on one day: both roles in words, one joined line. */
export const SameDayRoles: Story = {
  args: {
    onHome: false,
    role: "steward",
    roles: ["steward", "gardener"],
    history: {
      garden: JOURNEY_GARDEN,
      account: JOURNEY_VIEWER,
      joinedAt: Date.UTC(2026, 5, 12, 12),
      memberSince: Date.UTC(2026, 5, 12, 12),
      roleSince: { gardener: Date.UTC(2026, 5, 12, 12), steward: Date.UTC(2026, 5, 12, 12) },
    },
  },
};

/** Three roles, highest first, fit on one line in words and leave Leave Garden alone in the footer. */
export const ThreeRoles: Story = {
  args: { role: "steward", roles: ["steward", "gardener", "evaluator"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Steward, Evaluator, and Gardener")).toBeVisible();
  },
};

/**
 * A list of these cards keeps one height whatever the member holds: one role or three, a long
 * garden name, on Home or not.
 */
export const ListKeepsOneHeight: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <GardenMembershipCard {...args} />
      <GardenMembershipCard
        {...args}
        garden={{ ...args.garden, name: "Community Garden of the Upper East Valley Cooperative" }}
        roles={["steward", "gardener", "evaluator"]}
        onHome={false}
      />
      <GardenMembershipCard {...args} history={undefined} historyError onHome={false} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const cards = within(canvasElement).getAllByRole("button", { name: /^Leave Garden/ });
    // The leave button sits in the card's footer, so the footer's parent is the card.
    const heights = cards.map(
      (button) => button.parentElement?.parentElement?.getBoundingClientRect().height ?? 0
    );
    await expect(new Set(heights.map(Math.round)).size).toBe(1);
  },
};
