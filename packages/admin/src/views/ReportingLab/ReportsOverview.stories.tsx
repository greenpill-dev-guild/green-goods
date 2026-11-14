import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { fn } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { REPORTING_LAB_MEDIA } from "../../../../shared/.storybook/reportingLabFixtures";
import { ReportsOverview } from "./ReportsOverview";
import { buildScenario, type ScenarioId } from "./scenarios";
import { defaultScope, type ReportScope, scopeRecords } from "./scope";

const compost = buildScenario("compost");

function OverviewDemo({ scenario }: { scenario: ScenarioId }) {
  const [dataset] = useState(() => buildScenario(scenario));
  const [scope, setScope] = useState<ReportScope>(defaultScope(dataset));
  return (
    <ReportsOverview
      dataset={dataset}
      scope={scope}
      records={scopeRecords(dataset, scope)}
      media={REPORTING_LAB_MEDIA}
      onScopeChange={(patch) => setScope((current) => ({ ...current, ...patch, view: "overview" }))}
      onOpenRecords={fn()}
    />
  );
}

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/ReportsOverview",
  component: ReportsOverview,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Proposed: the integrated overview without the shell. The calendar leads, review health sits beside it from 1280px and after it below, output trends follow, and the other five reports are rows in one card. Synthetic sample data.",
      },
    },
  },
  decorators: [withCanvasFrame({ workspace: "garden", className: "p-4" })],
  args: {
    dataset: compost,
    scope: defaultScope(compost),
    records: compost.records,
    media: REPORTING_LAB_MEDIA,
    onScopeChange: fn(),
    onOpenRecords: fn(),
  },
} satisfies Meta<typeof ReportsOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WasteGarden: Story = { render: () => <OverviewDemo scenario="compost" /> };

export const EducationGarden: Story = { render: () => <OverviewDemo scenario="learning" /> };

export const NewGarden: Story = { render: () => <OverviewDemo scenario="new-garden" /> };
