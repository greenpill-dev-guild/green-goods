import type { Meta, StoryObj } from "@storybook/react";
import { GardenMembershipDates } from "./GardenMembershipDates";

const meta = {
  title: "Shared/GardenMembershipDates",
  component: GardenMembershipDates,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    history: {
      garden: "0x1111111111111111111111111111111111111111",
      account: "0x2222222222222222222222222222222222222222",
      joinedAt: Date.UTC(2026, 0, 10),
      memberSince: Date.UTC(2026, 4, 20),
      roleSince: { gardener: Date.UTC(2026, 4, 20), steward: Date.UTC(2026, 6, 3) },
    },
  },
} satisfies Meta<typeof GardenMembershipDates>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Rejoined: Story = {};
export const Compact: Story = { args: { compact: true } };
export const Unavailable: Story = { args: { history: undefined, isError: true } };
export const Loading: Story = { args: { history: undefined, isLoading: true } };

const day = (month: number, date: number) => Date.UTC(2026, month, date, 12);

/** A steward who joined holding both hats: one row names both roles and the date once. */
export const SameDayRoles: Story = {
  args: {
    history: {
      garden: "0x1111111111111111111111111111111111111111",
      account: "0x2222222222222222222222222222222222222222",
      joinedAt: day(5, 12),
      memberSince: day(5, 12),
      roleSince: { gardener: day(5, 12), steward: day(5, 12) },
    },
  },
};

/** A gardener who became a steward later: the later role keeps its own dated row. */
export const LaterRole: Story = {
  args: {
    history: {
      garden: "0x1111111111111111111111111111111111111111",
      account: "0x2222222222222222222222222222222222222222",
      joinedAt: day(5, 12),
      memberSince: day(5, 12),
      roleSince: { gardener: day(5, 12), steward: day(8, 1) },
    },
  },
};

/** A current role with no recorded start stays named, dated unknown. */
export const MissingRoleDate: Story = {
  args: {
    roles: ["owner", "steward", "gardener"],
    history: {
      garden: "0x1111111111111111111111111111111111111111",
      account: "0x2222222222222222222222222222222222222222",
      joinedAt: day(5, 12),
      memberSince: day(5, 12),
      roleSince: { gardener: day(5, 12), steward: day(5, 12) },
    },
  },
};
