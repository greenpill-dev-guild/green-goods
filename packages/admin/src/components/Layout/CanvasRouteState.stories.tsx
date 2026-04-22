import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withCanvasFrame, withRouter } from "../../../../shared/.storybook/decorators";
import {
  CanvasRouteErrorState,
  CanvasWorkspaceLoadingState,
  CanvasWorkspaceSelectionGate,
} from "./CanvasRouteState";

const gardenOptions = [
  { id: "garden-1", name: "Rio Rainforest Lab", location: "Costa Rica" },
  { id: "garden-2", name: "Jardim Botafogo", location: "Brazil" },
  { id: "garden-3", name: "Nairobi Greens", location: "Kenya" },
];

function CanvasRouteStateCatalog() {
  return (
    <div className="space-y-6">
      <CanvasWorkspaceSelectionGate
        workspaceLabel="garden"
        gardens={gardenOptions}
        onSelectGarden={fn()}
      />
      <CanvasWorkspaceLoadingState />
      <CanvasRouteErrorState message="Unable to load this workspace." />
      <CanvasRouteErrorState variant="warning" message="You do not have access to this workspace." />
    </div>
  );
}

const meta: Meta<typeof CanvasRouteStateCatalog> = {
  title: "Admin/Shell/CanvasRouteState",
  component: CanvasRouteStateCatalog,
  tags: ["autodocs", "storybook-ci"],
  decorators: [
    withRouter(["/garden"]),
    withCanvasFrame({
      workspace: "community",
      heightClassName: "min-h-[720px]",
      className: "p-4 sm:p-6",
    }),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Shared canvas route states used by admin workspace routes before their main tab content can render.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CanvasRouteStateCatalog>;

export const StateCatalog: Story = {};

export const EmptySelection: Story = {
  render: () => (
    <CanvasWorkspaceSelectionGate workspaceLabel="community" gardens={[]} onSelectGarden={fn()} />
  ),
};

export const Loading: Story = {
  render: () => <CanvasWorkspaceLoadingState />,
};

export const Error: Story = {
  render: () => <CanvasRouteErrorState message="Unable to load this workspace." />,
};
