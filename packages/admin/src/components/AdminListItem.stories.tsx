import { RiArrowRightSLine, RiLeafLine, RiUserLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminListItem } from "./AdminListItem";

const meta: Meta<typeof AdminListItem> = {
  title: "Admin/Primitives/AdminListItem",
  component: AdminListItem,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "M3 list item with 1-line, 2-line, and 3-line heights. Renders as a button when an action is provided.",
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

function ListSurface({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-xl overflow-hidden rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container-low))]">
      {children}
    </div>
  );
}

export const OneLine: Story = {
  args: { label: "Settings", leadingIcon: RiUserLine, trailingIcon: RiArrowRightSLine },
  render: (args) => (
    <ListSurface>
      <AdminListItem {...args} onClick={() => {}} />
    </ListSurface>
  ),
};

export const TwoLine: Story = {
  args: {
    label: "North Meadow Garden",
    supportingText: "12 active gardeners, 3 pending reviews",
    leadingIcon: RiLeafLine,
    trailingIcon: RiArrowRightSLine,
  },
  render: (args) => (
    <ListSurface>
      <AdminListItem {...args} onClick={() => {}} />
    </ListSurface>
  ),
};

export const ThreeLine: Story = {
  args: {
    overline: "Garden / Sepolia",
    label: "North Meadow Garden",
    supportingText:
      "A regenerative pilot with active field work, pending reviews, and recurring treasury coordination.",
    leadingIcon: RiLeafLine,
    trailingIcon: RiArrowRightSLine,
  },
  render: (args) => (
    <ListSurface>
      <AdminListItem {...args} onClick={() => {}} />
    </ListSurface>
  ),
};

export const StateCatalog: Story = {
  render: () => (
    <ListSurface>
      <AdminListItem
        label="Alice"
        supportingText="alice@example.org"
        leadingIcon={RiUserLine}
        trailingText="Gardener"
        onClick={() => {}}
      />
      <div className="h-px bg-[rgb(var(--m3-outline-variant))]" />
      <AdminListItem
        label="Bob"
        supportingText="bob@example.org"
        leadingIcon={RiUserLine}
        trailingText="Steward"
        selected
        onClick={() => {}}
      />
      <div className="h-px bg-[rgb(var(--m3-outline-variant))]" />
      <AdminListItem
        label="Charlie"
        supportingText="charlie@example.org"
        leadingIcon={RiUserLine}
        trailingText="Disabled"
        disabled
      />
    </ListSurface>
  ),
};
