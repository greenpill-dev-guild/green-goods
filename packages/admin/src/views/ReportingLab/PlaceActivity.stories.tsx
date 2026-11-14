import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { PlaceActivity } from "./PlaceActivity";
import { buildScenario } from "./scenarios";
import { defaultScope, scopeRecords } from "./scope";

const compost = buildScenario("compost");
const learningLong = buildScenario("learning-long");

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/PlaceActivity",
  component: PlaceActivity,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Interface 5 (proposed). A schematic map, since the repository has no map library: named sites at approximate offsets, not to scale. The site list is the working control and keeps records with no location in view. Synthetic places and sample data.",
      },
    },
  },
  decorators: [withCanvasFrame({ workspace: "garden", className: "p-4" })],
  args: {
    dataset: compost,
    scope: { ...defaultScope(compost, "places"), month: "2025-12" },
    records: compost.records,
    onOpenRecords: fn(),
  },
} satisfies Meta<typeof PlaceActivity>;

export default meta;
type Story = StoryObj<typeof meta>;

export const December: Story = {};

export const SortingOnly: Story = {
  args: (() => {
    const scope = {
      ...defaultScope(compost, "places"),
      month: "2025-12",
      actionId: "waste.sorting_breakdown",
    };
    return { scope, records: scopeRecords(compost, scope) };
  })(),
};

export const LongSiteNames: Story = {
  args: {
    dataset: learningLong,
    scope: { ...defaultScope(learningLong, "places"), month: "2025-11" },
    records: learningLong.records,
  },
};
