import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { REPORTING_LAB_MEDIA } from "../../../../shared/.storybook/reportingLabFixtures";
import { ReviewHealthPanel } from "./ReviewHealthPanel";
import { buildScenario } from "./scenarios";
import { defaultScope } from "./scope";

const compost = buildScenario("compost");
const backlog = buildScenario("compost-backlog");
const learning = buildScenario("learning");

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/ReviewHealthPanel",
  component: ReviewHealthPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Interface 2 (proposed). Waiting work by age band, the oldest waiting, and submitted against reviewed by week. The status uses the shipped stall rule (DL-044); a band filters the list. Synthetic sample data.",
      },
    },
  },
  decorators: [withCanvasFrame({ workspace: "garden", className: "p-4" })],
  args: {
    dataset: backlog,
    scope: defaultScope(backlog, "review"),
    records: backlog.records,
    media: REPORTING_LAB_MEDIA,
    onOpenRecords: fn(),
    variant: "full",
  },
} satisfies Meta<typeof ReviewHealthPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GrowingBacklog: Story = {};

export const OnTrack: Story = {
  args: { dataset: compost, scope: defaultScope(compost, "review"), records: compost.records },
};

/** Few records, but the oldest have waited weeks and nobody reviewed in seven days. */
export const SparseAndStalled: Story = {
  args: { dataset: learning, scope: defaultScope(learning, "review"), records: learning.records },
};

export const DecemberAtMonthEnd: Story = {
  args: {
    dataset: compost,
    scope: { ...defaultScope(compost, "review"), month: "2025-12" },
    records: compost.records,
  },
};

export const OverviewSummary: Story = { args: { variant: "summary", onOpenReport: fn() } };
