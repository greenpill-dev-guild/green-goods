import type { Meta, StoryObj } from "@storybook/react";
import { GardenContributionDate } from "./GardenContributionDate";
const meta = {
  title: "Shared/GardenContributionDate",
  component: GardenContributionDate,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { contribution: { status: "recorded", at: Date.UTC(2026, 10, 15, 12) } },
} satisfies Meta<typeof GardenContributionDate>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Recorded: Story = {};
export const None: Story = { args: { contribution: { status: "none" } } };
export const Unavailable: Story = { args: { contribution: { status: "unavailable" } } };
export const Loading: Story = { args: { contribution: { status: "loading" } } };
export const Unauthorized: Story = { args: { contribution: undefined } };
