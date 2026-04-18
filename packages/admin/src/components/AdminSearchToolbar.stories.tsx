import type { Meta, StoryObj } from "@storybook/react";
import { RiLeafLine, RiTimeLine } from "@remixicon/react";
import { useState } from "react";
import { AdminFilterChip } from "./AdminFilterChip";
import { AdminSearchToolbar } from "./AdminSearchToolbar";

const meta: Meta<typeof AdminSearchToolbar> = {
  title: "Admin/AdminSearchToolbar",
  component: AdminSearchToolbar,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "M3 Search Bar — 56dp pill, surface-container-high, elevation-3. Leading search icon, optional clear button, and a filter-chip row rendered via children.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AdminSearchToolbar>;

export const Empty: Story = {
  render: () => {
    const Demo = () => {
      const [search, setSearch] = useState("");
      return (
        <div className="max-w-xl">
          <AdminSearchToolbar
            search={search}
            onSearchChange={setSearch}
            placeholder="Search gardens"
          />
        </div>
      );
    };
    return <Demo />;
  },
};

export const WithQuery: Story = {
  render: () => {
    const Demo = () => {
      const [search, setSearch] = useState("north");
      return (
        <div className="max-w-xl">
          <AdminSearchToolbar
            search={search}
            onSearchChange={setSearch}
            placeholder="Search gardens"
          />
        </div>
      );
    };
    return <Demo />;
  },
};

export const WithFilterChips: Story = {
  render: () => {
    const Demo = () => {
      const [search, setSearch] = useState("");
      const [active, setActive] = useState<Set<string>>(new Set(["pending"]));
      const toggle = (id: string) =>
        setActive((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      return (
        <div className="max-w-xl">
          <AdminSearchToolbar
            search={search}
            onSearchChange={setSearch}
            placeholder="Search submissions"
          >
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
          </AdminSearchToolbar>
        </div>
      );
    };
    return <Demo />;
  },
};
