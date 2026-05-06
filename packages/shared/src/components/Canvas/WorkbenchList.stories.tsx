import { RiLeafLine, RiPlantLine, RiRecycleLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { WorkbenchList } from "./WorkbenchList";
import { WorkbenchRow } from "./WorkbenchRow";

const rows = [
  {
    eyebrow: "Review",
    title: "River bank cleanup",
    description: "Evidence package ready for operator review.",
    meta: ["Jardim Botafogo", "2 photos", "4h field work"],
    statusLabel: "Pending",
    statusTone: "pending" as const,
    leadingIcon: RiRecycleLine,
  },
  {
    eyebrow: "Assessment",
    title: "Agroforestry plot survey",
    description: "Assessment score is approved and ready for certification.",
    meta: ["Comunidad Verde", "High confidence"],
    statusLabel: "Approved",
    statusTone: "approved" as const,
    leadingIcon: RiPlantLine,
  },
  {
    eyebrow: "Certify",
    title: "Solar inverter installation",
    description: "Minting handoff prepared for the selected garden.",
    meta: ["Solar", "3 contributors"],
    statusLabel: "Ready",
    statusTone: "certify" as const,
    leadingIcon: RiLeafLine,
  },
];

const meta: Meta<typeof WorkbenchList> = {
  title: "Shared/Canvas/WorkbenchList",
  component: WorkbenchList,
  tags: ["autodocs"],
  argTypes: {
    children: {
      control: false,
      description: "Workbench rows or related list content.",
    },
    className: {
      control: "text",
      description: "Additional classes for the list wrapper.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof WorkbenchList>;

export const Default: Story = {
  render: (args) => (
    <div className="max-w-4xl">
      <WorkbenchList {...args}>
        {rows.map((row, index) => (
          <WorkbenchRow key={row.title} {...row} selected={index === 0} onClick={fn()} />
        ))}
      </WorkbenchList>
    </div>
  ),
};

export const Empty: Story = {
  render: (args) => (
    <div className="max-w-4xl">
      <WorkbenchList {...args}>
        <div className="p-6 text-center text-sm font-semibold text-text-sub">
          No submissions match this filter.
        </div>
      </WorkbenchList>
    </div>
  ),
};
