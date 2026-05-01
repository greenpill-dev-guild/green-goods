import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { CanvasIndexerErrorState } from "./CanvasIndexerErrorState";

const meta: Meta<typeof CanvasIndexerErrorState> = {
  title: "Admin/Shell/CanvasIndexerErrorState",
  component: CanvasIndexerErrorState,
  tags: ["autodocs"],
  decorators: [
    withCanvasFrame({
      className: "flex items-center justify-center p-6",
      heightClassName: "min-h-[440px]",
      workspace: "garden",
    }),
  ],
  args: {
    onRetry: fn(),
  },
  argTypes: {
    onRetry: {
      description: "Called when the retry CTA is pressed.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof CanvasIndexerErrorState>;

export const IndexerUnavailable: Story = {};
