import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent } from "storybook/test";

import { STORY_GROUP_TITLE } from "@/components/Features/Commitments/promiseGroupStoryFixtures";
import { TakeUpOneSheet } from "./TakeUpOneSheet";

/**
 * Taking up one promise from a group (PRD-1029 c3, c3b, c4): a half sheet that
 * repeats what that one promise asks and says the app picks which. It holds
 * while the act is in flight, asks before choosing another when somebody got
 * there first, and never promises more will appear.
 */
const meta: Meta<typeof TakeUpOneSheet> = {
  title: "Client/Commitments/TakeUpOneSheet",
  component: TakeUpOneSheet,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  args: {
    open: true,
    onClose: fn(),
    approvalGated: false,
    actLabelId: "app.pool.group.act.takeUpOne",
    title: STORY_GROUP_TITLE,
    terms: "2 hours · Due Oct 30, 2026",
    state: { step: "idle" },
    onTakeUp: fn(),
    onTakeUpNext: fn(),
    onRefresh: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof TakeUpOneSheet>;

/** Ready (c3): the one promise's terms, that the app picks, the act over Cancel. */
export const Ready: Story = {
  play: async ({ args }) => {
    await expect(
      await screen.findByText("The app picks which one.", { exact: false })
    ).toBeVisible();
    const act = screen.getByRole("button", { name: "Take Up One" });
    await expect(act.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      screen.getByRole("button", { name: "Cancel" }).getBoundingClientRect().top
    );
    await userEvent.click(act);
    await expect(args.onTakeUp).toHaveBeenCalledTimes(1);
  },
};

/** Checking the chosen copy is still free: the act is in flight and the sheet can't close. */
export const Checking: Story = {
  args: { state: { step: "checking", copyId: 104n } },
  play: async () => {
    await expect(await screen.findByText("Checking it's still free…")).toBeVisible();
    await expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  },
};

/** A steward-reviewed group (c3b): it asks for one nobody has asked for yet, and holds nothing. */
export const AskInAReviewedGroup: Story = {
  args: { approvalGated: true, actLabelId: "app.pool.group.act.askToTakeUpOne" },
  play: async () => {
    await expect(
      await screen.findByText("Asking holds nothing for you.", { exact: false })
    ).toBeVisible();
    await expect(screen.getByRole("button", { name: "Ask to Take Up One" })).toBeEnabled();
  },
};

/** Somebody got to the chosen one first (c4): nothing was sent, and it asks before another. */
export const TakenFirst: Story = {
  args: { state: { step: "taken", next: 105n } },
  play: async ({ args }) => {
    await expect(await screen.findByText("Someone got to that one first")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Take Up Another" }));
    await expect(args.onTakeUpNext).toHaveBeenCalledWith(105n);
  },
};

/** None left (c4): it says so, without promising more will appear, and goes back to the group. */
export const NoneLeft: Story = {
  args: { state: { step: "none" } },
  play: async ({ args }) => {
    await expect(await screen.findByText("None are available right now")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Back to the Group" }));
    await expect(args.onClose).toHaveBeenCalledTimes(1);
  },
};

/** The chain refused the send (c4): the failed act's own words, and Try Again. */
export const DidNotGoThrough: Story = {
  args: { state: { step: "failed", copyId: 104n } },
  play: async () => {
    await expect(
      await screen.findByText("It didn’t go through, and nothing changed. You can try again.")
    ).toBeVisible();
    await expect(screen.getByRole("button", { name: "Try Again" })).toBeEnabled();
  },
};

/** A read failed while checking: availability unknown, with Refresh. */
export const AvailabilityUnknown: Story = {
  args: { state: { step: "unknown" } },
  play: async ({ args }) => {
    await expect(await screen.findByText("Availability unknown")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await expect(args.onRefresh).toHaveBeenCalledTimes(1);
  },
};
