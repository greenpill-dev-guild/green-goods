import { RiPlantLine, RiRecycleLine, RiShieldCheckLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { WorkbenchRow } from "./WorkbenchRow";

const meta: Meta<typeof WorkbenchRow> = {
  title: "Shared/Canvas/WorkbenchRow",
  component: WorkbenchRow,
  tags: ["autodocs"],
  args: {
    eyebrow: "Review",
    title: "River bank cleanup",
    description: "Cleared plastic waste with photos, GPS notes, and contributor details.",
    meta: ["Jardim Botafogo", "2 photos", "4h field work"],
    statusLabel: "Pending",
    statusTone: "pending",
    leadingIcon: RiRecycleLine,
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
      description: "Optional thumbnail image URL.",
    },
    meta: {
      control: "object",
      description: "Small metadata pills shown under the description.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof WorkbenchRow>;

export const Default: Story = {};

export const Selected: Story = {
  args: {
    selected: true,
  },
};

export const Approved: Story = {
  args: {
    eyebrow: "Assessment",
    title: "Agroforestry plot survey",
    description: "Assessment score has enough evidence for certification.",
    meta: ["Comunidad Verde", "High confidence"],
    statusLabel: "Approved",
    statusTone: "approved",
    leadingIcon: RiPlantLine,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    eyebrow: "History",
    title: "Archived field note",
    description: "This row is read-only because the work item is closed.",
    statusLabel: "Closed",
    statusTone: "history",
    leadingIcon: RiShieldCheckLine,
  },
};
