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
          "The commitments a steward has added so far in one sitting of the seeding console, shown above the one under review. Each line carries what a row is checked by: who offers or asks, how much, when it is due, and how it is claimed. Edit takes a row back into the form and Remove drops it. A row the last send created nothing for says so, and stays to be changed or sent again.",
      },
    },
  },
  args: { rows: SEED_STORY_TRAY_ROWS, busy: false, onEdit: noop, onRemove: noop },
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

export const ThreeRowsOneNotSent: Story = {};

export const OneRow: Story = { args: { rows: SEED_STORY_TRAY_ROWS.slice(0, 1) } };

export const Sending: Story = { args: { busy: true } };
