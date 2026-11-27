import type { Meta, StoryObj } from "@storybook/react";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { ParticipationView } from "./ParticipationView";
import { buildScenario } from "./scenarios";
import { defaultScope } from "./scope";

const compost = buildScenario("compost");
const learning = buildScenario("learning");

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/ParticipationView",
  component: ParticipationView,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Interface 6 (proposed). Reporting accounts, attendance written on records, and unique people (not measured) stay three different counts. The account-by-week table is ordered by name, never by volume, and shows to stewards and evaluators only. Synthetic sample data.",
      },
    },
  },
  decorators: [withCanvasFrame({ workspace: "garden", className: "p-4" })],
  args: {
    dataset: learning,
    scope: { ...defaultScope(learning, "people"), month: "2025-11" },
    records: learning.records,
    role: "steward",
  },
} satisfies Meta<typeof ParticipationView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sessions with attendance, and a classroom tablet that is never one person. */
export const LearningGarden: Story = {};

export const WasteGarden: Story = {
  args: { dataset: compost, scope: defaultScope(compost, "people"), records: compost.records },
};

export const FunderSeesTotals: Story = { args: { role: "funder" } };
