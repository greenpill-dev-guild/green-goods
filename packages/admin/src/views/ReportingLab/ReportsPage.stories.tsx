import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { fn } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { REPORTING_LAB_MEDIA } from "../../../../shared/.storybook/reportingLabFixtures";
import type { ViewerRole } from "./model";
import { ReportsPage } from "./ReportsPage";
import { buildScenario, type ScenarioId } from "./scenarios";
import { defaultScope, type ReportScope, type ReportView } from "./scope";

const compost = buildScenario("compost");

function PageDemo({
  scenario = "compost",
  view = "overview",
  role = "steward",
}: {
  scenario?: ScenarioId;
  view?: ReportView;
  role?: ViewerRole;
}) {
  const [dataset] = useState(() => buildScenario(scenario));
  const [scope, setScope] = useState<ReportScope>(defaultScope(dataset, view));
  return (
    <ReportsPage
      dataset={dataset}
      scope={scope}
      onScopeChange={(patch) => setScope((current) => ({ ...current, ...patch }))}
      media={REPORTING_LAB_MEDIA}
      role={role}
      onRetry={fn()}
    />
  );
}

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/ReportsPage",
  component: ReportsPage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Proposed: the Reports page inside the Garden workspace, through the cockpit's CanvasRouteFrame and CanvasRouteHeader. Every report opens the same records dialog, so a drill-down and the way back keep the steward's month and filters. Synthetic sample data.",
      },
    },
  },
  decorators: [withCanvasFrame({ workspace: "garden", className: "px-4" })],
  args: {
    dataset: compost,
    scope: defaultScope(compost),
    onScopeChange: fn(),
    media: REPORTING_LAB_MEDIA,
    role: "steward",
  },
} satisfies Meta<typeof ReportsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = { render: () => <PageDemo /> };

export const Calendar: Story = { render: () => <PageDemo view="calendar" /> };

export const Loading: Story = { render: () => <PageDemo scenario="loading" /> };

export const ReadFailed: Story = { render: () => <PageDemo scenario="error" /> };
