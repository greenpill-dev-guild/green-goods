import type { Meta, StoryObj } from "@storybook/react";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { StatusBar, StatusMarks } from "./StatusMarks";

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/StatusMarks",
  component: StatusMarks,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Proposed: a record set's statuses as glyph-and-number marks with their words for screen readers, and a segmented bar whose length is the volume. Status never rests on color alone.",
      },
    },
  },
  decorators: [withCanvasFrame({ workspace: "garden", className: "p-4" })],
  args: {
    counts: { total: 14, approved: 9, pending: 3, rejected: 2, unknown: 0 },
    locale: "en",
    className: "type-body",
  },
} satisfies Meta<typeof StatusMarks>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mixed: Story = {
  render: (args) => (
    <div className="flex max-w-xs flex-col gap-2">
      <StatusMarks {...args} />
      <StatusBar counts={args.counts} />
    </div>
  ),
};

export const WithUnreadApprovals: Story = {
  args: { counts: { total: 9, approved: 5, pending: 1, rejected: 0, unknown: 3 } },
};

/** Nothing to mark: the marks render nothing rather than a row of zeros. */
export const Empty: Story = {
  args: { counts: { total: 0, approved: 0, pending: 0, rejected: 0, unknown: 0 } },
};
