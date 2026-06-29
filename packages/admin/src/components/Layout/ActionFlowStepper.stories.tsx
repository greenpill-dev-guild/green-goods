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
          "Progress stepper for the admin action flows. Horizontal (compact dots + connectors + a " +
          "'Step N of M · Label' line) sits in the ActionFlowShell header on mobile; vertical (labelled " +
          "rail) sits in the desktop step-rail. The accent follows the workspace tone (Hub blue / Garden " +
          "green / …) — see HubToned; completed steps fill with a check and connectors grow a tone fill " +
          "as each step completes.",
      },
    },
  },
} satisfies Meta<typeof ActionFlowStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstStep: Story = { args: { currentStep: 1 } };
export const MidFlow: Story = { args: { currentStep: 2 } };
export const Completed: Story = { args: { currentStep: 4 } };

// Vertical orientation — the labelled rail used in the desktop two-column layout.
export const VerticalRail: Story = {
  args: { orientation: "vertical", currentStep: 2 },
};

// Accent follows the workspace tone: under data-tone="hub" the stepper renders
// blue (Garden green, Community orange, Actions red), not the green fallback.
export const HubToned: Story = {
  args: { currentStep: 2 },
  decorators: [
    (Story) => (
      <div className="admin-m3" data-tone="hub">
        <Story />
      </div>
    ),
  ],
};
