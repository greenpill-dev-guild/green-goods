import type { PoolSetupStepState } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPoolSetupSequence";
import type { Meta, StoryObj } from "@storybook/react";
import { daysFromNow, STORYBOOK_NOW_SECONDS } from "../../../../../../shared/.storybook/fixtures";
import { STORY_CYCLE_NAMES, storyPoolConsole } from "../poolStoryFixtures";
import { ALLOCATION_PRESETS, DEFAULT_RECOGNITION_PERCENT } from "./AllocationEditor";
import { SetupStepOpen } from "./SetupStepOpen";
import { DEFAULT_CAP, isoDate } from "./setupFlowModel";
import { previewRows, promptNumbers } from "./setupWrites";

const STORY_PURPOSE = storyPoolConsole().charter.charter?.purpose ?? "";
const TX = (n: number) => `0x${String(n).repeat(64).slice(0, 64)}` as `0x${string}`;

/** The first-run checklist with the first `landed` rows done and the next in `status`. */
function firstRunAt(
  landed: number,
  status: PoolSetupStepState["status"] | null
): PoolSetupStepState[] {
  return previewRows("first-run", false).map((row, index) => ({
    ...row,
    status: index < landed ? "landed" : index === landed && status ? status : "pending",
    hash: index < landed ? TX(index + 1) : null,
  }));
}

function oneAtATime(rows: PoolSetupStepState[]) {
  const prompts = promptNumbers(rows, false);
  return { rows, promptNumbers: prompts.numbers, promptTotal: prompts.total };
}

const meta: Meta<typeof SetupStepOpen> = {
  title: "Admin/Pool/SetupStepOpen",
  component: SetupStepOpen,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The last step: what is about to be written, how many times the wallet will ask, and then each write landing in place. The steward reads the checklist before pressing the button and watches the same rows fill in, so a pause between prompts never reads as a loop.",
      },
    },
  },
  args: {
    intent: "first-run",
    isCampaign: false,
    purpose: STORY_PURPOSE,
    cap: DEFAULT_CAP,
    cycle: null,
    cycleNames: STORY_CYCLE_NAMES,
    name: "Season of First Rains",
    startDate: isoDate(STORYBOOK_NOW_SECONDS),
    endDate: isoDate(daysFromNow(30)),
    allocation: ALLOCATION_PRESETS.model1,
    recognition: DEFAULT_RECOGNITION_PERCENT,
    poolStatus: "not-ready",
    pinFailure: null,
    phase: "ready",
    failure: null,
    ...oneAtATime(previewRows("first-run", false)),
    gardenName: "Rocinha",
    chainId: 42161,
    isOnline: true,
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
type Story = StoryObj<typeof SetupStepOpen>;

/** Before the run: six writes, six wallet prompts, each with its reason. */
export const FirstRun: Story = {};

/** A wallet that batches: the first five share one approval, the opening follows. */
export const FirstRunBatched: Story = {
  args: (() => {
    const rows = previewRows("first-run", false);
    const prompts = promptNumbers(rows, true);
    return { rows, promptNumbers: prompts.numbers, promptTotal: prompts.total };
  })(),
};

/** Two writes landed; the third is waiting for the steward in the wallet. */
export const WaitingForWallet: Story = {
  args: { phase: "running", ...oneAtATime(firstRunAt(2, "signing")) },
};

/** The third write was approved and is confirming on chain. */
export const Confirming: Story = {
  args: { phase: "running", ...oneAtATime(firstRunAt(2, "confirming")) },
};

/** Five landed and the opening did not: the row says where, the notice says why. */
export const Stopped: Story = {
  args: {
    phase: "stopped",
    failure: "send-failed",
    ...oneAtATime(firstRunAt(5, "failed")),
  },
};

/** Done: what is live now, with every write ticked and linked. */
export const Done: Story = {
  args: { phase: "done", ...oneAtATime(firstRunAt(6, null)) },
};

/** A campaign beside an open season: prepare it, then open it, so two prompts. */
export const Campaign: Story = {
  args: {
    intent: "campaign",
    isCampaign: true,
    name: "Seedling swap",
    endDate: isoDate(daysFromNow(14)),
    poolStatus: "open",
    ...oneAtATime(previewRows("campaign", true)),
  },
};

/** Pool changes go straight to the chain, so the step says what a lost connection means. */
export const Offline: Story = {
  args: {
    intent: "season",
    poolStatus: "ready",
    isOnline: false,
    ...oneAtATime(previewRows("season", false)),
  },
};
