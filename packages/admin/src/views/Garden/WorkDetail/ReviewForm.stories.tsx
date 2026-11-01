import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import { type ReviewBatch, useReviewBatch } from "@green-goods/shared/hooks/work/useWorkApproval";
import type { Address, Work } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, mocked, userEvent, within } from "storybook/test";
import { withAdminIdentity } from "../../../../../shared/.storybook/decorators";
import { daysAgo, FIXTURE_IMAGE_AGROFORESTRY } from "../../../../../shared/.storybook/fixtures";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { ReviewForm } from "./ReviewForm";

const GARDENER = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN = "0x2222222222222222222222222222222222222222" as Address;

const BASE_WORK: Work = {
  id: "work-1",
  title: "Planted 50 native saplings",
  actionUID: 42,
  gardenerAddress: GARDENER,
  gardenAddress: GARDEN,
  feedback: "",
  metadata: "{}",
  media: [FIXTURE_IMAGE_AGROFORESTRY],
  createdAt: daysAgo(2),
  status: "pending",
};

const APPROVED_WORK: Work = { ...BASE_WORK, status: "approved" };

// Far-future `actionEndTime` keeps the action considered "active". It is in
// milliseconds, like the indexer's action end time and the clock the form
// compares it with. Stories that need the expired state override this.
const ACTIVE_ACTION_END = 4_102_444_800_000; // 2100-01-01

const meta: Meta<typeof ReviewForm> = {
  title: "Admin/Workflows/Hub/ReviewForm",
  component: ReviewForm,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Steward review form for a work submission. Real component wired through `useWorkApproval` with a mock auth identity + mock wagmi connector, so render states (blocked / actionable / reviewed / expired) are real but the submit path is inert.",
      },
    },
  },
  decorators: [
    withAdminIdentity,
    (Story) => (
      <div className="mx-auto max-w-xl p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    work: BASE_WORK,
    gardenName: "Rio Rainforest Lab",
    actionSlug: "agro.planting_event",
    actionEndTime: ACTIVE_ACTION_END,
    canReview: true,
    canApproveOrReject: true,
    isReviewed: false,
    layout: "sheet",
    onSuccess: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ReviewForm>;

export const Actionable: Story = {};

const REVIEW_BATCH = {
  available: true,
  reviews: [],
  approvals: 0,
  rejections: 0,
  signatures: 0,
  signatureStep: 1,
  sendSize: 0,
  blockedCount: 0,
  isSending: false,
  isSettlingHold: false,
  reviewFor: () => undefined,
  isHeld: () => false,
  stage: fn(),
  unstage: fn(),
  unstageBlocked: fn(),
  send: fn(async () => {}),
  holdFeedback: null,
} satisfies ReviewBatch;

/** Once a rail is listed, a decision can wait for the batch instead of going at once. */
export const WithBatch: Story = {
  tags: ["storybook-ci"],
  beforeEach: () => {
    mocked(useReviewBatch).mockReturnValue(REVIEW_BATCH);
    return resetHookMocks(useReviewBatch);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Add to Batch" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Reject" })).toBeEnabled();
  },
};

export const WaitingInBatch: Story = {
  beforeEach: () => {
    mocked(useReviewBatch).mockReturnValue({
      ...REVIEW_BATCH,
      reviewFor: () => ({
        draft: {
          actionUID: BASE_WORK.actionUID,
          workUID: BASE_WORK.id,
          approved: true,
          feedback: "Lovely work, thank you.",
          confidence: 3,
          verificationMethod: 1,
        },
      }),
    });
    return resetHookMocks(useReviewBatch);
  },
};

export const HeldAfterAnUnknownSend: Story = {
  tags: ["storybook-ci"],
  beforeEach: () => {
    mocked(useReviewBatch).mockReturnValue({
      ...REVIEW_BATCH,
      isHeld: () => true,
      holdFeedback: {
        title: "We couldn’t confirm your last reviews.",
        message:
          "They could still land, so these works stay locked until you check again or move on. If they land after you move on, they’ll have two reviews.",
        detail: "0 of 1 have a review recorded now.",
        hasUnreadValues: false,
        isSettling: false,
        isBusy: false,
        onCheckAgain: fn(),
        onMoveOn: fn(),
      },
    });
    return resetHookMocks(useReviewBatch);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Check Again" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Approve" })).toBeNull();
  },
};

export const PublishedSubmitterName: Story = {
  beforeEach: () => {
    mocked(useEnsName).mockReturnValue({ data: "ordinary.eth" } as ReturnType<typeof useEnsName>);
    mocked(useGreenGoodsEnsName).mockReturnValue({ data: "river.greengoods.eth" } as ReturnType<
      typeof useGreenGoodsEnsName
    >);
    return resetHookMocks(useEnsName, useGreenGoodsEnsName);
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/river will see this decision/)).toBeVisible();
  },
};

export const NoPermission: Story = {
  args: {
    canReview: false,
    canApproveOrReject: false,
  },
};

export const RoleBlocked: Story = {
  args: {
    canReview: true,
    canApproveOrReject: false,
  },
};

export const ActionExpired: Story = {
  args: {
    actionEndTime: 1_577_836_800_000, // 2020-01-01
  },
};

export const AlreadyReviewed: Story = {
  args: {
    work: APPROVED_WORK,
    isReviewed: true,
  },
};

/** Reject never sends in one click: it asks why, and the reason becomes the gardener's feedback. */
export const RejectAsksForAReason: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Reject" }));
    const page = within(document.body);
    const confirm = await page.findByRole("button", { name: "Reject Work" });
    await expect(confirm).toBeDisabled();
    await userEvent.click(await page.findByRole("button", { name: "Details are missing" }));
    await expect(confirm).toBeEnabled();
  },
};
