import type { Meta, StoryObj } from "@storybook/react";
import type {
  GardenReviewHealth,
  ReviewHealthWeek,
} from "@green-goods/shared/hooks/admin-ui/garden/useGardenWorkspaceController";
import type { Work } from "@green-goods/shared/types/domain";
import { expect, fn, userEvent, within } from "storybook/test";
import { withAdminIdentity, withRouter } from "../../../../../shared/.storybook/decorators";
import { daysAgo, STORYBOOK_NOW_SECONDS } from "../../../../../shared/.storybook/fixtures";
import { ReviewHealthCard } from "./ReviewHealthCard";

const GARDEN = "0x2222222222222222222222222222222222222222";

function storyWork(id: string, age: number, status: Work["status"]): Work {
  return {
    id,
    title: id,
    actionUID: 1,
    gardenerAddress: "0x1111111111111111111111111111111111111111",
    gardenAddress: GARDEN,
    feedback: "",
    metadata: "{}",
    media: [],
    createdAt: daysAgo(age),
    status,
  };
}

/** Eight Monday-first weeks with these submitted and reviewed counts, oldest first. */
function storyHealth(
  counts: [submitted: number, reviewed: number][],
  overrides: Partial<GardenReviewHealth> = {}
): GardenReviewHealth {
  const today = new Date(STORYBOOK_NOW_SECONDS * 1000);
  const monday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - ((today.getDay() + 6) % 7)
  );
  const weeks: ReviewHealthWeek[] = counts.map(([submitted, reviewed], index) => ({
    start: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7 * (7 - index)),
    submitted: Array.from({ length: submitted }, (_, n) =>
      storyWork(`Week ${index + 1} submission ${n + 1}`, (7 - index) * 7, "pending")
    ),
    reviewed: Array.from({ length: reviewed }, (_, n) =>
      storyWork(`Week ${index + 1} review ${n + 1}`, (7 - index) * 7 + 3, "approved")
    ),
    submittedComplete: true,
    reviewedComplete: true,
    reviewedAvailable: overrides.reviewedAvailable ?? true,
    isCurrent: index === 7,
  }));
  return {
    weeks,
    state: "ready",
    stale: false,
    refreshFailed: false,
    reviewedAvailable: true,
    isFetching: false,
    retry: fn() as unknown as GardenReviewHealth["retry"],
    openWeek: null,
    openList: "submitted",
    weekHref: (week, list) =>
      `/garden/health?week=${week.start.toISOString().slice(0, 10)}&list=${list}`,
    handleCloseWeek: fn(),
    ...overrides,
  };
}

const KEEPING_UP: [number, number][] = [
  [3, 2],
  [5, 4],
  [2, 3],
  [6, 5],
  [4, 4],
  [7, 3],
  [5, 2],
  [2, 0],
];

const meta = {
  title: "Admin/Workflows/Garden/ReviewHealthCard",
  component: ReviewHealthCard,
  tags: ["autodocs"],
  decorators: [withAdminIdentity, withRouter()],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Garden › Health's Review Health: what waits for review now and the last eight weeks of submitted against reviewed, as a chart and a table. Every number opens its records.",
      },
    },
  },
  args: {
    gardenId: GARDEN,
    health: storyHealth(KEEPING_UP),
    waiting: { pendingCount: 9, oldestPendingAt: daysAgo(12) * 1000, complete: true },
  },
} satisfies Meta<typeof ReviewHealthCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EightWeeks: Story = {
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: /Waiting now/ })).toBeVisible();
    // Each week is one link to its records; the table, folded away, links each count.
    // A week's column names both counts; the table's links name one each.
    await expect(canvas.getAllByRole("link", { name: /submitted, .* reviewed$/ })).toHaveLength(8);
    await expect(
      canvas.getByRole("link", { name: /so far: .*submitted, .* reviewed$/ })
    ).toBeVisible();
  },
};

export const PartlyRead: Story = {
  args: {
    health: storyHealth(KEEPING_UP, {
      weeks: storyHealth(KEEPING_UP).weeks.map((week, index) =>
        index < 2 ? { ...week, reviewedComplete: false } : week
      ),
    }),
    waiting: { pendingCount: 40, oldestPendingAt: daysAgo(30) * 1000, complete: false },
  },
};

export const NothingWaiting: Story = {
  args: {
    health: storyHealth(KEEPING_UP.map(([submitted]) => [submitted, submitted])),
    waiting: { pendingCount: 0, oldestPendingAt: null, complete: true },
  },
};

export const Reading: Story = { args: { health: storyHealth(KEEPING_UP, { state: "loading" }) } };

/** Online, a reread failed: the last weeks stay, and the card offers a retry. */
export const RefreshFailed: Story = {
  tags: ["storybook-ci"],
  args: { health: storyHealth(KEEPING_UP, { refreshFailed: true }) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("These are the weeks as last read")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Try Again" }));
    await expect(args.health.retry).toHaveBeenCalledTimes(1);
    await expect(canvas.getAllByRole("link", { name: /submitted, .* reviewed$/ })).toHaveLength(8);
  },
};

/** A chain that records no review decisions: no reviewed counts, never a row of zeros. */
export const NoReviewDecisions: Story = {
  tags: ["storybook-ci"],
  args: {
    health: storyHealth(
      KEEPING_UP.map(([submitted]) => [submitted, 0]),
      { reviewedAvailable: false }
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("Reviewed counts are not available on this network")
    ).toBeVisible();
    await expect(canvas.queryAllByRole("link", { name: /reviewed$/ })).toHaveLength(0);
    await expect(canvas.queryByRole("columnheader", { name: "Reviewed" })).toBeNull();
  },
};

export const CouldNotBeRead: Story = {
  args: { health: storyHealth(KEEPING_UP, { state: "error" }) },
};

export const OpenWeek: Story = {
  args: {
    health: (() => {
      const health = storyHealth(KEEPING_UP);
      return { ...health, openWeek: health.weeks[5], openList: "reviewed" as const };
    })(),
  },
};
