import { RiLeafLine, RiTimeLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminFilterChip } from "./AdminFilterChip";
import { AdminSearchToolbar } from "./AdminSearchToolbar";

const meta: Meta<typeof AdminSearchToolbar> = {
  title: "Admin/Primitives/AdminSearchToolbar",
  component: AdminSearchToolbar,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "M3 search bar with 56dp pill, surface-container-high, elevation-3, 24dp search icon, 40dp clear target, and optional filter chips.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AdminSearchToolbar>;

function SearchDemo({
  initialSearch = "",
  withFilters = false,
}: {
  initialSearch?: string;
  withFilters?: boolean;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [active, setActive] = useState<Set<string>>(new Set(["pending"]));
  const toggle = (id: string) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <AdminSearchToolbar search={search} onSearchChange={setSearch} placeholder="Search submissions">
      {withFilters ? (
        <>
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
            label="Archived"
            selected={active.has("archived")}
            onToggle={() => toggle("archived")}
          />
        </>
      ) : null}
    </AdminSearchToolbar>
  );
}

export const Empty: Story = {
  render: () => <SearchDemo />,
};

export const WithQuery: Story = {
  render: () => <SearchDemo initialSearch="north" />,
};

export const WithFilterChips: Story = {
  render: () => <SearchDemo withFilters />,
};

export const StateCatalog: Story = {
  render: () => (
    <div className="space-y-5">
      <SearchDemo />
      <SearchDemo initialSearch="canopy" withFilters />
    </div>
  ),
};
