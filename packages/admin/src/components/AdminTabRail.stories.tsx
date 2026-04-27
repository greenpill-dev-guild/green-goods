import { RiCheckboxCircleLine, RiLeafLine, RiListCheck2, RiTimeLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminTabRail } from "./AdminTabRail";

const meta: Meta<typeof AdminTabRail> = {
  title: "Admin/Primitives/AdminTabRail",
  component: AdminTabRail,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "M3 primary tabs with 48dp tab height, surface container, bottom divider, sliding 3dp active indicator, optional icons, disabled tabs, and count badges.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AdminTabRail>;

export const LabelsOnly: Story = {
  render: () => {
    const Demo = () => {
      const [active, setActive] = useState("overview");
      return (
        <AdminTabRail
          ariaLabel="Garden sections"
          activeId={active}
          onChange={setActive}
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "impact", label: "Impact" },
            { id: "work", label: "Work" },
            { id: "community", label: "Community" },
          ]}
        />
      );
    };
    return <Demo />;
  },
};

export const WithIconsAndCounts: Story = {
  render: () => {
    const Demo = () => {
      const [active, setActive] = useState("pending");
      return (
        <AdminTabRail
          ariaLabel="Work queue"
          activeId={active}
          onChange={setActive}
          tabs={[
            { id: "pending", label: "Pending", icon: RiTimeLine, count: 14 },
            { id: "harvested", label: "Harvested", icon: RiLeafLine, count: 3 },
            { id: "approved", label: "Approved", icon: RiCheckboxCircleLine, count: 42 },
            { id: "all", label: "All", icon: RiListCheck2 },
          ]}
        />
      );
    };
    return <Demo />;
  },
};

export const NarrowActionsLifecycle: Story = {
  tags: ["storybook-ci"],
  render: () => {
    const Demo = () => {
      const [active, setActive] = useState("active");
      return (
        <div className="w-[428px] max-w-full overflow-hidden">
          <AdminTabRail
            ariaLabel="Filter actions by lifecycle"
            activeId={active}
            onChange={setActive}
            tabs={[
              { id: "all", label: "All", count: 22 },
              { id: "active", label: "Active", count: 8 },
              { id: "upcoming", label: "Upcoming", count: 10 },
              { id: "completed", label: "Completed", count: 4 },
            ]}
          />
        </div>
      );
    };
    return <Demo />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tablist = await canvas.findByRole("tablist", {
      name: "Filter actions by lifecycle",
    });

    await expect(tablist.scrollWidth).toBeLessThanOrEqual(tablist.clientWidth + 1);
  },
};

export const StateCatalog: Story = {
  render: () => {
    const Demo = () => {
      const [active, setActive] = useState("overview");
      return (
        <AdminTabRail
          ariaLabel="Sections"
          activeId={active}
          onChange={setActive}
          tabs={[
            { id: "overview", label: "Overview", count: 2 },
            { id: "impact", label: "Impact", icon: RiLeafLine },
            { id: "treasury", label: "Treasury", disabled: true },
            { id: "history", label: "History", count: 128 },
          ]}
        />
      );
    };
    return <Demo />;
  },
};
