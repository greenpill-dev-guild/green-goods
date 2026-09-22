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
          "The pinned footer of the seeding console. The left button leaves on the first step and goes back on every other; the right one carries the steward forward until the review. There it becomes the seed action, beside Add Another Like This, which keeps the reviewed commitment and starts the next from the same answers. Once more than one is waiting, the seed action counts them. While creations are being sent the whole row is held and the progress bar takes over the left.",
      },
    },
  },
  args: {
    busy: false,
    title: "Seed a Commitment",
    stepIndex: 0,
    isLast: false,
    seedDisabled: false,
    count: 1,
    addAnotherDisabled: false,
    onCancel: noop,
    onBack: noop,
    onNext: noop,
    onAddAnother: noop,
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

export const ReadyToCreateSeveral: Story = { args: { stepIndex: 3, isLast: true, count: 3 } };

/** Another offer would be one more than the steward may hold open at once. */
export const NoRoomForAnother: Story = {
  args: { stepIndex: 3, isLast: true, count: 3, addAnotherDisabled: true },
};

export const Queuing: Story = { args: { stepIndex: 3, isLast: true, busy: true } };
