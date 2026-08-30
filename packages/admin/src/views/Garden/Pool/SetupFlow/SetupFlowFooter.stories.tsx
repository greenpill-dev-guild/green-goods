import type { Meta, StoryObj } from "@storybook/react";
import { SetupFlowFooter } from "./SetupFlowFooter";

const meta: Meta<typeof SetupFlowFooter> = {
  title: "Admin/Pool/SetupFlowFooter",
  component: SetupFlowFooter,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The setup flow's one action row: how far the run has got, the way back, and the way on. The first step offers Cancel, the last one offers the write, and a failure that is safe to repeat swaps it for Try again.",
      },
    },
  },
  args: {
    title: "Set Up Commitments",
    intent: "first-run",
    isCampaign: false,
    stepIndex: 0,
    isLast: false,
    submitting: false,
    canContinue: true,
    failed: false,
    retryable: false,
    isOnline: true,
    onBack: () => undefined,
    onNext: () => undefined,
    onSubmit: () => undefined,
    onRetry: () => undefined,
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
type Story = StoryObj<typeof SetupFlowFooter>;

/** Step one: leaving the flow is the way back, and Next waits on a complete step. */
export const FirstStep: Story = {};

/** A step in the middle, with nothing typed yet, so Next stays out of reach. */
export const Incomplete: Story = {
  args: { stepIndex: 1, canContinue: false },
};

/** The last step names the write it is about to make. */
export const LastStep: Story = {
  args: { stepIndex: 3, isLast: true },
};

/** The writes are going out: the progress bar runs and nothing else moves. */
export const Submitting: Story = {
  args: { stepIndex: 3, isLast: true, submitting: true },
};

/** A run that stopped where repeating the unlanded write is safe. */
export const Retryable: Story = {
  args: { stepIndex: 3, isLast: true, failed: true, retryable: true },
};
