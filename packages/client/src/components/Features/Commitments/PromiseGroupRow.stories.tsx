import type { Meta, StoryObj } from "@storybook/react";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import { IntlProvider } from "react-intl";
import { expect, fn, userEvent, within } from "storybook/test";

import { CommitmentRow } from "./CommitmentRow";
import { PromiseGroupRow } from "./PromiseGroupRow";
import { STORY_GROUP_TITLE, storyGroup } from "./promiseGroupStoryFixtures";

/**
 * Many separate promises made alike, as one row on the Promises tab (PRD-1029
 * c1): the promise row's 88px frame and direction edge, a stack tile carrying
 * how many promises there are, and the counts with availability first.
 */
const meta: Meta<typeof PromiseGroupRow> = {
  title: "Client/Commitments/PromiseGroupRow",
  component: PromiseGroupRow,
  tags: ["autodocs", "storybook-ci"],
  globals: { viewport: { value: "mobile" } },
  decorators: [
    (Story) => (
      <div className="max-w-sm space-y-2 p-4">
        <Story />
      </div>
    ),
  ],
  args: { title: STORY_GROUP_TITLE, onOpen: fn() },
};

export default meta;
type Story = StoryObj<typeof PromiseGroupRow>;

/** Ten requests: four available, three in progress, three kept. One 88px row, no progress bar. */
export const Available: Story = {
  args: { group: storyGroup({ available: 4, inProgress: 3, kept: 3 }).group },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByRole("button", { name: /A group of 10 separate promises/ });
    await expect(row.getBoundingClientRect().height).toBe(88);
    await expect(row).toHaveTextContent("4 available · 3 in progress · 3 kept");
    await expect(canvas.queryByRole("progressbar")).toBeNull();
    await userEvent.click(row);
    await expect(args.onOpen).toHaveBeenCalledTimes(1);
  },
};

/** Every one taken up or kept: the line still leads with availability. */
export const NoneAvailable: Story = {
  args: { group: storyGroup({ available: 0, inProgress: 6, kept: 4 }).group },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button")).toHaveTextContent(
      "None available · 6 in progress · 4 kept"
    );
  },
};

/** The pool couldn't be read again: the counts say so, never 0 (c9). */
export const AvailabilityUnknown: Story = {
  args: {
    group: storyGroup({ available: 4, inProgress: 3, kept: 3 }).group,
    availabilityUnknown: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/^Availability unknown/)).toBeVisible();
    await expect(canvas.queryByText(/0 available/)).toBeNull();
  },
};

/**
 * Back in the list after taking one up (c5l): the reader's copy is an ordinary
 * row with their relationship, and the group counts one fewer available.
 */
export const InTheListAfterTakingOne: Story = {
  render: (args) => {
    const { group, yours } = storyGroup({
      available: 3,
      inProgress: 4,
      kept: 3,
      yours: "inProgress",
    });
    return (
      <>
        {yours.map((row) => (
          <CommitmentRow key={row.commitment.id} row={row} title={STORY_GROUP_TITLE} />
        ))}
        <PromiseGroupRow {...args} group={group} />
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // A copy just taken up waits on its taker's proof, so its row says so first.
    await expect(canvas.getByText("Needs you")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: /A group of 10 separate promises/ })
    ).toHaveTextContent("3 available · 4 in progress · 3 kept");
  },
};

/** All four counts with long local titles at the same approved 88px row height. */
export const FourCounts: Story = {
  args: {
    group: storyGroup({ available: 4, inProgress: 3, kept: 2, ended: 1 }).group,
    title: "Household water survey across the whole community garden",
  },
};

export const SpanishFourCounts: Story = {
  ...FourCounts,
  decorators: [
    (Story) => (
      <IntlProvider locale="es" messages={es}>
        <Story />
      </IntlProvider>
    ),
  ],
  args: { ...FourCounts.args, title: "Encuesta sobre el agua en los hogares de toda la comunidad" },
};

export const PortugueseFourCounts: Story = {
  ...FourCounts,
  decorators: [
    (Story) => (
      <IntlProvider locale="pt" messages={pt}>
        <Story />
      </IntlProvider>
    ),
  ],
  args: { ...FourCounts.args, title: "Pesquisa sobre a água das famílias de toda a comunidade" },
};
