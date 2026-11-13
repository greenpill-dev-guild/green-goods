import type { Meta, StoryObj } from "@storybook/react";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { REPORTING_LAB_MEDIA } from "../../../../shared/.storybook/reportingLabFixtures";
import { RecordFacts } from "./RecordFacts";
import { buildScenario } from "./scenarios";

const compost = buildScenario("compost");
const find = (test: (record: (typeof compost.records)[number]) => boolean) =>
  compost.records.find(test) ?? compost.records[0];

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/RecordFacts",
  component: RecordFacts,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "One record's evidence and facts. Every date says which date it is; a work-performed date shows only when the work's details recorded one. Synthetic sample data and sample photos.",
      },
    },
  },
  decorators: [
    withCanvasFrame({ workspace: "garden", className: "p-4" }),
    (Story) => (
      <div className="mx-auto max-w-xl">
        <Story />
      </div>
    ),
  ],
  args: {
    record: find((record) => record.decision === "approved" && record.siteId !== undefined),
    dataset: compost,
    media: REPORTING_LAB_MEDIA,
    role: "steward",
    at: compost.reference,
  },
} satisfies Meta<typeof RecordFacts>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Approved: Story = {};

/** A cleanup uploaded late from the route, with the event day it recorded. */
export const LateUploadWithEventDate: Story = {
  args: {
    record: find(
      (record) => record.sentFromDeviceAt !== undefined && record.performedOn !== undefined
    ),
  },
};

export const Rejected: Story = {
  args: { record: find((record) => record.decision === "rejected") },
};

export const PendingForEvaluator: Story = {
  args: { record: find((record) => record.decision === "pending"), role: "evaluator" },
};
