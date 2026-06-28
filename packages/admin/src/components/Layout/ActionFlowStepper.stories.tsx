import type { Meta, StoryObj } from "@storybook/react";
import { ActionFlowStepper } from "./ActionFlowStepper";

const STEPS = [
  { id: "action", title: "Action" },
  { id: "media", title: "Media" },
  { id: "details", title: "Details" },
  { id: "review", title: "Review" },
];

const meta = {
  title: "Admin/Shell/ActionFlowStepper",
  component: ActionFlowStepper,
  tags: ["autodocs"],
  args: { steps: STEPS, currentStep: 2 },
  decorators: [
    (Story) => (
      <div className="max-w-sm rounded-xl border border-stroke-soft bg-bg-white p-4">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Compact progress stepper for the admin action flows — numbered dots + connectors with " +
          "a 'Step N of M · Label' orientation line. The current step takes the admin selectable-card " +
          "tint, completed steps fill with a check, and each connector grows a green fill as its step " +
          "completes. Lives in the ActionFlowShell header.",
      },
    },
  },
} satisfies Meta<typeof ActionFlowStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstStep: Story = { args: { currentStep: 1 } };
export const MidFlow: Story = { args: { currentStep: 2 } };
export const Completed: Story = { args: { currentStep: 4 } };
