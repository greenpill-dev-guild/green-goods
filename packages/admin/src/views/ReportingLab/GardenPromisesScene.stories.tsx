import type { Meta, StoryObj } from "@storybook/react";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { REPORTING_LAB_MEDIA } from "../../../../shared/.storybook/reportingLabFixtures";
import { GardenPromisesScene } from "./GardenPromisesScene";
import { buildScenario } from "./scenarios";

const backlog = buildScenario("compost-backlog");

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Walkthrough/Garden Promises",
  component: GardenPromisesScene,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Proposed, Storybook only: Garden's Promises tab with the season drawn as a timeline in the season card's place. What needs you, Offers and Asks, Review Promises and Pool Status follow the shipped tab, filled from sample promises; a promise opens the work it links. Sample data fixed at Jan 16, 2026.",
      },
    },
  },
  decorators: [
    withCanvasFrame({ workspace: "garden", className: "p-0", heightClassName: "h-screen" }),
  ],
  args: { dataset: backlog, media: REPORTING_LAB_MEDIA },
} satisfies Meta<typeof GardenPromisesScene>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The Short Rains Season: deadlines, milestones, and planned against recorded work. */
export const Season: Story = {};

/** October's transfer opened: kept a day early, with the transfers that kept it. */
export const PromiseOpen: Story = { args: { openItemId: "p-oct" } };
