import type { Meta, StoryObj } from "@storybook/react";
import { fn, expect, within } from "storybook/test";
import { MemberRoleSelect } from "./MemberRoleSelect";

const meta = {
  title: "Admin/Garden/MemberRoleSelect",
  component: MemberRoleSelect,
  args: { roles: ["steward"], value: "steward", onChange: fn(), disabled: false },
} satisfies Meta<typeof MemberRoleSelect>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TeamStewardOnly: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("option", { name: "Steward", exact: true })).toBeVisible();
    await expect(canvas.queryByRole("option", { name: "Owner", exact: true })).toBeNull();
  },
};
export const GardenOwner: Story = {
  args: { roles: ["owner", "steward", "gardener", "evaluator", "funder", "community"] },
};
export const NoRoleAuthority: Story = { args: { roles: [], disabled: true } };
