import type { Meta, StoryObj } from "@storybook/react";
import { RiArrowRightSLine, RiLeafLine, RiUserLine } from "@remixicon/react";
import { AdminListItem } from "./AdminListItem";

const meta: Meta<typeof AdminListItem> = {
  title: "Admin/AdminListItem",
  component: AdminListItem,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "M3 List Item with auto-detected line count. 1-line (56dp) is label only, 2-line (72dp) adds supportingText, 3-line (88dp) adds overline or long supporting text. Renders as <button> when onClick is provided.",
      },
    },
  },
  argTypes: {
    selected: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof AdminListItem>;

export const OneLine: Story = {
  args: { label: "Settings", leadingIcon: RiUserLine, trailingIcon: RiArrowRightSLine },
  render: (args) => (
    <div className="max-w-md rounded-[var(--m3-shape-md)] bg-[rgb(var(--m3-surface-container-low))]">
      <AdminListItem {...args} onClick={() => {}} />
    </div>
  ),
};

export const TwoLine: Story = {
  args: {
    label: "North Meadow Garden",
    supportingText: "12 active gardeners · 3 pending reviews",
    leadingIcon: RiLeafLine,
    trailingIcon: RiArrowRightSLine,
  },
  render: (args) => (
    <div className="max-w-md rounded-[var(--m3-shape-md)] bg-[rgb(var(--m3-surface-container-low))]">
      <AdminListItem {...args} onClick={() => {}} />
    </div>
  ),
};

export const ThreeLine: Story = {
  args: {
    overline: "Garden · Sepolia",
    label: "North Meadow Garden",
    supportingText:
      "A regenerative pilot in the Pacific Northwest with 12 active gardeners, 3 pending reviews, and 2 endowments.",
    leadingIcon: RiLeafLine,
    trailingIcon: RiArrowRightSLine,
  },
  render: (args) => (
    <div className="max-w-md rounded-[var(--m3-shape-md)] bg-[rgb(var(--m3-surface-container-low))]">
      <AdminListItem {...args} onClick={() => {}} />
    </div>
  ),
};

export const Selected: Story = {
  args: {
    label: "Selected item",
    supportingText: "Highlighted with primary/8 tint",
    selected: true,
    leadingIcon: RiLeafLine,
  },
  render: (args) => (
    <div className="max-w-md rounded-[var(--m3-shape-md)] bg-[rgb(var(--m3-surface-container-low))]">
      <AdminListItem {...args} onClick={() => {}} />
    </div>
  ),
};

export const List: Story = {
  render: () => (
    <div className="max-w-md divide-y divide-[rgb(var(--m3-outline-variant))] rounded-[var(--m3-shape-md)] bg-[rgb(var(--m3-surface-container-low))]">
      <AdminListItem
        label="Alice"
        supportingText="alice@example.org"
        leadingIcon={RiUserLine}
        trailingText="Gardener"
        onClick={() => {}}
      />
      <AdminListItem
        label="Bob"
        supportingText="bob@example.org"
        leadingIcon={RiUserLine}
        trailingText="Steward"
        selected
        onClick={() => {}}
      />
      <AdminListItem
        label="Charlie"
        supportingText="charlie@example.org"
        leadingIcon={RiUserLine}
        disabled
      />
    </div>
  ),
};
