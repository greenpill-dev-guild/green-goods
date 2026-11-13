import type { Meta, StoryObj } from "@storybook/react";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { REPORTING_LAB_MEDIA } from "../../../../shared/.storybook/reportingLabFixtures";
import { LabCanvas } from "./LabCanvas";
import { labGardens } from "./labShell";

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/LabCanvas",
  component: LabCanvas,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Proposed, Storybook only: the cockpit's frame around a walkthrough screen, laid out as CanvasLayout lays out the app. The AppBar, GardenChip, MainSheet and NavigationBar are the shipped components; the workspace sets the canvas tone and the active nav item. A steward's nav holds Hub, Garden and Community.",
      },
    },
  },
  decorators: [
    withCanvasFrame({ workspace: "garden", className: "p-0", heightClassName: "h-screen" }),
  ],
  args: {
    workspace: "garden",
    gardens: labGardens(REPORTING_LAB_MEDIA),
    gardenId: "garden-riverbend",
    children: (
      <AdminCard>
        <AdminCardHeader>
          <AdminCardTitle>Screen content</AdminCardTitle>
        </AdminCardHeader>
        <AdminCardBody>
          <p className="type-body text-text-sub">
            A walkthrough screen renders its workspace here, inside the main scroll area.
          </p>
        </AdminCardBody>
      </AdminCard>
    ),
  },
} satisfies Meta<typeof LabCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Garden: Story = {};

export const Hub: Story = { args: { workspace: "hub" } };

export const Community: Story = { args: { workspace: "community" } };
