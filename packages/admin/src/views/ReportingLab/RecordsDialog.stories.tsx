import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { REPORTING_LAB_MEDIA } from "../../../../shared/.storybook/reportingLabFixtures";
import { buildCalendar } from "./aggregate";
import { RecordsDialog } from "./RecordsDialog";
import { buildScenario } from "./scenarios";

const compost = buildScenario("compost");
const partial = buildScenario("partial");
const day = buildCalendar({
  dataset: compost,
  records: compost.records,
  month: "2026-01",
  groupBy: "submitted",
  at: compost.reference,
  status: "all",
})
  .weeks.flat()
  .find((cell) => cell.day === "2026-01-14");

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/RecordsDialog",
  component: RecordsDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The one drill-down every report opens, in the cockpit's AdminDialog: the matching records as item rows, and a record's evidence and dated facts inside the same dialog. Synthetic sample data.",
      },
    },
  },
  decorators: [withCanvasFrame({ workspace: "garden", heightClassName: "min-h-[720px]" })],
  args: {
    request: {
      title: "Wednesday, January 14",
      scopeLine: "Submitted that day, All actions",
      records: day?.records ?? [],
      at: compost.reference,
    },
    onClose: fn(),
    dataset: compost,
    media: REPORTING_LAB_MEDIA,
    role: "steward",
  },
} satisfies Meta<typeof RecordsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DayRecords: Story = {};

export const OneRecordOpen: Story = {
  args: {
    request: {
      title: "Wednesday, January 14",
      scopeLine: "Submitted that day, All actions",
      records: day?.records ?? [],
      at: compost.reference,
      openId: day?.records.find((record) => record.decision === "pending")?.id,
    },
  },
};

export const UnreadApprovals: Story = {
  args: {
    dataset: partial,
    request: {
      title: "Newest Records",
      scopeLine: "The newest page read",
      records: partial.records.filter((record) => !record.approvalReadable),
      at: partial.reference,
    },
  },
};

export const NothingThatDay: Story = {
  args: {
    request: {
      title: "Thursday, January 1",
      scopeLine: "Submitted that day, All actions",
      records: [],
      at: compost.reference,
      emptyNote: "Nothing was submitted that day.",
    },
  },
};
