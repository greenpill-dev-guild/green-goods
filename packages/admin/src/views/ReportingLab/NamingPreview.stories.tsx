import type { Meta, StoryObj } from "@storybook/react";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { NamingPreview } from "./NamingPreview";

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/NamingPreview",
  component: NamingPreview,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "PRD-1485 exploration, nothing decided: each dashboard-name candidate in the places a steward meets it, and the workspace names it repeats. Renaming the Hub workspace to Review is shown only to compare.",
      },
    },
  },
  decorators: [withCanvasFrame({ workspace: "garden", className: "p-4" })],
  args: { nameId: "steward-hub", hubLabel: "hub" },
} satisfies Meta<typeof NamingPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

/** "Steward Hub" beside a workspace that is also called Hub. */
export const StewardHub: Story = {};

/** Both words of "Garden Hub" are already workspace names. */
export const GardenHub: Story = { args: { nameId: "garden-hub" } };

export const StewardHubWithReviewWorkspace: Story = { args: { hubLabel: "review" } };

export const CurrentName: Story = { args: { nameId: "current" } };
