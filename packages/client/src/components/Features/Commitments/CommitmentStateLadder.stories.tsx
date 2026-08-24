import type { CommitmentPoolingAvailability } from "@green-goods/shared/commitment-pooling";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { CommitmentStateLadder } from "./CommitmentStateLadder";

const AVAILABLE = {
  status: "available",
  capability: {},
} as unknown as CommitmentPoolingAvailability;
const UNAVAILABLE = {
  status: "unavailable",
  reason: "not-integrated",
  capability: {},
} as unknown as CommitmentPoolingAvailability;

const COPY = {
  loadingId: "app.commitments.live.loading",
  errorId: "app.commitments.live.error",
  emptyTitleId: "app.commitments.live.emptyTitle",
  emptyDescriptionId: "app.commitments.live.emptyDescription",
};

/**
 * The ladder every commitments tab climbs before it shows a list: surface not
 * ready, still finding out, the read failed, offline with nothing cached, and
 * genuinely empty. Each says its own thing so "no commitments" is never the
 * message when the app simply cannot see any.
 */
const meta: Meta<typeof CommitmentStateLadder> = {
  title: "Client/Commitments/CommitmentStateLadder",
  component: CommitmentStateLadder,
  tags: ["autodocs", "storybook-ci"],
  parameters: { viewport: { defaultViewport: "mobile1" }, layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="flex h-[560px] flex-col bg-bg-white-0">
        <Story />
      </div>
    ),
  ],
  args: {
    availability: AVAILABLE,
    isLoading: false,
    isError: false,
    isOnline: true,
    isEmpty: false,
    onRetry: fn(),
    copy: COPY,
    children: (
      <div className="rounded-[var(--radius-lg)] border border-stroke-soft-200 p-3 text-sm">
        A list would go here.
      </div>
    ),
  },
};

export default meta;
type Story = StoryObj<typeof CommitmentStateLadder>;

export const NotReady: Story = {
  args: { availability: UNAVAILABLE, isLoading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: { isLoading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toBeVisible();
  },
};

export const ReadError: Story = {
  args: { isError: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const retry = canvas.getByRole("button", { name: "Try again" });
    retry.click();
    await expect(args.onRetry).toHaveBeenCalled();
  },
};

export const OfflineAndEmpty: Story = {
  args: { isEmpty: true, isOnline: false },
};

export const Empty: Story = {
  args: { isEmpty: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Nothing moving right now")).toBeVisible();
  },
};

export const WithContent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("A list would go here.")).toBeVisible();
  },
};
