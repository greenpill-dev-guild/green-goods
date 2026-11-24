import type { Meta, StoryObj } from "@storybook/react";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { REPORTING_LAB_MEDIA } from "../../../../shared/.storybook/reportingLabFixtures";
import { GardenImpactScene } from "./GardenImpactScene";
import { buildScenario } from "./scenarios";

const backlog = buildScenario("compost-backlog");

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Walkthrough/Garden Impact",
  component: GardenImpactScene,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Proposed, Storybook only: Garden's Impact tab with Output Trends and Evidence and Outcomes above the shipped Recent Hypercerts, Recent Assessments and Impact Summary. Sample data fixed at Jan 16, 2026.",
      },
    },
  },
  decorators: [
    withCanvasFrame({ workspace: "garden", className: "p-0", heightClassName: "h-screen" }),
  ],
  args: { dataset: backlog, media: REPORTING_LAB_MEDIA },
} satisfies Meta<typeof GardenImpactScene>;

export default meta;
type Story = StoryObj<typeof meta>;

/** What Riverbend's work produced each week, and its baseline with a later observation. */
export const Outputs: Story = {};

/** Hilltop has a baseline but no later observation yet: the gap is said, not hidden. */
export const EvidenceMissing: Story = { args: { dataset: buildScenario("learning") } };
