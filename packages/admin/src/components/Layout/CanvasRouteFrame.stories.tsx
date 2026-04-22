import type { Meta, StoryObj } from "@storybook/react";
import { withCanvasFrame, withRouter } from "../../../../shared/.storybook/decorators";
import { AdminButton } from "../AdminButton";
import { AdminTabRail } from "../AdminTabRail";
import { CanvasRouteContent, CanvasRouteFrame, CanvasRouteHeader } from "./CanvasRouteFrame";

const meta: Meta<typeof CanvasRouteFrame> = {
  title: "Admin/Shell/CanvasRouteFrame",
  component: CanvasRouteFrame,
  tags: ["autodocs", "storybook-ci"],
  decorators: [
    withRouter(["/garden"]),
    withCanvasFrame({
      workspace: "garden",
      heightClassName: "min-h-[520px]",
    }),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Canvas route shell used by admin workspace routes. It composes the constrained header/content lanes without importing the full app route tree.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CanvasRouteFrame>;

export const StateCatalog: Story = {
  render: () => (
    <CanvasRouteFrame>
      <CanvasRouteHeader
        title="Garden"
        description="Manage the selected garden workspace."
        variant="canvas"
        sticky
        metadata={<span>Rio Rainforest Lab</span>}
        backLink={{ to: "/hub", label: "Back to hub" }}
      >
        <AdminTabRail
          ariaLabel="Garden workspace sections"
          activeId="overview"
          onChange={() => {}}
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "impact", label: "Impact", count: 6 },
            { id: "settings", label: "Settings" },
          ]}
        />
      </CanvasRouteHeader>
      <CanvasRouteContent className="mt-4 space-y-4">
        <div className="rounded-lg border border-stroke-soft bg-bg-white p-4">
          <p className="label-md text-text-strong">Workspace content lane</p>
          <p className="mt-1 text-sm text-text-sub">
            Route bodies should sit inside this constrained content container.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminButton size="sm">Primary action</AdminButton>
          <AdminButton size="sm" variant="outlined">
            Secondary action
          </AdminButton>
        </div>
      </CanvasRouteContent>
    </CanvasRouteFrame>
  ),
};

export const NarrowContent: Story = {
  render: () => (
    <CanvasRouteFrame>
      <CanvasRouteHeader
        title="Submit assessment"
        description="Capture the review context before moving into the wizard."
        variant="canvas"
        maxWidthClassName="max-w-3xl"
      />
      <CanvasRouteContent maxWidthClassName="max-w-3xl" className="mt-4">
        <div className="rounded-lg border border-stroke-soft bg-bg-white p-4 text-sm text-text-sub">
          Narrow routes use the same shell with a smaller content width.
        </div>
      </CanvasRouteContent>
    </CanvasRouteFrame>
  ),
};
