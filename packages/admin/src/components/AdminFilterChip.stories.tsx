import { RiLeafLine, RiTimeLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminFilterChip } from "./AdminFilterChip";

const meta: Meta<typeof AdminFilterChip> = {
  title: "Admin/Primitives/AdminFilterChip",
  component: AdminFilterChip,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "M3 filter chip with 32dp height, outlined unselected state, selected secondary-container fill, optional leading icon, and selected checkmark.",
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

export const StateCatalog: Story = {
  render: () => {
    const Catalog = () => {
      const [active, setActive] = useState<Set<string>>(new Set(["pending", "approved"]));
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
          <AdminFilterChip label="Archived" selected={false} disabled onToggle={() => {}} />
        </div>
      );
    };

    return <Catalog />;
  },
};
