import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { PoolStatsCard } from "./PoolStatsCard";

const noop = () => undefined;

const meta: Meta<typeof PoolStatsCard> = {
  title: "Admin/Pool/PoolStatsCard",
  component: PoolStatsCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "What needs the steward on the pool tab, as counts: one hairline card of columns, the number over its label, with no button chrome. A count lands on exactly what it counts: Claims waiting on the claims card, Needs recovery and Past due on the commitments list filtered to them. A zero goes nowhere, so it reads as calm text.",
      },
    },
  },
  args: {
    label: "What needs you",
    stats: [
      { id: "claims", count: 2, label: "Claims waiting", onOpen: noop },
      { id: "recovery", count: 1, label: "Needs recovery", onOpen: noop },
      { id: "pastDue", count: 1, label: "Past due", onOpen: noop },
    ],
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolStatsCard>;

export const Counts: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /2\s*claims waiting/i })).toBeVisible();
  },
};

/** Nothing waiting: calm zeros that go nowhere. */
export const AllClear: Story = {
  args: {
    stats: [
      { id: "claims", count: 0, label: "Claims waiting", onOpen: noop },
      { id: "recovery", count: 0, label: "Needs recovery", onOpen: noop },
      { id: "pastDue", count: 0, label: "Past due", onOpen: noop },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryAllByRole("button")).toHaveLength(0);
  },
};

/** Only what needs recovery: the other counts stay calm. */
export const RecoveryOnly: Story = {
  args: {
    stats: [
      { id: "claims", count: 0, label: "Claims waiting", onOpen: noop },
      { id: "recovery", count: 3, label: "Needs recovery", onOpen: noop },
      { id: "pastDue", count: 0, label: "Past due", onOpen: noop },
    ],
  },
};
