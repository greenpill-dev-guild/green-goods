import { RiFileListLine, RiSeedlingLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Button } from "./Button";
import { EmptyState, ListToolbar, SortSelect } from "./ListPrimitives";

function ToolbarPreview() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");

  return (
    <ListToolbar search={search} onSearchChange={setSearch}>
      <SortSelect
        value={sort}
        onChange={setSort}
        options={[
          { value: "recent", label: "Most recent" },
          { value: "name", label: "Name" },
        ]}
      />
      <Button size="sm" variant="secondary">
        Export
      </Button>
    </ListToolbar>
  );
}

const meta: Meta<typeof ListToolbar> = {
  title: "Shared/Primitives/ListPrimitives",
  component: ListToolbar,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Shared foundations for admin list pages: search toolbar, native sort/select control, and empty-state treatment.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ListToolbar>;

export const Toolbar: Story = {
  render: () => <ToolbarPreview />,
};

export const Empty: Story = {
  render: () => (
    <EmptyState
      icon={<RiSeedlingLine className="h-6 w-6" />}
      title="No gardens match your filters"
      description="Reset filters or broaden your search to see more results."
      action={{ label: "Reset filters", onClick: () => undefined }}
    />
  ),
};

export const EmptyWithoutAction: Story = {
  render: () => (
    <EmptyState
      icon={<RiFileListLine className="h-6 w-6" />}
      title="No actions yet"
      description="Actions will appear here once they have been created."
    />
  ),
};
