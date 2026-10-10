import type { Meta, StoryObj } from "@storybook/react";
import { SeedTrayList } from "./SeedTrayList";
import { SEED_STORY_TRAY_ROWS } from "./seedStoryTray";

const noop = () => undefined;

const meta: Meta<typeof SeedTrayList> = {
  title: "Admin/Pool/SeedTrayList",
  component: SeedTrayList,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The other answers a steward added in one sitting of Seed Promises, shown above the one under review. Each line carries how many promises it makes, what each asks for, when it is due and how it is taken up. Edit takes an answer back into the form and Remove drops it, while nothing of it exists yet; once some of it does, its terms are fixed and the actions go.",
      },
    },
  },
  args: {
    rows: SEED_STORY_TRAY_ROWS,
    busy: false,
    isLocked: () => false,
    onEdit: noop,
    onRemove: noop,
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
type Story = StoryObj<typeof SeedTrayList>;

export const ThreeAnswers: Story = {};

export const OneAnswer: Story = { args: { rows: SEED_STORY_TRAY_ROWS.slice(0, 1) } };

export const Sending: Story = { args: { busy: true } };

/** The set of ten exists in part, so it keeps its terms. */
export const OneLocked: Story = {
  args: { isLocked: (id: string) => id === SEED_STORY_TRAY_ROWS[0]?.clientCommitmentId },
};
