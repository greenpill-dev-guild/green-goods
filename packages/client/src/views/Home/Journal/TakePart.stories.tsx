import {
  useGardenOpenCycles,
  useGardenOpenPromises,
} from "@green-goods/shared/hooks/garden/useGardenJournal";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, mocked, within } from "storybook/test";
import { withRouter, withSeededQueryClient } from "../../../../../shared/.storybook/decorators";
import {
  JOURNEY_CYCLE_NAMES,
  JOURNEY_GARDEN,
  JournalLocales,
  JournalPhone,
  openCyclesFixture,
  openPromisesFixture,
} from "../../../../../shared/.storybook/homeJournalFixtures";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { TakePart } from "./TakePart";

type PromisesState = Parameters<typeof openPromisesFixture>[0];

/** Each section the story draws reads its own state, named by its garden id. */
const withStates = (states: Record<string, PromisesState>) => () => {
  mocked(useGardenOpenPromises).mockImplementation((gardenId) =>
    openPromisesFixture(states[gardenId])
  );
  mocked(useGardenOpenCycles).mockReturnValue(openCyclesFixture());
  return resetHookMocks(useGardenOpenPromises, useGardenOpenCycles);
};

const STATES: Record<string, PromisesState> = {
  loading: { status: "loading" },
  empty: { status: "empty" },
  error: { status: "error" },
  offline: { status: "offline" },
  unavailable: { status: "unavailable" },
};

/**
 * Take Part on Home (DL-127, decision 32): the garden's open and asked-for promises as the
 * Pool tab's commitment rows, each opening its own page, and See All opening the Promises
 * sheet. No second promise workflow. Fictional data from the client journeys.
 */
const meta: Meta<typeof TakePart> = {
  title: "Client/Home/TakePart",
  component: TakePart,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { gardenId: JOURNEY_GARDEN },
  decorators: [withSeededQueryClient(JOURNEY_CYCLE_NAMES), withRouter(["/home"])],
  beforeEach: withStates({}),
  render: (args) => (
    <JournalPhone width={390}>
      <TakePart {...args} />
    </JournalPhone>
  ),
};

export default meta;
type Story = StoryObj<typeof TakePart>;

/** The open offers and the open ask, as commitment rows of one height. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 2, name: "Take Part" })).toBeVisible();
    const rows = canvasElement.querySelectorAll<HTMLElement>("[data-component='CommitmentRow']");
    await expect(rows).toHaveLength(3);
    for (const row of rows) {
      await expect(Math.round(row.getBoundingClientRect().height)).toBe(88);
    }
    await expect(
      canvas.getByRole("button", { name: /Two hours sorting the seed library/ })
    ).toHaveTextContent("Asked for");
  },
};

/**
 * A Home without the Highlights carousel stands each open season and campaign as one line
 * above the promises, each opening its details sheet (decision 32). Off by default.
 */
export const WithCycleLines: Story = {
  args: { withCycleLines: true },
  render: (args) => <JournalLocales render={() => <TakePart {...args} />} />,
};

/** English, Spanish and Portuguese at 390 and 360px. */
export const Locales: Story = {
  render: (args) => <JournalLocales render={() => <TakePart {...args} />} />,
};

/**
 * Loading, nothing open, a failed read, offline with nothing saved, and a chain where promises
 * do not run yet: the heading stays, and each state takes the row's frame.
 */
export const StateCatalog: Story = {
  tags: ["storybook-ci"],
  beforeEach: withStates(STATES),
  render: () => (
    <JournalPhone width={390}>
      {Object.keys(STATES).map((gardenId) => (
        <TakePart key={gardenId} gardenId={gardenId} />
      ))}
    </JournalPhone>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent("Gathering open promises…");
    await expect(canvas.getByRole("alert")).toHaveTextContent("Couldn't load the list");
    await expect(canvas.getByText("Promises aren't available yet")).toBeVisible();
    for (const row of canvasElement.querySelectorAll("[data-state]")) {
      await expect(Math.round(row.getBoundingClientRect().height)).toBe(88);
    }
  },
};

/** The states without data, in three languages at both widths, each fitting its one line. */
export const LocalesWithoutData: Story = {
  beforeEach: withStates({
    empty: STATES.empty,
    error: STATES.error,
    unavailable: STATES.unavailable,
  }),
  render: () => (
    <JournalLocales
      render={() => (
        <>
          <TakePart gardenId="empty" />
          <TakePart gardenId="error" />
          <TakePart gardenId="unavailable" />
        </>
      )}
    />
  ),
};
