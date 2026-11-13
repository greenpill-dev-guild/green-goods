import type { Meta, StoryObj } from "@storybook/react";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { buildScenario } from "./scenarios";
import { timelineItems, timelineSpan } from "./timeline";
import { TimelineAxis } from "./TimelineAxis";

const compost = buildScenario("compost");
const learning = buildScenario("learning");
const axisArgs = (dataset: typeof compost, month: string) => {
  const items = timelineItems(dataset);
  return { dataset, items, span: timelineSpan(items, dataset), month, locale: "en" };
};

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/TimelineAxis",
  component: TimelineAxis,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Proposed: the season timeline's drawing, decoration beside its list. Seasons and campaigns as bars, promise deadlines and milestones as marks in their state's color, planned work and recorded delivery as separate weekly lanes, the chosen month shaded and today marked.",
      },
    },
  },
  decorators: [withCanvasFrame({ workspace: "garden", className: "p-4" })],
  args: axisArgs(compost, "2025-12"),
} satisfies Meta<typeof TimelineAxis>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WasteSeason: Story = {};

/** Published sessions fill the planned lane; delivered ones the recorded lane. */
export const LearningTerms: Story = { args: axisArgs(learning, "2025-11") };
