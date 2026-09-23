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
          "The pinned footer of the seeding console. The left button leaves on the first step and goes back on every other; the right one carries the steward forward until the review. There it becomes the seed action, beside Add Another Like This, and says how many times the wallet will ask. Once more than one is waiting, the seed action counts them. While creations are being sent the row is held; once the pass is over it offers Done, or Back to Review and Try Again when rows were not sent.",
      },
    },
  },
  args: {
    phase: "compose",
    busy: false,
    stepIndex: 0,
    isLast: false,
    seedDisabled: false,
    count: 1,
    addAnotherDisabled: false,
    unsent: false,
    onCancel: noop,
    onBack: noop,
    onNext: noop,
    onAddAnother: noop,
    onSeed: noop,
    onDone: noop,
    onBackToTray: noop,
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

export const ReadyToCreateSeveral: Story = { args: { stepIndex: 3, isLast: true, count: 3 } };

/** Another offer would be one more than the steward may hold open at once. */
export const NoRoomForAnother: Story = {
  args: { stepIndex: 3, isLast: true, count: 3, addAnotherDisabled: true },
};

export const Sending: Story = {
  args: { phase: "sending", stepIndex: 3, isLast: true, count: 3, busy: true },
};

/** Every row was created or will send later: the wizard can close. */
export const Done: Story = { args: { phase: "done", stepIndex: 3, isLast: true } };

/** A row was not sent: go back to it, or try again. */
export const DoneWithUnsent: Story = {
  args: { phase: "done", stepIndex: 3, isLast: true, unsent: true },
};
