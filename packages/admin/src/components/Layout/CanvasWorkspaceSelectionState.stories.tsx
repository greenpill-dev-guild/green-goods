import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withCanvasFrame, withRouter } from "../../../../shared/.storybook/decorators";
import { CanvasWorkspaceSelectionState } from "./CanvasWorkspaceSelectionState";

const gardens = [
  { id: "garden-1", name: "Comunidad Verde", location: "Costa Rica" },
  { id: "garden-2", name: "Jardim Botafogo", location: "Brazil" },
  { id: "garden-3", name: "Nairobi Greens", location: "Kenya" },
];

const meta: Meta<typeof CanvasWorkspaceSelectionState> = {
  title: "Admin/Shell/CanvasWorkspaceSelectionState",
  component: CanvasWorkspaceSelectionState,
  tags: ["autodocs"],
  decorators: [
    withRouter(["/hub"]),
    withCanvasFrame({
      className: "flex items-center justify-center p-6",
      heightClassName: "min-h-[480px]",
      workspace: "community",
    }),
  ],
  args: {
    workspaceLabel: "community",
    gardens,
    onSelectGarden: fn(),
  },
  argTypes: {
    gardens: {
      control: "object",
      description: "Gardens that can open the workspace.",
    },
    workspaceLabel: {
      control: "text",
      description: "Workspace name interpolated into the prompt.",
    },
    onSelectGarden: {
      description: "Called with the selected garden.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof CanvasWorkspaceSelectionState>;

export const Populated: Story = {};

export const Empty: Story = {
  args: {
    gardens: [],
  },
};
