import type { Meta, StoryObj } from "@storybook/react";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { REPORTING_LAB_MEDIA } from "../../../../shared/.storybook/reportingLabFixtures";
import { ReviewWorkScene } from "./ReviewWorkScene";
import { buildScenario } from "./scenarios";

const backlog = buildScenario("compost-backlog");

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Walkthrough/Review Work",
  component: ReviewWorkScene,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Proposed, Storybook only: Review's Work tab with waiting-time chips. Header, stats, stage rail, search, scopes, sort and work cards are the shipped Review workspace's; each new chip filters the pending list by how long work has waited and says its count, in plain ink (DL-044). Sample data: Riverbend Compost Collective with a growing backlog, fixed at Jan 16, 2026.",
      },
    },
  },
  decorators: [
    withCanvasFrame({ workspace: "review", className: "p-0", heightClassName: "h-screen" }),
  ],
  args: { dataset: backlog, media: REPORTING_LAB_MEDIA },
} satisfies Meta<typeof ReviewWorkScene>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The pending queue, newest first, with how long its work has waited. */
export const Queue: Story = {};

/** One waiting band chosen: the work that has waited one to two weeks, oldest first. */
export const WaitedOneToTwoWeeks: Story = { args: { band: "1-2w", sort: "oldest" } };

/** A card opened: its work in the Review Work dialog, over the filtered queue. */
export const WorkOpen: Story = {
  args: { band: "1-2w", sort: "oldest", openId: "riverbend-2026-01-03-2" },
};
