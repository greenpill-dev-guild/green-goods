import { EmptyStateShell } from "@green-goods/shared/components/Canvas/EmptyStateShell";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { RiCheckboxCircleLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { GardenFrame, GardenTabLayout, ReviewFrame } from "./SceneFrames";

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/SceneFrames",
  component: ReviewFrame,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Proposed, Storybook only: the workspace frames the walkthrough's screens sit in, built as the shipped Review and Garden views build theirs: CanvasRouteFrame, a sticky CanvasRouteHeader with its MetaStrip, view actions and tab rail, from the shared builders. Tab presses and actions are inert.",
      },
    },
  },
  decorators: [withCanvasFrame({ workspace: "review", className: "p-4" })],
  args: {
    stage: "work",
    counts: { work: 47 },
    stats: [{ id: "waiting-over-week", value: "15", label: "waiting over a week" }],
    toolbar: null,
    resultsLabel: "Work",
    children: (
      <EmptyStateShell>
        <EmptyState
          icon={<RiCheckboxCircleLine className="h-6 w-6" />}
          title="The stage's results"
          description="A walkthrough screen puts its list here."
        />
      </EmptyStateShell>
    ),
  },
} satisfies Meta<typeof ReviewFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The Review frame on its Work stage, with the pending count on the rail. */
export const ReviewWork: Story = {};

/** The Garden frame on Activity, with its main column and rail. */
export const GardenActivity: Story = {
  decorators: [withCanvasFrame({ workspace: "garden", className: "p-4" })],
  render: () => (
    <GardenFrame view="activity" gardenerCount={7} impactCount={0} alertCount={1}>
      <GardenTabLayout
        main={
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Main column</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardBody>
              <p className="type-body text-text-sub">{"The tab's cards, in its main column."}</p>
            </AdminCardBody>
          </AdminCard>
        }
        rail={
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Rail</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardBody>
              <p className="type-body text-text-sub">Alerts and key metrics.</p>
            </AdminCardBody>
          </AdminCard>
        }
      />
    </GardenFrame>
  ),
};
