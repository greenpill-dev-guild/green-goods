import type { Meta, StoryObj } from "@storybook/react";
import { SeedFlowFooter } from "./SeedFlowFooter";

const noop = () => undefined;

const meta: Meta<typeof SeedFlowFooter> = {
  title: "Admin/Pool/SeedFlowFooter",
  component: SeedFlowFooter,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The pinned footer of the seeding console. The left button leaves on the first step and goes back on every other; the right one carries the steward forward until the review, where it becomes the single seed action. While a creation is being queued the whole row is held and the progress bar takes over the left.",
      },
    },
  },
  args: {
    busy: false,
    title: "Seed a commitment",
    stepIndex: 0,
    isLast: false,
    seedDisabled: false,
    onCancel: noop,
    onBack: noop,
    onNext: noop,
    onSeed: noop,
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SeedFlowFooter>;

export const FirstStep: Story = {};

export const MiddleStep: Story = { args: { stepIndex: 1 } };

export const ReadyToSeed: Story = { args: { stepIndex: 3, isLast: true } };

export const Queuing: Story = { args: { stepIndex: 3, isLast: true, busy: true } };
