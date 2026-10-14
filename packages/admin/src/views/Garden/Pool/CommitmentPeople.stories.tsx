import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { STORY_JOAO, STORY_MARIA } from "./poolStoryActors";
import { CommitmentPeople } from "./CommitmentPeople";

const meta: Meta<typeof CommitmentPeople> = {
  title: "Admin/Pool/CommitmentPeople",
  component: CommitmentPeople,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Who a commitment is between, read as people: the provider does the thing for the receiver, whichever side created the record. The pool row and the inspector's summary line both use it.",
      },
    },
  },
  args: {
    commitment: { direction: "OFFER", creator: STORY_MARIA, counterparty: STORY_JOAO },
  },
  decorators: [
    (Story) => (
      <p className="flex flex-wrap items-center gap-x-1.5 body-xs text-text-soft">
        <Story />
      </p>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CommitmentPeople>;

/** An offer: the creator provides, for the member who took it up. */
export const Offer: Story = {
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/for/)).toBeVisible();
  },
};

/** A request: the member who answered provides, for the member who asked. */
export const Request: Story = {
  args: {
    commitment: { direction: "REQUEST", creator: STORY_MARIA, counterparty: STORY_JOAO },
  },
};

/** A request a garden took up: the person it put forward provides, not the garden's account. */
export const GardenClaim: Story = {
  args: {
    commitment: {
      direction: "REQUEST",
      creator: STORY_MARIA,
      counterparty: "0x4444444444444444444444444444444444444444",
      leadProvider: STORY_JOAO,
    },
  },
};

/** Nobody has taken it up yet: only the creator is named. */
export const NotTakenUp: Story = {
  args: {
    commitment: { direction: "OFFER", creator: STORY_MARIA, counterparty: null },
  },
};
