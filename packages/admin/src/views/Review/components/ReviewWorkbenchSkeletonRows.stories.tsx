import type { Meta, StoryObj } from "@storybook/react";
import { ReviewWorkbenchSkeletonRows } from "./ReviewWorkbenchSkeletonRows";

const meta: Meta<typeof ReviewWorkbenchSkeletonRows> = {
  title: "Admin/Workflows/Review/ReviewWorkbenchSkeletonRows",
  component: ReviewWorkbenchSkeletonRows,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Shimmer placeholders used while Review queues fetch data. The media-card and card placeholders reserve the Review workbench grid geometry.",
      },
    },
  },
  argTypes: {
    count: { control: { type: "number", min: 1, max: 10 } },
    variant: {
      control: "select",
      options: ["media-card", "card"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ReviewWorkbenchSkeletonRows>;

export const MediaCards: Story = {
  args: { count: 5, variant: "media-card" },
};

export const Cards: Story = {
  args: { count: 4, variant: "card" },
};

/** The desktop queue keeps the same 192px mosaic and 160px height while loading. */
export const WideMediaCards: Story = { args: { count: 3, variant: "media-card", layout: "wide" } };
