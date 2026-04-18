import type { Meta, StoryObj } from "@storybook/react";
import { RiLeafLine, RiTimeLine } from "@remixicon/react";
import { useState } from "react";
import { AdminFilterChip } from "./AdminFilterChip";

const meta: Meta<typeof AdminFilterChip> = {
  title: "Admin/AdminFilterChip",
  component: AdminFilterChip,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "M3 Filter Chip with selected/unselected states. Selected shows a leading checkmark; unselected shows an optional leading icon. Compact h-7 height for admin information density.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AdminFilterChip>;

export const Unselected: Story = {
  args: {
    label: "Pending",
    selected: false,
    leadingIcon: RiTimeLine,
    onToggle: () => {},
  },
};

export const Selected: Story = {
  args: {
    label: "Pending",
    selected: true,
    leadingIcon: RiTimeLine,
    onToggle: () => {},
  },
};

export const Disabled: Story = {
  args: {
    label: "Archived",
    selected: false,
    disabled: true,
    onToggle: () => {},
  },
};

export const FilterRow: Story = {
  render: () => {
    const Row = () => {
      const [active, setActive] = useState<Set<string>>(new Set(["pending"]));
      const toggle = (id: string) =>
        setActive((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      return (
        <div className="flex flex-wrap gap-2">
          <AdminFilterChip
            label="Pending"
            leadingIcon={RiTimeLine}
            selected={active.has("pending")}
            onToggle={() => toggle("pending")}
          />
          <AdminFilterChip
            label="Harvested"
            leadingIcon={RiLeafLine}
            selected={active.has("harvested")}
            onToggle={() => toggle("harvested")}
          />
          <AdminFilterChip
            label="Approved"
            selected={active.has("approved")}
            onToggle={() => toggle("approved")}
          />
        </div>
      );
    };
    return <Row />;
  },
};
