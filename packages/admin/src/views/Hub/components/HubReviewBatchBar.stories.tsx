import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { HubReviewBatchBar } from "./HubReviewBatchBar";

const review = (note: object = {}) => ({ draft: {} as never, ...note });

const meta: Meta<typeof HubReviewBatchBar> = {
  title: "Admin/Workflows/Hub/HubReviewBatchBar",
  component: HubReviewBatchBar,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "What a steward has decided and not yet sent, at the bottom of the Hub's Work tab. It says how many signatures a send takes before anyone presses, and which one a send is on.",
      },
    },
  },
  args: {
    gardenName: "Rio Rainforest Lab",
    batch: {
      available: true,
      approvals: 1,
      rejections: 1,
      signatures: 1,
      signatureStep: 1,
      sendSize: 0,
      blockedCount: 0,
      reviews: [review(), review()],
      isSending: false,
      send: fn(async () => {}),
      unstageBlocked: fn(),
    },
  },
};

export default meta;
type Story = StoryObj<typeof HubReviewBatchBar>;

export const Ready: Story = {
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1 approval, 1 rejection")).toBeVisible();
    await expect(canvas.getByText("Rio Rainforest Lab · 1 signature")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Send 2" })).toBeEnabled();
  },
};

/** Twelve reviews take three signatures, and this send is on its second. */
export const Sending: Story = {
  args: {
    batch: {
      ...meta.args!.batch!,
      approvals: 7,
      rejections: 0,
      signatures: 2,
      signatureStep: 2,
      sendSize: 3,
      isSending: true,
    },
  },
};

export const Refused: Story = {
  tags: ["storybook-ci"],
  args: {
    batch: {
      ...meta.args!.batch!,
      blockedCount: 1,
      reviews: [review({ refusal: "This action has ended." }), review()],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/nothing has gone out/)).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Take Out" })).toBeEnabled();
  },
};

export const TooCostlyTogether: Story = {
  args: {
    batch: {
      ...meta.args!.batch!,
      blockedCount: 2,
      reviews: [review({ notBatchable: true }), review({ notBatchable: true })],
    },
  },
};
