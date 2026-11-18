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
