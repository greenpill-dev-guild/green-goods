import { RiArrowRightSLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { AdminListRow } from "./AdminListRow";

const meta: Meta<typeof AdminListRow> = {
  title: "Admin/Primitives/AdminListRow",
  component: AdminListRow,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: [
          "**AdminListRow** — a list row that opens its record.",
          "The whole row is one full-width, left-aligned button whose height follows",
          "its content, never below the 44px finger box. The row owns the box; the",
          "caller lays out the content. Use `AdminButton` for actions,",
          "`AdminSelectableCard` for choices, and `WorkbenchCard` for queue records.",
          "",
          "`current` marks the row whose record is open: `aria-current` plus a ring.",
        ].join("\n"),
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof AdminListRow>;

const RECENT_ASSESSMENTS = [
  { id: "canopy", title: "Canopy baseline", date: "Sep 23, 2026" },
  { id: "soil", title: "Soil health check", date: "Sep 12, 2026" },
  {
    id: "workshop",
    title: "Workshop cohort check-in with the neighbouring school gardens",
    date: "Aug 30, 2026",
  },
];

/**
 * The Impact tab's Recent Assessments rows: a title over a date, the open one
 * current, a long title truncated with its full text on hover. The play test
 * pins what an action button broke here: every row holds both lines, and every
 * row's content starts at the same edge.
 */
export const RecentAssessments: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <div className="w-72 space-y-2">
      {RECENT_ASSESSMENTS.map((assessment) => (
        <AdminListRow key={assessment.id} current={assessment.id === "soil"}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate body-sm font-medium text-text-strong" title={assessment.title}>
                {assessment.title}
              </p>
              <p className="mt-0.5 body-xs text-text-soft">{assessment.date}</p>
            </div>
            <RiArrowRightSLine className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-disabled transition-colors group-hover:text-text-sub" />
          </div>
        </AdminListRow>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const rows = within(canvasElement).getAllByRole("button");
    await expect(rows).toHaveLength(RECENT_ASSESSMENTS.length);

    const contentEdges = new Set<number>();
    for (const row of rows) {
      // A clipped row reports more content than its box shows.
      await expect(row.scrollHeight).toBeLessThanOrEqual(row.clientHeight);
      await expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      const content = row.firstElementChild as HTMLElement;
      contentEdges.add(content.getBoundingClientRect().left - row.getBoundingClientRect().left);
    }
    await expect(contentEdges.size).toBe(1);
    await expect(rows.filter((row) => row.getAttribute("aria-current") === "true")).toHaveLength(1);
  },
};
