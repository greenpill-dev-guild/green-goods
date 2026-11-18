import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { buildScenario } from "./scenarios";
import { defaultScope } from "./scope";
import { SeasonTimeline } from "./SeasonTimeline";

const compost = buildScenario("compost");
const learning = buildScenario("learning");
const empty = buildScenario("new-garden");

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/SeasonTimeline",
  component: SeasonTimeline,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Interface 4 (proposed). Seasons, campaigns, promise deadlines and milestones on one axis, with planned work and recorded delivery as separate lanes; the list under the drawing opens each item's detail. Milestones are a proposal. Synthetic sample data.",
      },
    },
  },
  decorators: [withCanvasFrame({ workspace: "garden", className: "p-4" })],
  args: {
    dataset: compost,
    scope: defaultScope(compost, "season"),
    onScopeChange: fn(),
    onOpenRecords: fn(),
  },
} satisfies Meta<typeof SeasonTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WasteSeason: Story = {};

/** Planned sessions against delivered ones, and a promise past due. */
export const LearningTerms: Story = {
  args: { dataset: learning, scope: defaultScope(learning, "season") },
};

export const OneCampaign: Story = {
  args: { scope: { ...defaultScope(compost, "season"), windowId: "holiday-market" } },
};

export const NoSeasonYet: Story = {
  args: { dataset: empty, scope: defaultScope(empty, "season") },
};
