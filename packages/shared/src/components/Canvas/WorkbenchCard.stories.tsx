import { RiFileListLine, RiPlantLine, RiRecycleLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { WorkbenchCard } from "./WorkbenchCard";

const meta: Meta<typeof WorkbenchCard> = {
  title: "Shared/Canvas/WorkbenchCard",
  component: WorkbenchCard,
  tags: ["autodocs"],
  args: {
    eyebrow: "Agroforestry",
    title: "River bank cleanup",
    description: "Cleared plastic waste with photos, GPS notes, and contributor details.",
    meta: ["Jan 4 – Mar 2", "6 fields", "3 capital forms"],
    statusLabel: "Active",
    statusTone: "approved",
    leadingIcon: RiFileListLine,
    selected: false,
    disabled: false,
    onClick: fn(),
  },
  argTypes: {
    statusTone: {
      control: "select",
      options: ["pending", "approved", "certify", "history"],
    },
    leadingIcon: {
      control: false,
      description: "Remixicon component rendered when no thumbnail is supplied.",
    },
    thumbnailSrc: {
      control: "text",
      description: "Optional thumbnail image URL shown in place of the icon tile.",
    },
    meta: {
      control: "object",
      description: "Small metadata pills shown beneath the title.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof WorkbenchCard>;

export const Default: Story = {};

export const Selected: Story = {
  args: { selected: true },
};

export const Pending: Story = {
  args: {
    eyebrow: "Waste",
    title: "Community compost build",
    description: "Awaiting reviewer sign-off before the action opens for submissions.",
    meta: ["Upcoming", "4 fields"],
    statusLabel: "Upcoming",
    statusTone: "pending",
    leadingIcon: RiRecycleLine,
  },
};

/**
 * The registry grid — the consuming view authors the `grid-cols-*` container so
 * Tailwind reaches the utilities; the card fills each cell with `h-full`.
 */
export const Grid: Story = {
  render: (args) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <WorkbenchCard {...args} />
      <WorkbenchCard
        {...args}
        eyebrow="Agroforestry"
        title="Native canopy planting"
        description="Restoring shade trees along the eastern ridge with seedling tracking."
        meta={["Active", "8 fields"]}
        statusLabel="Active"
        statusTone="approved"
        leadingIcon={RiPlantLine}
      />
      <WorkbenchCard
        {...args}
        eyebrow="Waste"
        title="Shoreline plastic audit"
        description="Completed multi-week audit with weight logs and disposal receipts."
        meta={["Completed", "12 fields"]}
        statusLabel="Completed"
        statusTone="history"
        leadingIcon={RiRecycleLine}
      />
    </div>
  ),
};
