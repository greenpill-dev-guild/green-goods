import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { FIXTURE_WORK_MEDIA } from "../../../../../shared/.storybook/fixtures";
import { PendingCard, type PendingCardProps } from "./PendingCard";

const discard = { onDiscard: fn(), discardLabel: "Discard Compost Turn" };

/** One row of each kind Your Work › Pending holds, as the frames draw them. */
const KINDS: Record<string, PendingCardProps> = {
  blocked: {
    kind: "needs",
    pill: "Can't upload",
    title: "Seed Library Count",
    meta: "Saved Oct 4 · 6:12 PM",
    status: "Action ended",
    statusTone: "error",
    thumbnailUrl: FIXTURE_WORK_MEDIA[0],
    ...discard,
  },
  toUpload: {
    kind: "upload",
    pill: "To upload",
    title: "Compost Turn",
    meta: "Saved today · 9:40 AM",
    status: "Nothing sent yet",
    thumbnailUrl: FIXTURE_WORK_MEDIA[1],
    ...discard,
  },
  forAPromise: {
    kind: "upload",
    pill: "To upload",
    title: "Herb Spiral Weeding",
    meta: "Saved today · 8:05 AM",
    marker: { kind: "linked", label: "For a promise" },
    status: "A photo is still converting",
    thumbnailUrl: FIXTURE_WORK_MEDIA[2],
    discardLabel: "Discard Herb Spiral Weeding",
  },
  proof: {
    kind: "upload",
    pill: "To upload",
    title: "Repair the north fence panel by the compost bays before the first frost",
    meta: "Saved today · 10:24 AM",
    marker: { kind: "proof", label: "Proof" },
    status: "Nothing sent yet",
    thumbnailUrl: FIXTURE_WORK_MEDIA[3],
    ...discard,
  },
  draft: {
    kind: "draft",
    pill: "Draft",
    title: "Mulching",
    meta: "2 hours ago",
    status: "Step 2 of 4 · 3 photos",
    ...discard,
  },
  checking: {
    kind: "checking",
    pill: "Checking",
    title: "Path Edging",
    meta: "Saved today · 7:58 AM",
    status: "Checking whether it was sent",
    locked: true,
    thumbnailUrl: FIXTURE_WORK_MEDIA[3],
    discardLabel: "Discard Path Edging",
  },
  inReview: {
    kind: "review",
    pill: "In review",
    title: "Mulch Delivery Log",
    meta: "You submitted · Oct 2",
    status: "Waiting for a review",
    thumbnailUrl: FIXTURE_WORK_MEDIA[2],
    discardLabel: "Discard Mulch Delivery Log",
  },
};

/**
 * One row of Your Work › Pending (D12, D13, D20): the draft card's 88px frame
 * for every kind, the 12px pill top right and the guarded Discard bottom right.
 * The status edge marks blocked work in error, work to upload and anything
 * being checked in information, and work in review in stroke.
 */
const meta: Meta<typeof PendingCard> = {
  title: "Client/Cards/PendingCard",
  component: PendingCard,
  tags: ["autodocs", "storybook-ci"],
  globals: { viewport: { value: "mobile" } },
  args: { onOpen: fn() },
};

export default meta;
type Story = StoryObj<typeof PendingCard>;

export const Blocked: Story = {
  args: KINDS.blocked,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pill = canvas.getByRole("status");
    expect(pill).toHaveTextContent("Can't upload");
    // The 12px pill, 22px tall, beside 12px words (D21).
    expect(pill.getBoundingClientRect().height).toBeCloseTo(22, 0);
    expect(canvas.getByRole("button", { name: "Discard Compost Turn" })).toBeInTheDocument();
  },
};

export const ToUpload: Story = { args: KINDS.toUpload };

export const ForAPromise: Story = { args: KINDS.forAPromise };

export const Proof: Story = { args: KINDS.proof };

export const Draft: Story = { args: KINDS.draft };

/** Nothing can be done to it while a send may be on its way: no Discard. */
export const Checking: Story = {
  args: KINDS.checking,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.queryByRole("button", { name: "Discard Path Edging" })).toBeNull();
  },
};

export const InReview: Story = { args: KINDS.inReview };

/** Every kind in the list's order, at the width the titles have to share with the pill. */
export const EveryKind: Story = {
  render: () => (
    <ul className="flex flex-col gap-3">
      {Object.entries(KINDS).map(([name, props]) => (
        <li key={name}>
          <PendingCard {...props} onOpen={fn()} />
        </li>
      ))}
    </ul>
  ),
};
