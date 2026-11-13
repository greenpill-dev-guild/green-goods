import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { REPORTING_LAB_MEDIA } from "../../../../shared/.storybook/reportingLabFixtures";
import { ReportingLab } from "./ReportingLab";

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Lab",
  component: ReportingLab,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Garden reporting review lab: a Storybook-only prototype, not routed and not part of the app. The reviewer bar picks the scenario, the interface, the viewer's role and the naming candidate; the product preview below renders the cockpit's real AppBar, GardenChip, MainSheet and NavigationBar around the proposed Reports page. Every figure is synthetic sample data fixed at Jan 16, 2026, the Storybook clock.",
      },
    },
  },
  decorators: [
    withCanvasFrame({ workspace: "garden", className: "p-0", heightClassName: "min-h-screen" }),
  ],
  args: { media: REPORTING_LAB_MEDIA },
} satisfies Meta<typeof ReportingLab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The integrated overview: calendar first, review health beside it, then trends and the other reports. */
export const Overview: Story = {};

export const OverviewWithNotes: Story = { args: { initial: { panel: "notes" } } };

/** The product preview alone, for checking widths without the reviewer bar. */
export const ProductPreview: Story = { args: { showReviewer: false } };

export const GrowingBacklog: Story = { args: { initial: { scenario: "compost-backlog" } } };

export const SparseLearningGarden: Story = { args: { initial: { scenario: "learning" } } };

export const LongLabels: Story = { args: { initial: { scenario: "learning-long" } } };

/** Today's read: the newest 50 records, some approvals unread, and Load Older. */
export const PartialRead: Story = { args: { initial: { scenario: "partial" } } };

/** A garden that began on Jan 5 with no work: zero days stay apart from days before it began. */
export const NewGarden: Story = { args: { initial: { scenario: "new-garden" } } };

export const Loading: Story = { args: { initial: { scenario: "loading" } } };

export const ReadFailed: Story = { args: { initial: { scenario: "error" } } };

export const NamingCandidates: Story = {
  args: { initial: { panel: "naming", nameId: "steward-hub", hubLabel: "review" } },
};

export const Interface1Calendar: Story = {
  args: { initial: { view: "calendar", panel: "notes" } },
};

/** December read at its own end: the work reviewed in January still shows as pending. */
export const Interface1DecemberAtMonthEnd: Story = {
  args: {
    initial: { view: "calendar" },
    initialScope: { month: "2025-12", statusAsOf: "period-end" },
  },
};

export const Interface2ReviewHealth: Story = {
  args: { initial: { view: "review", scenario: "compost-backlog", panel: "notes" } },
};

export const Interface2ReviewStalled: Story = {
  args: { initial: { view: "review", scenario: "learning" } },
};

export const Interface3OutputTrends: Story = {
  args: { initial: { view: "outputs", panel: "notes" } },
};

export const Interface4SeasonTimeline: Story = {
  args: { initial: { view: "season", panel: "notes" } },
};

export const Interface5Places: Story = { args: { initial: { view: "places", panel: "notes" } } };

export const Interface6Participation: Story = {
  args: { initial: { view: "people", scenario: "learning", panel: "notes" } },
};

/** A funder sees totals; account-level rows stay with stewards and evaluators. */
export const Interface6FunderViewer: Story = {
  args: { initial: { view: "people", role: "funder" } },
};

export const Interface7FundingHistory: Story = {
  args: { initial: { view: "funding", panel: "notes" } },
};

export const Interface8EvidenceIllustrated: Story = {
  args: { initial: { view: "evidence", panel: "notes" } },
};

/** The learning garden: a baseline with no later observation and no dated evidence. */
export const Interface8EvidenceMissing: Story = {
  args: { initial: { view: "evidence", scenario: "learning" } },
};

/** From the keyboard, a day opens its records in the AdminDialog, and Escape hands focus back to the day. */
export const DayDrillDown: Story = {
  args: { initial: { view: "calendar" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const day = await canvas.findByRole("button", { name: /^Tuesday, January 13/ });
    // The keyboard path: focus the day, open it with Enter, close with Escape.
    day.focus();
    await userEvent.keyboard("{Enter}");
    // The dialog is named by its title, the day the steward opened.
    await expect(
      await within(document.body).findByRole("dialog", { name: "Tuesday, January 13" })
    ).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    // Focus comes back when the dialog unmounts, after its exit animation.
    await waitFor(() => expect(day).toHaveFocus(), { timeout: 3000 });
  },
};
