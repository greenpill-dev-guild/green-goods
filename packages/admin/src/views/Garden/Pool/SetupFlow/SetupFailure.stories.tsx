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
          "A stopped setup run, read back to the steward: why it stopped, which writes already landed, and which one did not. The retry note only appears where repeating the unlanded write is safe.",
      },
    },
  },
  args: { isCampaign: false, landed: [], failedStep: null },
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

/** Three writes landed and the fourth did not, so trying again resumes there. */
export const PartlyLanded: Story = {
  args: {
    failure: "send-failed",
    landed: ["setPoolCharter", "setProviderOpenCommitmentCap", "markPoolReady"],
    failedStep: "seedCycle",
  },
};

/** No wallet was ready, so the run stopped before the first write. */
export const NothingLanded: Story = {
  args: { failure: "no-sender", landed: [], failedStep: null },
};

/** The pool already holds a prepared cycle, so seeding a second one was refused. */
export const ExistingCycle: Story = {
  args: { failure: "existing-cycle", landed: [], failedStep: "seedCycle" },
};

/** A campaign that was prepared but never opened; the wording follows the cycle type. */
export const CampaignNotConfirmed: Story = {
  args: {
    failure: "not-confirmed",
    isCampaign: true,
    landed: ["seedCycle"],
    failedStep: "openCycle",
  },
};

/** The chain went unreadable mid-run; the landed list still stands and a retry is safe. */
export const ReadFailed: Story = {
  args: {
    failure: "read-failed",
    landed: ["setPoolCharter", "setProviderOpenCommitmentCap"],
    failedStep: "markPoolReady",
  },
};

/**
 * The seed went out and the run never learned whether it landed. No retry is
 * offered: a second seed would leave a second season behind.
 */
export const SeedUnconfirmed: Story = {
  args: {
    failure: "seed-unconfirmed",
    landed: ["setPoolCharter", "setProviderOpenCommitmentCap", "markPoolReady"],
    failedStep: "seedCycle",
  },
};
