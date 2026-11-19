import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { OutputTrends } from "./OutputTrends";
import { buildScenario } from "./scenarios";
import { defaultScope, scopeRecords } from "./scope";

const compost = buildScenario("compost");
const learning = buildScenario("learning");
const partial = buildScenario("partial");

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/OutputTrends",
  component: OutputTrends,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Interface 3 (proposed). One chart per measure, so units never share an axis; reported with the approved part inside it; a week opens its records; the month line agrees with the calendar. The by-action table says which quantities are never summed. Synthetic sample data.",
      },
    },
  },
  decorators: [withCanvasFrame({ workspace: "garden", className: "p-4" })],
  args: {
    dataset: compost,
    scope: defaultScope(compost, "outputs"),
    records: scopeRecords(compost, defaultScope(compost, "outputs")),
    onOpenRecords: fn(),
    variant: "full",
  },
} satisfies Meta<typeof OutputTrends>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WasteGarden: Story = {};

export const EducationGarden: Story = {
  args: { dataset: learning, scope: defaultScope(learning, "outputs"), records: learning.records },
};

export const December: Story = {
  args: { scope: { ...defaultScope(compost, "outputs"), month: "2025-12" } },
};

export const PartialRead: Story = {
  args: { dataset: partial, scope: defaultScope(partial, "outputs"), records: partial.records },
};
