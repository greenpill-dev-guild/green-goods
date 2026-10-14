import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";

import {
  STORY_GROUP_NOTE,
  STORY_GROUP_TITLE,
  storyGroup,
} from "@/components/Features/Commitments/promiseGroupStoryFixtures";
import { withAppPage, withRouter } from "../../../../../../shared/.storybook/decorators";
import { JoinToActCard } from "../Commitment/JoinToAct";
import { PromiseGroupPage, type PromiseGroupPageProps } from "./PromiseGroupPage";

const page = (
  spread: Parameters<typeof storyGroup>[0],
  overrides: Partial<PromiseGroupPageProps> = {}
): Partial<PromiseGroupPageProps> => {
  const { group, sample, yours } = storyGroup(spread);
  return {
    sample,
    counts: group.counts,
    yours,
    bar: { act: yours.length > 0 ? "takeUpAnother" : "takeUp", hold: null },
    ...overrides,
  };
};

/**
 * A group's page (PRD-1029 c2): what each one asks, how many are available, in
 * progress and kept, the reader's own copies, and one act in the fixed bar,
 * which takes up one copy the app picks. Fictional data.
 */
const meta: Meta<typeof PromiseGroupPage> = {
  title: "Client/Commitments/PromiseGroupPage",
  component: PromiseGroupPage,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  decorators: [withRouter(["/home/garden/commitments/group/story-water-survey"]), withAppPage],
  args: {
    title: STORY_GROUP_TITLE,
    note: STORY_GROUP_NOTE,
    availabilityKnown: true,
    cap: 2n,
    isPending: false,
    isOnline: true,
    queueUnreadable: false,
    onBack: fn(),
    onRefresh: fn(),
    onRun: fn(),
    onOpenCopy: fn(),
    ...page({ available: 4, inProgress: 3, kept: 3 }),
  },
};

export default meta;
type Story = StoryObj<typeof PromiseGroupPage>;

/** Nobody's taken one of these up yet here: Take Up One, and the pool's at-once limit, stated once. */
export const Open: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("region", { name: "What each one asks" })).toHaveTextContent(
      "2 hours"
    );
    await expect(
      canvas.getByText("You can hold up to 2 promises from this pool at once.")
    ).toBeVisible();
    await expect(canvas.getByRole("region", { name: "Right now" })).toHaveTextContent(
      "4 available · 3 in progress · 3 kept"
    );
    await expect(canvas.queryByRole("region", { name: "Yours" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Take Up One" }));
    await expect(args.onRun).toHaveBeenCalledTimes(1);
  },
};

/** The reader holds one (c5l): it sits under Yours as its own row, and the act says Another. */
export const HoldsOne: Story = {
  args: page({ available: 3, inProgress: 4, kept: 3, yours: "inProgress" }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const yours = canvas.getByRole("region", { name: "Yours" });
    await userEvent.click(within(yours).getByRole("button"));
    await expect(args.onOpenCopy).toHaveBeenCalledWith(104n);
    await expect(canvas.getByRole("button", { name: "Take Up Another" })).toBeEnabled();
  },
};

/** The reader's copy was kept while the others stay open (c6b): each keeps its own state. */
export const KeptWhileOthersStayOpen: Story = {
  args: page({ available: 5, inProgress: 2, kept: 3, yours: "kept" }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      within(canvas.getByRole("region", { name: "Yours" })).getByText("Kept")
    ).toBeVisible();
    await expect(canvas.getByText(/^5 available/)).toBeVisible();
  },
};

/** A steward-reviewed group (c8): the act asks, and an ask reserves nothing. */
export const StewardReviewed: Story = {
  args: page({ available: 4, inProgress: 3, kept: 3 }, { bar: { act: "askToTakeUp", hold: null } }),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Ask to Take Up One" })
    ).toBeEnabled();
  },
};

/** At the pool's at-once limit (c9): the act is held and says finishing one frees a place. */
export const AtTheLimit: Story = {
  args: page(
    { available: 4, inProgress: 3, kept: 3, yours: "inProgress" },
    { bar: { act: "takeUpAnother", hold: "limit" } }
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Take Up Another" })).toBeDisabled();
    await expect(canvas.getByText(/Finishing one frees a place\./)).toBeVisible();
  },
};

/** The pool is paused or closed: the chain refuses a take-up, so the act waits and says why. */
export const PoolNotOpen: Story = {
  args: page({ available: 4, inProgress: 3, kept: 3 }, { bar: { act: "takeUp", hold: "closed" } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Take Up One" })).toBeDisabled();
    await expect(
      canvas.getByText("This pool isn't open for taking promises up right now.")
    ).toBeVisible();
  },
};

/** Availability couldn't be read (c9): unknown with Refresh, never 0, and the group stays. */
export const AvailabilityUnknown: Story = {
  args: page(
    { available: 4, inProgress: 3, kept: 3 },
    { availabilityKnown: false, bar: { act: "takeUp", hold: "unknown" } }
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("region", { name: "Right now" })).toHaveTextContent(
      "Availability unknown"
    );
    await expect(canvas.queryByText(/\b0 available/)).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Refresh" }));
    await expect(args.onRefresh).toHaveBeenCalledTimes(1);
  },
};

/** Every one taken up or kept: the act waits, saying none are available right now. */
export const NoneAvailable: Story = {
  args: page({ available: 0, inProgress: 7, kept: 3 }, { bar: { act: "takeUp", hold: "none" } }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("None are available right now")).toBeVisible();
  },
};

/** A signed-in reader outside the garden: no act, and the join card in its place. */
export const NotAMember: Story = {
  args: page(
    { available: 4, inProgress: 3, kept: 3 },
    {
      bar: null,
      join: (
        <JoinToActCard
          mode="join"
          gardenName="Riverside Commons Garden"
          isBusy={false}
          onAct={() => undefined}
        />
      ),
    }
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button", { name: "Take Up One" })).toBeNull();
  },
};
