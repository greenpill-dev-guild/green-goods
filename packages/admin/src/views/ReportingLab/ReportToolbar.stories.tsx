import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { ReportToolbar } from "./ReportToolbar";
import { buildScenario } from "./scenarios";
import { defaultScope, type ReportScope, type ReportView } from "./scope";

const compost = buildScenario("compost");
const partial = buildScenario("partial");

function ToolbarDemo({ view, dataset = compost }: { view: ReportView; dataset?: typeof compost }) {
  const [scope, setScope] = useState<ReportScope>(defaultScope(dataset, view));
  return (
    <ReportToolbar
      dataset={dataset}
      scope={scope}
      onScopeChange={(patch) => setScope((current) => ({ ...current, ...patch }))}
    />
  );
}

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/ReportToolbar",
  component: ReportToolbar,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Proposed: the reports' shared toolbar. The month and filters belong to the steward's scope and hold across reports; each report shows only the filters it reads, and Clear Filters appears once one is set.",
      },
    },
  },
  decorators: [withCanvasFrame({ workspace: "garden", className: "p-4" })],
  args: { dataset: compost, scope: defaultScope(compost), onScopeChange: () => undefined },
} satisfies Meta<typeof ReportToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = { render: () => <ToolbarDemo view="overview" /> };

/** The calendar reads status too; picking a status shows Clear Filters. */
export const Calendar: Story = { render: () => <ToolbarDemo view="calendar" /> };

/** Funding reads only the month. */
export const Funding: Story = { render: () => <ToolbarDemo view="funding" /> };

/** With unread approvals, the status filter can show them on their own. */
export const UnreadStatus: Story = {
  render: () => <ToolbarDemo view="calendar" dataset={partial} />,
};
