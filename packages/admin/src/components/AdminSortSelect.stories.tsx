import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminSortSelect } from "./AdminSortSelect";

const meta: Meta<typeof AdminSortSelect> = {
  title: "Admin/Primitives/AdminSortSelect",
  component: AdminSortSelect,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "Canonical 'Sort by' pill, shared by Hub and Actions so the control can't drift. An h-10 M3 pill matching the AdminSearchToolbar search-field height, with a whitespace-nowrap label and a borderless NativeSelect at text-body-md weight. Drop it inside an AdminSearchToolbar's children.",
      },
    },
  },
  args: {
    value: "newest",
    onChange: fn(),
    options: [
      { value: "newest", label: "Newest" },
      { value: "oldest", label: "Oldest" },
    ],
  },
};

export default meta;
type Story = StoryObj<typeof AdminSortSelect>;

export const Default: Story = {};

export const CustomLabel: Story = {
  args: {
    label: "Order",
    value: "default",
    options: [
      { value: "default", label: "Default" },
      { value: "name", label: "Name" },
      { value: "recent", label: "Recently updated" },
    ],
  },
};
