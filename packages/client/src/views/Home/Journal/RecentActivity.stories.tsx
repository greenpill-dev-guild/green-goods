import { useGardenRecentActivity } from "@green-goods/shared/hooks/garden/useGardenJournal";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, mocked, within } from "storybook/test";
import { withRouter } from "../../../../../shared/.storybook/decorators";
import { STORYBOOK_NOW_SECONDS } from "../../../../../shared/.storybook/fixtures";
import {
  JOURNAL_WORKS,
  JOURNEY_GARDEN,
  JournalLocales,
  JournalPhone,
  recentActivityFixture,
} from "../../../../../shared/.storybook/homeJournalFixtures";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { RecentActivity } from "./RecentActivity";

type ActivityState = Parameters<typeof recentActivityFixture>[0];

/** Each section the story draws reads its own state, named by its garden id. */
const withStates = (states: Record<string, ActivityState>) => () => {
  mocked(useGardenRecentActivity).mockImplementation((gardenId) =>
    recentActivityFixture(states[gardenId])
  );
  return resetHookMocks(useGardenRecentActivity);
};

const STATES: Record<string, ActivityState> = {
  loading: { status: "loading" },
  empty: { status: "empty" },
  error: { status: "error" },
  offline: { status: "offline" },
  saved: {
    status: "ready",
    items: JOURNAL_WORKS.slice(0, 2),
    savedAt: (STORYBOOK_NOW_SECONDS - 3 * 3_600) * 1000,
  },
};

/**
 * Recent Activity on Home (DL-127, decision 23): the garden's three newest works as the Work
 * tab's rows, with its status pills, the same for every role. A pending row opens the work;
 * no row carries a Review control. See All opens the garden's work. Fictional data.
 */
const meta: Meta<typeof RecentActivity> = {
  title: "Client/Home/RecentActivity",
  component: RecentActivity,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { gardenId: JOURNEY_GARDEN },
  decorators: [withRouter(["/home"])],
  beforeEach: withStates({}),
  render: (args) => (
    <JournalPhone width={390}>
      <RecentActivity {...args} />
    </JournalPhone>
  ),
};

export default meta;
type Story = StoryObj<typeof RecentActivity>;

/** Three works with their own pills, and no Review control on the pending one. */
export const Default: Story = {
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 2, name: "Recent Activity" })).toBeVisible();
    // Whose work it is: the garden's, everyone's, not the member's own (PRD-1492).
    await expect(canvas.getByText("Everyone's work in this garden")).toBeVisible();
    const rows = canvasElement.querySelectorAll<HTMLElement>("[data-component='WorkCard']");
    await expect(rows).toHaveLength(3);
    await expect([...rows].map((row) => within(row).getByRole("status").textContent)).toEqual([
      "Pending",
      "Approved",
      "Rejected",
    ]);
    for (const row of rows) {
      await expect(Math.round(row.getBoundingClientRect().height)).toBe(88);
    }
    await expect(canvas.queryByRole("button", { name: /review/i })).toBeNull();
  },
};

/** English, Spanish and Portuguese at 390 and 360px. */
export const Locales: Story = {
  render: (args) => <JournalLocales render={() => <RecentActivity {...args} />} />,
};

const DAY_MS = 86_400_000;
/** How old each of the three works is: a minute, a month and a year. */
const AGES_MS = [60_000, 31 * DAY_MS, 400 * DAY_MS];
const AGES: ActivityState = {
  status: "ready",
  items: JOURNAL_WORKS.map((work, index) => ({
    ...work,
    createdAt: STORYBOOK_NOW_SECONDS * 1000 - (AGES_MS[index] ?? 0),
  })),
  savedAt: null,
};

/**
 * Ages in every language (PRD-1492): the short form shortens a minute, and keeps a month and a
 * year in full, so Spanish never reads "hace 1 m", a month, beside "hace 1 min".
 */
export const AgesInEveryLanguage: Story = {
  beforeEach: withStates({ [JOURNEY_GARDEN]: AGES }),
  render: (args) => <JournalLocales render={() => <RecentActivity {...args} />} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const age of ["1 month ago", "hace 1 mes", "há 1 mês", "hace 1 año", "hace 1 min"]) {
      await expect(canvas.getAllByText(new RegExp(age)).length).toBeGreaterThan(0);
    }
    await expect(canvas.queryAllByText(/hace 1 m(?!in|es)/)).toHaveLength(0);
  },
};

/**
 * Loading, an offline copy, a garden with no work, a failed read and offline with nothing
 * saved: the section keeps its heading, and each state takes the row's frame.
 */
export const StateCatalog: Story = {
  tags: ["storybook-ci"],
  beforeEach: withStates(STATES),
  render: () => (
    <JournalPhone width={390}>
      {Object.keys(STATES).map((gardenId) => (
        <RecentActivity key={gardenId} gardenId={gardenId} />
      ))}
    </JournalPhone>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Gathering recent activity…")).toHaveAttribute("role", "status");
    await expect(canvas.getByRole("alert")).toHaveTextContent("Couldn't load the work");
    await expect(canvas.getByText("Not saved on this phone yet")).toBeVisible();
    await expect(canvas.getByText(/^Offline · Saved /)).toBeVisible();
    for (const row of canvasElement.querySelectorAll("[data-state]")) {
      await expect(Math.round(row.getBoundingClientRect().height)).toBe(88);
    }
  },
};

/** The states without data, in three languages at both widths, each fitting its one line. */
export const LocalesWithoutData: Story = {
  beforeEach: withStates({ empty: STATES.empty, error: STATES.error, offline: STATES.offline }),
  render: () => (
    <JournalLocales
      render={() => (
        <>
          <RecentActivity gardenId="empty" />
          <RecentActivity gardenId="error" />
          <RecentActivity gardenId="offline" />
        </>
      )}
    />
  ),
};
