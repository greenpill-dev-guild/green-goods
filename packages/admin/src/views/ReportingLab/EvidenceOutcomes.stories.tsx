import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { REPORTING_LAB_MEDIA } from "../../../../shared/.storybook/reportingLabFixtures";
import { EvidenceOutcomes } from "./EvidenceOutcomes";
import { buildScenario } from "./scenarios";

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/EvidenceOutcomes",
  component: EvidenceOutcomes,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Interface 8 (proposed). The baseline beside a later observation and dated evidence, keeping recorded activity, reviewed output and a measured outcome apart. The later observation needs a follow-up assessment, which does not exist yet: it is labeled proposed and drawn only as an illustration. Synthetic sample data.",
      },
    },
  },
  decorators: [withCanvasFrame({ workspace: "garden", className: "p-4" })],
  args: { dataset: buildScenario("compost"), media: REPORTING_LAB_MEDIA, onOpenRecords: fn() },
} satisfies Meta<typeof EvidenceOutcomes>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A complete illustrative comparison: baseline, a proposed follow-up and monthly evidence. */
export const IllustratedComparison: Story = {};

/** A baseline with no later observation and no dated evidence yet. */
export const LaterEvidenceMissing: Story = { args: { dataset: buildScenario("learning") } };

export const NoBaseline: Story = { args: { dataset: buildScenario("new-garden") } };
