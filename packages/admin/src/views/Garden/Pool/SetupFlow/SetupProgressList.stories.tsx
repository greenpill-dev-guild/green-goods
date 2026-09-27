import type { PoolSetupStepState } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPoolSetupSequence";
import type { Meta, StoryObj } from "@storybook/react";
import { SetupProgressList } from "./SetupProgressList";
import { previewRows, promptNumbers } from "./setupWrites";

const TX = `0x${"a".repeat(64)}` as `0x${string}`;

function rowsWith(statuses: PoolSetupStepState["status"][]): PoolSetupStepState[] {
  return previewRows("first-run", false).map((row, index) => ({
    ...row,
    status: statuses[index] ?? "pending",
    hash: statuses[index] === "landed" ? TX : null,
  }));
}

const meta: Meta<typeof SetupProgressList> = {
  title: "Admin/Pool/SetupProgressList",
  component: SetupProgressList,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Every write a pool setup sends, in order, with where each one stands. The same rows are read before the run and fill in during it; the number beside a row is the wallet prompt it rides in, so rows sharing a number are approved together.",
      },
    },
  },
  args: {
    rows: previewRows("first-run", false),
    numbers: promptNumbers(previewRows("first-run", false), false).numbers,
    isCampaign: false,
    chainId: 42161,
    showWhy: "all",
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SetupProgressList>;

/** Before the run: every write with its reason. */
export const Preview: Story = {};

/** A wallet that batches: five writes share prompt 1. */
export const Batched: Story = {
  args: { numbers: promptNumbers(previewRows("first-run", false), true).numbers },
};

/** Mid-run: two done, the third waiting in the wallet; only its reason shows. */
export const MidRun: Story = {
  args: { rows: rowsWith(["landed", "landed", "signing"]), showWhy: "current" },
};

/** A write the chain already showed is marked done without a prompt. */
export const AlreadyDone: Story = {
  args: { rows: rowsWith(["landed", "already", "confirming"]), showWhy: "current" },
};

/** Stopped at the opening: the row says where. */
export const Stopped: Story = {
  args: {
    rows: rowsWith(["landed", "landed", "landed", "landed", "landed", "failed"]),
    showWhy: "current",
  },
};
