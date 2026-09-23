import type { Meta, StoryObj } from "@storybook/react";
import { SetupFailure } from "./SetupFailure";

const meta: Meta<typeof SetupFailure> = {
  title: "Admin/Pool/SetupFailure",
  component: SetupFailure,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Why a setup run stopped, in one sentence. Which writes landed is on the checklist above it, row by row. The retry note only appears where repeating the unlanded writes is safe, and says how many more times the wallet will ask.",
      },
    },
  },
  args: { isCampaign: false, remainingPrompts: 1 },
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SetupFailure>;

/** A send failed part way, so trying again resumes at the write that did not land. */
export const SendFailed: Story = {
  args: {
    failure: "send-failed",
  },
};

/** Stopped at the second of six writes: a retry still asks four more times. */
export const SeveralStillToSend: Story = {
  args: {
    failure: "send-failed",
    remainingPrompts: 4,
  },
};

/** No wallet was ready, so the run stopped before the first write. */
export const NothingLanded: Story = {
  args: { failure: "no-sender" },
};

/** The pool already holds a prepared cycle, so seeding a second one was refused. */
export const ExistingCycle: Story = {
  args: { failure: "existing-cycle" },
};

/** A campaign that was prepared but never opened; the wording follows the cycle type. */
export const CampaignNotConfirmed: Story = {
  args: {
    failure: "not-confirmed",
    isCampaign: true,
  },
};

/** The chain went unreadable mid-run; what landed still stands and a retry is safe. */
export const ReadFailed: Story = {
  args: {
    failure: "read-failed",
  },
};

/**
 * The seed went out and the run never learned whether it landed. No retry is
 * offered: a second seed would leave a second season behind.
 */
export const SeedUnconfirmed: Story = {
  args: {
    failure: "seed-unconfirmed",
  },
};
