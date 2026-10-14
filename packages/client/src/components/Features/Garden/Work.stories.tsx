import type { Action, Work } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { withAppPage, withRouter } from "../../../../../shared/.storybook/decorators";
import { daysAgo, FIXTURE_WORK_MEDIA, hoursAgo } from "../../../../../shared/.storybook/fixtures";
import {
  JOURNEY_GARDEN,
  JOURNEY_NEIGHBOUR,
  JOURNEY_VIEWER,
} from "../../../../../shared/.storybook/clientJourneyFixtures";
import { GardenWork } from "./Work";

function action(id: number, title: string): Action {
  return {
    id: `42161-${id}`,
    slug: `riverside.${id}`,
    title,
    description: title,
    instructions: "",
    capitals: [],
    media: [],
    domain: 0,
    createdAt: daysAgo(90) * 1000,
    startTime: daysAgo(90) * 1000,
    endTime: daysAgo(-90) * 1000,
    inputs: [],
  } as unknown as Action;
}

const ACTIONS = [
  action(1, "Compost Turn"),
  action(2, "Seed Library Count"),
  action(3, "Path Edging"),
  action(4, "Mulch Delivery Log"),
  action(5, "Herb Spiral Weeding"),
];

function work(
  id: string,
  actionUID: number,
  status: Work["status"],
  createdAtSeconds: number,
  media: number,
  gardener = JOURNEY_NEIGHBOUR
): Work {
  return {
    id,
    title: "",
    actionUID,
    gardenerAddress: gardener,
    gardenAddress: JOURNEY_GARDEN,
    feedback: "",
    metadata: "",
    media: FIXTURE_WORK_MEDIA.slice(0, Math.min(media, FIXTURE_WORK_MEDIA.length)),
    createdAt: createdAtSeconds * 1000,
    status,
  };
}

/** The garden's work in the design frame's order before sorting: two waiting, four decided. */
const WORKS = [
  work("w1", 1, "pending", hoursAgo(1), 2),
  work("w2", 2, "pending", hoursAgo(2), 3, JOURNEY_VIEWER),
  work("w3", 1, "approved", daysAgo(1), 2),
  work("w4", 3, "approved", daysAgo(3), 4),
  work("w5", 4, "rejected", daysAgo(5), 1, JOURNEY_VIEWER),
  work("w6", 5, "approved", daysAgo(7), 2),
];

/**
 * The garden's Work tab: the Promises tab's header row with the count, then Type
 * (the garden's actions that have work here, A to Z) and Sort (Pending first by
 * default, Newest first, Oldest first). Loading keeps the header and the cards'
 * own frames instead of a spinner.
 */
const meta: Meta<typeof GardenWork> = {
  title: "Client/Garden/GardenWork",
  component: GardenWork,
  tags: ["autodocs"],
  globals: { viewport: { value: "mobile" } },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="px-4 pb-24 pt-3">
        <Story />
      </div>
    ),
    withRouter(["/home/garden"]),
    withAppPage,
  ],
  args: {
    works: WORKS,
    actions: ACTIONS,
    readState: { isError: false, isLoading: false, isPaused: false, availability: "available" },
  },
};

export default meta;
type Story = StoryObj<typeof GardenWork>;

export const AllWork: Story = {
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The count is the bare number; screen readers hear what it counts.
    const status = canvas.getByRole("status");
    await expect(within(status).getByText("6")).toBeVisible();
    await expect(within(status).getByText("6 submissions")).toHaveClass("sr-only");
    const type = canvas.getByRole("combobox", { name: "Type of work" });
    // All work, then the actions that have work here, A to Z.
    await expect([...(type as HTMLSelectElement).options].map((option) => option.text)).toEqual([
      "All work",
      "Compost Turn",
      "Herb Spiral Weeding",
      "Mulch Delivery Log",
      "Path Edging",
      "Seed Library Count",
    ]);
    await expect(canvas.getByRole("combobox", { name: "Sort" })).toHaveValue("pending");
  },
};

/** One type chosen: only that action's work, still pending first. */
export const OneType: Story = {
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: "Type of work" }), "1");
    await expect(within(canvas.getByRole("status")).getByText("2")).toBeVisible();
  },
};

export const Loading: Story = {
  tags: ["storybook-ci"],
  args: {
    works: [],
    readState: { isError: false, isLoading: true, isPaused: false, availability: "available" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent("Gathering… this garden's work");
    await expect(canvasElement.querySelectorAll("[data-skeleton=work-card]")).toHaveLength(5);
  },
};

/** Offline, the saved copy's line takes the count's place; Type and Sort still narrow it. */
export const Offline: Story = {
  args: {
    readState: {
      isError: false,
      isLoading: false,
      isPaused: true,
      availability: "available",
      lastSuccessfulRefresh: hoursAgo(1) * 1000,
    },
  },
};

export const LoadError: Story = {
  args: {
    works: [],
    readState: { isError: true, isLoading: false, isPaused: false, availability: "unavailable" },
    onRefresh: () => undefined,
  },
};
