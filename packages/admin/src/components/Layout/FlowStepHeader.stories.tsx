import type { Meta, StoryObj } from "@storybook/react";
import { FlowStepHeader } from "./FlowStepHeader";

const meta = {
  title: "Admin/Shell/FlowStepHeader",
  component: FlowStepHeader,
  tags: ["autodocs"],
  args: {
    title: "Choose an Action",
    description: "Pick the action this work belongs to.",
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl rounded-xl border border-stroke-soft bg-bg-white p-4">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Step title + subtitle block at the top of an action-flow step body (Submit Work, " +
          "Create Assessment, Create Hypercert). One component so the three flows share the same " +
          "heading scale: h2 'text-base font-semibold' over a 'text-sm' subtitle. The flow-level " +
          "h1 lives in ActionFlowShell's pinned header, not here.",
      },
    },
  },
} satisfies Meta<typeof FlowStepHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TitleAndDescription: Story = {};

// Steps without a subtitle render the h2 alone — no reserved empty line.
export const TitleOnly: Story = {
  args: { title: "Review", description: undefined },
};

// Long dynamic content (action-metadata titles) wraps instead of truncating —
// the step header is part of the reading column, not chrome.
export const LongContent: Story = {
  args: {
    title: "Document tree planting, harvests, and land stewardship across the whole season",
    description:
      "Add at least three photos that show the planted saplings, the mulched beds, and the " +
      "compost system so evaluators can verify the work.",
  },
};
