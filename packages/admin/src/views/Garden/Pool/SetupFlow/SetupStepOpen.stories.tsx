import type { Meta, StoryObj } from "@storybook/react";
import { daysFromNow, STORYBOOK_NOW_SECONDS } from "../../../../../../shared/.storybook/fixtures";
import { STORY_CYCLE_NAMES, storyPoolConsole } from "../poolStoryFixtures";
import { ALLOCATION_PRESETS, DEFAULT_RECOGNITION_PERCENT } from "./AllocationEditor";
import { SetupStepOpen } from "./SetupStepOpen";
import { DEFAULT_CAP, isoDate } from "./setupFlowModel";

const STORY_PURPOSE = storyPoolConsole().charter.charter?.purpose ?? "";

const meta: Meta<typeof SetupStepOpen> = {
  title: "Admin/Pool/SetupStepOpen",
  component: SetupStepOpen,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The last step: everything about to be written, read back before the steward commits to it. After the run it carries the outcome too, so a failure is named on the same screen the writes went out from.",
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
    failed: false,
    failure: null,
    landed: [],
    failedStep: null,
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

/** First run: the agreement, the limit, the season and the split, all at once. */
export const FirstRun: Story = {};

/** A campaign beside an open pool, so only the campaign is written. */
export const Campaign: Story = {
  args: {
    intent: "campaign",
    isCampaign: true,
    name: "Seedling swap",
    endDate: isoDate(daysFromNow(14)),
    poolStatus: "open",
  },
};

/** The run stopped part way; the summary stays put and names what landed. */
export const Failed: Story = {
  args: {
    intent: "season",
    poolStatus: "ready",
    failed: true,
    failure: "send-failed",
    landed: ["seedCycle", "openPool"],
    failedStep: "openCycle",
  },
};

/** Pool changes go straight to the chain, so the step says what a lost connection means. */
export const Offline: Story = {
  args: { intent: "season", poolStatus: "ready", isOnline: false },
};
