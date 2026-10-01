import type { Meta, StoryObj } from "@storybook/react";
import { EventTime } from "./EventTime";
import { STORY_NOW } from "./poolStoryFixtures";

const NOW_MS = Number(STORY_NOW) * 1000;

const meta: Meta<typeof EventTime> = {
  title: "Admin/Pool/EventTime",
  component: EventTime,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          'A moment in a list of events (PRD-1025 D3): it reads the way its list reads it, such as "Today, 3:42 PM" in the inspector\'s timeline, and hovering it shows the full date, time and zone. A screen reader reads the full moment in its place, and the `<time>` carries it machine-readable.',
      },
    },
  },
  args: { ms: NOW_MS - 18 * 60_000, children: "Today, 3:42 PM" },
  decorators: [
    (Story) => (
      <div className="p-8 body-xs text-text-soft" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof EventTime>;

export const Today: Story = {};

/** Last year's event names its year. */
export const LastYear: Story = {
  args: { ms: NOW_MS - 300 * 86_400_000, children: "Mar 22, 2025, 4:10 PM" },
};
