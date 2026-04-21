import type { Meta, StoryObj } from "@storybook/react";
import { RiCheckboxCircleLine, RiLeafLine, RiListCheck2, RiTimeLine } from "@remixicon/react";
import { useState } from "react";
import { AdminTabRail } from "./AdminTabRail";

const meta: Meta<typeof AdminTabRail> = {
  title: "Admin/Primitives/AdminTabRail",
  component: AdminTabRail,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "M3 Primary Navigation Tabs with sliding 3dp active indicator underline and spring animation. Compact 36dp (label) / 40dp (icon + label) density for admin views. Accepts the same contract as the shared stage tab rail.",
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
        <div className="max-w-xl">
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
        </div>
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
        <div className="max-w-2xl">
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
        </div>
      );
    };
    return <Demo />;
  },
};

export const WithDisabledTab: Story = {
  render: () => {
    const Demo = () => {
      const [active, setActive] = useState("overview");
      return (
        <div className="max-w-xl">
          <AdminTabRail
            ariaLabel="Sections"
            activeId={active}
            onChange={setActive}
            tabs={[
              { id: "overview", label: "Overview" },
              { id: "impact", label: "Impact" },
              { id: "treasury", label: "Treasury", disabled: true },
            ]}
          />
        </div>
      );
    };
    return <Demo />;
  },
};
