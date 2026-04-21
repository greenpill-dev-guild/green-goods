import type { Meta, StoryObj } from "@storybook/react";
import { HubWorkbenchSkeletonRows } from "./HubWorkbenchSkeletonRows";

const meta: Meta<typeof HubWorkbenchSkeletonRows> = {
  title: "Admin/Workflows/Hub/HubWorkbenchSkeletonRows",
  component: HubWorkbenchSkeletonRows,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Shimmer placeholder rows used while Hub queues fetch data. Matches the WorkbenchRow layout (thumb, title, meta chips, trailing affordance).",
      },
    },
  },
  argTypes: {
    count: { control: { type: "number", min: 1, max: 10 } },
  },
};

export default meta;
type Story = StoryObj<typeof HubWorkbenchSkeletonRows>;

export const Three: Story = {
  args: { count: 3 },
};

export const Five: Story = {
  args: { count: 5 },
};
