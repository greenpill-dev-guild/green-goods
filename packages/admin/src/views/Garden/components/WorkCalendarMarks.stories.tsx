import type { Meta, StoryObj } from "@storybook/react";
import { StatusBar, StatusMarks } from "./WorkCalendarMarks";

const meta = {
  title: "Admin/Workflows/Garden/WorkCalendarMarks",
  component: StatusMarks,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A set of submissions' statuses as icon-and-number marks, with a proportion bar beside them. A status with no submissions shows no mark, and no status rests on color alone.",
      },
    },
  },
  args: { counts: { total: 14, approved: 9, pending: 3, rejected: 1, unknown: 1 } },
  render: (args) => (
    <div className="flex w-40 flex-col gap-2">
      <StatusMarks {...args} className="type-meta" />
      <StatusBar counts={args.counts} scale={1} />
    </div>
  ),
} satisfies Meta<typeof StatusMarks>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EveryStatus: Story = {};

export const ApprovedOnly: Story = {
  args: { counts: { total: 4, approved: 4, pending: 0, rejected: 0, unknown: 0 } },
};
