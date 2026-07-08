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
          "Shimmer placeholders used while Hub queues fetch data. Row placeholders match WorkbenchRow; media-card and card placeholders reserve the Hub workbench grid geometry.",
      },
    },
  },
  argTypes: {
    count: { control: { type: "number", min: 1, max: 10 } },
    variant: {
      control: "select",
      options: ["row", "media-card", "card"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof HubWorkbenchSkeletonRows>;

export const Rows: Story = {
  args: { count: 3 },
};

export const MediaCards: Story = {
  args: { count: 5, variant: "media-card" },
};

export const Cards: Story = {
  args: { count: 4, variant: "card" },
};
