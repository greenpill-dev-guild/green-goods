import type { Meta, StoryObj } from "@storybook/react";
import { useMemo, useState } from "react";
import { fn } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { ActivityCalendar } from "./ActivityCalendar";
import { buildScenario, type ScenarioId } from "./scenarios";
import { defaultScope, type ReportScope, scopeRecords } from "./scope";

const compost = buildScenario("compost");

function CalendarDemo({
  scenario = "compost",
  start,
}: {
  scenario?: ScenarioId;
  start?: Partial<ReportScope>;
}) {
  const dataset = useMemo(() => buildScenario(scenario), [scenario]);
  const [scope, setScope] = useState<ReportScope>({
    ...defaultScope(dataset, "calendar"),
    ...start,
  });
  return (
    <ActivityCalendar
      dataset={dataset}
      scope={scope}
      records={scopeRecords(dataset, scope)}
      onScopeChange={(patch) => setScope((current) => ({ ...current, ...patch }))}
      onOpenRecords={fn()}
      onLoadOlder={dataset.loadedFrom === null ? undefined : fn()}
    />
  );
}

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/ActivityCalendar",
  component: ActivityCalendar,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Interface 1 (proposed). A month of days, counted by submission or by review, with statuses read today or at the month's end. Zero days, days the read never reached and days before the garden began are drawn differently. Synthetic sample data.",
      },
    },
  },
  decorators: [withCanvasFrame({ workspace: "garden", className: "p-4" })],
  args: {
    dataset: compost,
    scope: defaultScope(compost, "calendar"),
    records: compost.records,
    onScopeChange: fn(),
    onOpenRecords: fn(),
  },
} satisfies Meta<typeof ActivityCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CurrentMonth: Story = { render: () => <CalendarDemo /> };

export const ByReviewDate: Story = {
  render: () => <CalendarDemo start={{ groupBy: "reviewed" }} />,
};

export const DecemberAtMonthEnd: Story = {
  render: () => <CalendarDemo start={{ month: "2025-12", statusAsOf: "period-end" }} />,
};

export const PartialRead: Story = { render: () => <CalendarDemo scenario="partial" /> };

export const BeforeRecordsBegan: Story = { render: () => <CalendarDemo scenario="new-garden" /> };

export const PendingOnly: Story = { render: () => <CalendarDemo start={{ status: "pending" }} /> };
