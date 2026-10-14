import type { Meta, StoryObj } from "@storybook/react";
import { SeedTotal } from "./SeedTotal";

const meta = {
  title: "Admin/Pool/SeedTotal",
  component: SeedTotal,
  tags: ["autodocs"],
  args: { count: 10, each: 1, unit: "survey", busy: false, onMakeItOne: () => {} },
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "The arithmetic under Seed Promises' How Much step (PRD-1022 screens 02–03): so many promises, each asking for so much. When both numbers are above one it becomes a soft check with the fix beside it, in the same height, so nothing under it moves.",
      },
    },
  },
} satisfies Meta<typeof SeedTotal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Ten separate promises of one survey each. */
export const TenOfOne: Story = {};

/** Ten promises of ten surveys each: probably meant ten in total, so it asks. */
export const TotalCheck: Story = { args: { each: 10 } };

export const OnePromise: Story = { args: { count: 1, each: 12, unit: "rides" } };

export const CheckWhileSending: Story = { args: { each: 10, busy: true } };
