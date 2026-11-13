import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { type LabControls, ReviewerBar } from "./ReviewerBar";

const START: LabControls = {
  scenario: "compost",
  view: "overview",
  role: "steward",
  nameId: "current",
  hubLabel: "hub",
  panel: "none",
};

function BarDemo({ initial }: { initial?: Partial<LabControls> }) {
  const [controls, setControls] = useState<LabControls>({ ...START, ...initial });
  return (
    <ReviewerBar
      controls={controls}
      onChange={(patch) => setControls((current) => ({ ...current, ...patch }))}
    />
  );
}

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/ReviewerBar",
  component: ReviewerBar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The lab's reviewer controls, kept apart from the product preview: scenario, interface, viewer role and naming candidate. Notes and the naming preview open right under the controls that change them. Not product UI.",
      },
    },
  },
  decorators: [withCanvasFrame({ workspace: "garden", className: "p-0" })],
  args: { controls: START, onChange: () => undefined },
} satisfies Meta<typeof ReviewerBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Controls: Story = { render: () => <BarDemo /> };

export const CalendarNotes: Story = {
  render: () => <BarDemo initial={{ view: "calendar", panel: "notes" }} />,
};

export const Naming: Story = {
  render: () => <BarDemo initial={{ panel: "naming", nameId: "garden-hub" }} />,
};
