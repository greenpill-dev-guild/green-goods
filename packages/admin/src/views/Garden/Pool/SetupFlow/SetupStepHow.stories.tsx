import type { Meta, StoryObj } from "@storybook/react";
import { type ComponentProps, useState } from "react";
import { storyPoolConsole } from "../poolStoryFixtures";
import { SetupStepHow } from "./SetupStepHow";
import { DEFAULT_CAP } from "./setupFlowModel";

/** The step is controlled by the flow; the story holds the words and the limit. */
function SetupStepHowWithValues(props: ComponentProps<typeof SetupStepHow>) {
  const [purpose, setPurpose] = useState(props.purpose);
  const [cap, setCap] = useState(props.cap);
  return (
    <SetupStepHow
      purposeId={props.purposeId}
      purpose={purpose}
      onPurposeChange={setPurpose}
      cap={cap}
      onCapChange={setCap}
      disabled={props.disabled}
    />
  );
}

const STORY_PURPOSE = storyPoolConsole().charter.charter?.purpose ?? "";

const meta: Meta<typeof SetupStepHow> = {
  title: "Admin/Pool/SetupStepHow",
  component: SetupStepHow,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The first step of first-run setup: what this pool is for, in the steward's own words, and how many commitments one person may hold at once. Both are required before the flow moves on.",
      },
    },
  },
  args: {
    purposeId: "pool-setup-purpose",
    purpose: "",
    cap: DEFAULT_CAP,
    disabled: false,
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
  render: (args) => <SetupStepHowWithValues {...args} />,
};

export default meta;
type Story = StoryObj<typeof SetupStepHow>;

/** A pool nobody has described yet: the placeholder carries the example. */
export const Empty: Story = {};

/** Re-opening the flow on a pool that already has an agreement written. */
export const Prefilled: Story = {
  args: { purpose: STORY_PURPOSE, cap: "24" },
};

/** Every field locks while the writes go out, so nothing changes mid-run. */
export const Submitting: Story = {
  args: { purpose: STORY_PURPOSE, cap: "24", disabled: true },
};
