import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { MemberRolePicker } from "./MemberRolePicker";

const meta = {
  title: "Admin/Workflows/Garden/MemberRolePicker",
  component: MemberRolePicker,
  tags: ["autodocs"],
  args: {
    address: "0x1111111111111111111111111111111111111111",
    roles: ["gardener"],
    value: null,
    onChange: fn(),
    disabled: false,
  },
} satisfies Meta<typeof MemberRolePicker>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Unchosen: Story = {};
export const StewardSelected: Story = { args: { value: "steward" } };
export const Saving: Story = { args: { value: "steward", disabled: true } };
export const TeamStewardOnly: Story = { args: { allowedRoles: ["steward"] } };
export const NoRoleAuthority: Story = { args: { allowedRoles: [] } };
