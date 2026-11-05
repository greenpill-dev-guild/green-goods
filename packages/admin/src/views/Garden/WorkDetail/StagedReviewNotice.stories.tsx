import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { StagedReviewNotice } from "./StagedReviewNotice";

const APPROVAL = {
  actionUID: 42,
  workUID: "0xwork",
  approved: true,
  feedback: "Lovely work, thank you.",
  confidence: 3,
  verificationMethod: 1,
};

const meta: Meta<typeof StagedReviewNotice> = {
  title: "Admin/Workflows/Hub/StagedReviewNotice",
  component: StagedReviewNotice,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The review form while this work's decision waits in the steward's batch: what was decided, why the last send could not take it if it couldn't, and the way back to deciding again.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-xl p-4">
        <Story />
      </div>
    ),
  ],
  args: { review: { draft: APPROVAL }, onRemove: fn() },
};

export default meta;
type Story = StoryObj<typeof StagedReviewNotice>;

export const Approval: Story = {
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("To approve")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Remove from Batch" })).toBeEnabled();
  },
};

export const Rejection: Story = {
  args: {
    review: {
      draft: {
        ...APPROVAL,
        approved: false,
        feedback: "The photos don't show the planting.",
        confidence: 0,
        verificationMethod: 0,
      },
    },
  },
};

export const Refused: Story = {
  args: { review: { draft: APPROVAL, refusal: "This action has ended." } },
};

export const TooCostly: Story = {
  args: { review: { draft: APPROVAL, notBatchable: true } },
};

export const WhileSending: Story = {
  args: { disabled: true },
};
