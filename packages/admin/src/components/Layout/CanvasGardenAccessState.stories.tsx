import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { CanvasGardenAccessState } from "./CanvasGardenAccessState";

const meta: Meta<typeof CanvasGardenAccessState> = {
  title: "Admin/Shell/CanvasGardenAccessState",
  component: CanvasGardenAccessState,
  tags: ["autodocs"],
  decorators: [
    withCanvasFrame({
      className: "flex items-center justify-center p-6",
      heightClassName: "min-h-[440px]",
      workspace: "garden",
    }),
  ],
  args: {
    onCreateGarden: fn(),
    canCreateGarden: true,
  },
  argTypes: {
    canCreateGarden: {
      control: "boolean",
      description: "Whether the create-garden CTA is available.",
    },
    onCreateGarden: {
      description: "Called when the create-garden CTA is pressed.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof CanvasGardenAccessState>;

export const CanCreateGarden: Story = {};

export const OperatorOnly: Story = {
  args: {
    canCreateGarden: false,
  },
};
