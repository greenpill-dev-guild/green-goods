import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { CanvasGardenAccessState } from "./CanvasGardenAccessState";

const meta: Meta<typeof CanvasGardenAccessState> = {
  title: "Admin/Layout/CanvasGardenAccessState",
  component: CanvasGardenAccessState,
  tags: ["autodocs"],
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
