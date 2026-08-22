import type { Meta, StoryObj } from "@storybook/react";
import { type ComponentProps, useState } from "react";
import { daysFromNow, STORYBOOK_NOW_SECONDS } from "../../../../../../shared/.storybook/fixtures";
import { STORY_CYCLE_NAMES, storyCycle } from "../poolStoryFixtures";
import { SetupStepCycle } from "./SetupStepCycle";
import { endOfDaySeconds, isoDate, startOfDaySeconds } from "./setupFlowModel";

/** The step is controlled by the flow; the story holds the name and the dates. */
function SetupStepCycleWithValues(props: ComponentProps<typeof SetupStepCycle>) {
  const [name, setName] = useState(props.name);
  const [startDate, setStartDate] = useState(props.startDate);
  const [endDate, setEndDate] = useState(props.endDate);
  const start = startOfDaySeconds(startDate);
  const end = endOfDaySeconds(endDate);
  return (
    <SetupStepCycle
      isCampaign={props.isCampaign}
      runningSeason={props.runningSeason}
      secondSeasonBlocked={props.secondSeasonBlocked}
      cycleNames={props.cycleNames}
      name={name}
      onNameChange={setName}
      startDate={startDate}
      onStartDateChange={setStartDate}
      endDate={endDate}
      onEndDateChange={setEndDate}
      datesValid={start !== null && end !== null && end > start}
      disabled={props.disabled}
    />
  );
}

const meta: Meta<typeof SetupStepCycle> = {
  title: "Admin/Pool/SetupStepCycle",
  component: SetupStepCycle,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The cycle step: what this season or campaign is called and when it runs. One season runs at a time, so a second one is refused here rather than at the write, with the running season named.",
      },
    },
  },
  args: {
    isCampaign: false,
    runningSeason: null,
    secondSeasonBlocked: false,
    cycleNames: STORY_CYCLE_NAMES,
    name: "",
    startDate: isoDate(STORYBOOK_NOW_SECONDS),
    endDate: isoDate(daysFromNow(30)),
    datesValid: true,
    disabled: false,
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
  render: (args) => <SetupStepCycleWithValues {...args} />,
};

export default meta;
type Story = StoryObj<typeof SetupStepCycle>;

/** The ordinary case: a season being named, thirty days out of the box. */
export const Season: Story = {};

/** A campaign runs beside the season, so any number may be started. */
export const Campaign: Story = {
  args: { isCampaign: true, name: "Seedling swap", endDate: isoDate(daysFromNow(14)) },
};

/** A season is already running, so this one is blocked until that one closes. */
export const SecondSeasonBlocked: Story = {
  args: {
    runningSeason: storyCycle(),
    secondSeasonBlocked: true,
    name: "Season of Long Days",
  },
};

/** The end date sits before the start, so the field says so before any write. */
export const DatesOutOfOrder: Story = {
  args: {
    name: "Season of First Rains",
    startDate: isoDate(daysFromNow(30)),
    endDate: isoDate(STORYBOOK_NOW_SECONDS),
    datesValid: false,
  },
};
