import type { Meta, StoryObj } from "@storybook/react";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { REPORTING_LAB_MEDIA } from "../../../../shared/.storybook/reportingLabFixtures";
import { GardenHealthScene } from "./GardenHealthScene";
import { buildScenario } from "./scenarios";

const backlog = buildScenario("compost-backlog");

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Walkthrough/Garden Health",
  component: GardenHealthScene,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Proposed, Storybook only: Garden's Health tab with Review Health under the shipped Garden Health card. The card, its stats, Key Metrics and the alerts rail follow the shipped tab; Review Health shows the shipped stall rule's verdict, waiting work by age and submitted against reviewed each week, and its age bands hand off to the Hub's Work chips. Sample data fixed at Jan 16, 2026.",
      },
    },
  },
  decorators: [
    withCanvasFrame({ workspace: "garden", className: "p-0", heightClassName: "h-screen" }),
  ],
  args: { dataset: backlog, media: REPORTING_LAB_MEDIA },
} satisfies Meta<typeof GardenHealthScene>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Riverbend's growing backlog: 15 works have waited over a week while reviews still land. */
export const Review: Story = {};

/** Hilltop's review has stalled: no review in a week, with work waiting longer than that. */
export const ReviewStalled: Story = { args: { dataset: buildScenario("learning") } };
