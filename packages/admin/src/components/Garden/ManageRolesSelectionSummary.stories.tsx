import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { ManageRolesSelectionSummary } from "./ManageRolesSelectionSummary";
const meta = {
  title: "Admin/Workflows/Garden/ManageRolesSelectionSummary",
  component: ManageRolesSelectionSummary,
  tags: ["autodocs"],
  args: { roles: 3, people: 2, hidden: 1, onShow: fn(), onClear: fn() },
} satisfies Meta<typeof ManageRolesSelectionSummary>;
export default meta;
type Story = StoryObj<typeof meta>;
export const WithHiddenPicks: Story = {};
export const Empty: Story = { args: { roles: 0, people: 0, hidden: 0 } };
