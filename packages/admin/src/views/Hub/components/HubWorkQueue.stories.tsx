import type { HubActionSummary } from "@green-goods/shared/hooks/admin-ui/hub/hub.workbenchModel";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import type { ReviewBatch, StagedReview } from "@green-goods/shared/hooks/work/useWorkApproval";
import {
  type Address,
  Confidence,
  Domain,
  VerificationMethod,
  type Work,
  type WorkApprovalDraft,
} from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, mocked, userEvent, waitFor, within } from "storybook/test";
import { daysAgo, FIXTURE_WORK_MEDIA } from "../../../../../shared/.storybook/fixtures";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { DOCUMENTATION_SUBMISSION } from "../../../../../shared/.storybook/submitWorkFixtures";
import { HubWorkQueue } from "./HubWorkQueue";

const GARDENER = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN = "0x2222222222222222222222222222222222222222" as Address;

function work(
  id: string,
  title: string,
  daysAgoCount: number,
  actionUID: number,
  mediaCount = 2
): Work {
  return {
    id,
    title,
    actionUID,
    gardenerAddress: GARDENER,
    gardenAddress: GARDEN,
    feedback: "",
    metadata: "{}",
    media: FIXTURE_WORK_MEDIA.slice(0, mediaCount),
    createdAt: daysAgo(daysAgoCount),
    status: "pending",
  };
}

const PENDING_WORK: Work[] = [
  work("w1", "Planted 50 native saplings", 1, 1, 3),
  work("w2", "Cleared 40kg of debris", 2, 2, 1),
  work("w3", "Led composting workshop", 3, 3, 0),
  work("w4", "Solar panel maintenance", 4, 4, 2),
];

const ACTIONS_MAP = new Map<number, HubActionSummary>([
  [1, { title: "Planting event", domain: Domain.AGRO }],
  [2, { title: "Riverbank cleanup", domain: Domain.WASTE }],
  [3, { title: "Education workshop", domain: Domain.EDU }],
  [4, { title: "Solar service session", domain: Domain.SOLAR }],
]);

const draftFor = (item: Work, approved: boolean): WorkApprovalDraft => ({
  actionUID: item.actionUID,
  workUID: item.id,
  approved,
  feedback: approved ? undefined : "The photos don't show the work.",
  confidence: approved ? Confidence.HIGH : Confidence.NONE,
  verificationMethod: approved ? VerificationMethod.HUMAN : 0,
});

function reviewBatchWith(staged: Record<string, StagedReview>): ReviewBatch {
  const reviews = Object.values(staged);
  const approvals = reviews.filter(({ draft }) => draft.approved).length;
  return {
    available: true,
    reviews,
    approvals,
    rejections: reviews.length - approvals,
    signatures: reviews.length > 0 ? 1 : 0,
    signatureStep: 1,
    sendSize: 0,
    blockedCount: 0,
    oneSignatureEach: false,
    isSending: false,
    isSettlingHold: false,
    reviewFor: (workId) => staged[workId],
    isHeld: () => false,
    stage: fn(),
    unstage: fn(),
    unstageBlocked: fn(),
    send: fn(async () => {}),
    holdFeedback: null,
  };
}

const meta: Meta<typeof HubWorkQueue> = {
  title: "Admin/Workflows/Hub/HubWorkQueue",
  component: HubWorkQueue,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The Hub's Work tab list for one scope: work waiting for review, or work already approved. The scope decides the empty state. Search clears via `onClearSearch`.",
      },
    },
  },
  args: {
    scope: "pending",
    actionsMap: ACTIONS_MAP,
    selectedWorkId: undefined,
    selectedGardenName: "Rio Rainforest Lab",
    normalizedSearch: "",
    debouncedSearch: "",
    onOpenWorkDetail: fn(),
    onClearSearch: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof HubWorkQueue>;

/** One coherent fictional record with the sourced docs photograph; default scenarios remain. */
export const WithExamplePhoto: Story = {
  args: {
    selectedGardenName: "Riverside Commons Garden",
    items: [
      {
        ...work("documentation-seedlings", DOCUMENTATION_SUBMISSION.note, 1, 5, 1),
        media: [DOCUMENTATION_SUBMISSION.photo],
      },
    ],
    actionsMap: new Map([[5, { title: "Seedling Transplant", domain: Domain.AGRO }]]),
    worksLoading: false,
    hasDataError: false,
  },
};

/** Decisions waiting on this list: each work says its own, and a bar holds the send. */
export const WithReviewBatch: Story = {
  tags: ["storybook-ci"],
  args: {
    items: PENDING_WORK,
    worksLoading: false,
    hasDataError: false,
    reviewBatch: reviewBatchWith({
      [PENDING_WORK[0].id]: { draft: draftFor(PENDING_WORK[0], true) },
      [PENDING_WORK[1].id]: { draft: draftFor(PENDING_WORK[1], false) },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("To approve")).toBeVisible();
    await expect(canvas.getByText("To reject")).toBeVisible();
    await expect(canvas.getByText("1 approval, 1 rejection")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Send 2" })).toBeEnabled();
  },
};

/** A failed refresh keeps already loaded work available, with the retry beside it. */
export const LoadedWorkAfterReadFailure: Story = {
  tags: ["storybook-ci"],
  args: {
    items: PENDING_WORK,
    worksLoading: false,
    hasDataError: true,
    older: { onShowOlder: fn(), isLoading: false },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(PENDING_WORK[0].title)).toBeVisible();
    await expect(canvas.getByRole("alert")).toHaveTextContent("Review data could not be loaded");
    await userEvent.click(canvas.getByRole("button", { name: "Show Older Work" }));
    await expect(args.older?.onShowOlder).toHaveBeenCalledTimes(1);
  },
};

/** The staging store has advanced before the work-list query's observers. */
export const JustConfirmedReviews: Story = {
  tags: ["storybook-ci"],
  args: {
    ...WithReviewBatch.args,
    items: PENDING_WORK.slice(0, 2),
    reviewBatch: {
      ...reviewBatchWith({}),
      reviewFor: (id) => ({
        draft: draftFor(PENDING_WORK.find((item) => item.id === id)!, id === PENDING_WORK[0].id),
        confirmed: true,
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Approved")).toBeVisible();
    await expect(canvas.getByText("Rejected")).toBeVisible();
    await expect(canvas.queryByText("Pending")).toBeNull();
    await expect(canvas.queryByRole("button", { name: /^Send/ })).toBeNull();
  },
};

/** At the end of a long queue, the send bar leaves the final work entirely reachable. */
export const BatchLastRowReachable: Story = {
  tags: ["storybook-ci"],
  args: WithReviewBatch.args,
  render: (args) => (
    <div style={{ height: 400, overflow: "auto" }} data-batch-scroll>
      <div className="hub-results-pane">
        <HubWorkQueue {...args} />
      </div>
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const scroll = canvasElement.querySelector<HTMLElement>("[data-batch-scroll]")!;
    const afterLayout = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
    await afterLayout();
    await waitFor(async () => {
      scroll.scrollTop = scroll.scrollHeight;
      await afterLayout();
      const lastWork = canvas.getByText(PENDING_WORK.at(-1)!.title);
      const row = lastWork.closest("li")!;
      const bar = canvas.getByRole("region", { name: "Reviews waiting to send" });
      await expect(row.isConnected).toBe(true);
      await expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
      await expect(row.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        bar.getBoundingClientRect().top
      );
      await expect(lastWork).toBeVisible();
    });
    const lastWork = canvas.getByText(PENDING_WORK.at(-1)!.title);
    await userEvent.click(lastWork);
    await expect(args.onOpenWorkDetail).toHaveBeenCalledWith(PENDING_WORK.at(-1)!.id);
  },
};

/** An unknown send: its work says Checking, and the notice sits above the list. */
export const WithHeldReviews: Story = {
  tags: ["storybook-ci"],
  args: {
    items: PENDING_WORK,
    worksLoading: false,
    hasDataError: false,
    reviewBatch: {
      ...reviewBatchWith({}),
      isHeld: (workId: string) => workId === PENDING_WORK[0].id,
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
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Checking")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Check Again" })).toBeEnabled();
    await expect(canvas.queryByRole("button", { name: /^Send/ })).toBeNull();
  },
};

export const WithData: Story = {
  args: {
    items: PENDING_WORK,
    worksLoading: false,
    hasDataError: false,
  },
};

export const PublishedSubmitterName: Story = {
  args: {
    items: [PENDING_WORK[0]],
    worksLoading: false,
    hasDataError: false,
  },
  beforeEach: () => {
    mocked(useEnsName).mockReturnValue({ data: "ordinary.eth" } as ReturnType<typeof useEnsName>);
    mocked(useGreenGoodsEnsName).mockReturnValue({ data: "river.greengoods.eth" } as ReturnType<
      typeof useGreenGoodsEnsName
    >);
    return resetHookMocks(useEnsName, useGreenGoodsEnsName);
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("river")).toBeVisible();
  },
};

export const Loading: Story = {
  args: {
    items: [],
    worksLoading: true,
    hasDataError: false,
  },
};

export const AllCaughtUp: Story = {
  args: {
    items: [],
    worksLoading: false,
    hasDataError: false,
  },
};

/** The Approved scope is the same list, holding the work a steward has approved. */
export const ApprovedScope: Story = {
  args: {
    scope: "approved",
    items: PENDING_WORK.map((item) => ({ ...item, status: "approved" as const })),
    worksLoading: false,
    hasDataError: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("Approved")).toHaveLength(PENDING_WORK.length);
    await expect(canvas.queryByText("Pending")).toBeNull();
  },
};

export const NoApprovedWork: Story = {
  args: {
    scope: "approved",
    items: [],
    worksLoading: false,
    hasDataError: false,
  },
};

export const NoSearchResults: Story = {
  args: {
    items: [],
    worksLoading: false,
    hasDataError: false,
    normalizedSearch: "foobar",
    debouncedSearch: "foobar",
  },
};

export const DataError: Story = {
  args: {
    items: [],
    worksLoading: false,
    hasDataError: true,
  },
};

export const WithSelection: Story = {
  args: {
    items: PENDING_WORK,
    worksLoading: false,
    hasDataError: false,
    selectedWorkId: "w2",
  },
};

/** Work age is metadata, never an alarm: months-old work still reads as a neutral Pending. */
export const LongWaiting: Story = {
  args: {
    items: [
      work("w-old-1", "Planted 50 native saplings", 10, 1, 3),
      work("w-old-2", "Cleared 40kg of debris", 45, 2, 1),
      work("w-old-3", "Led composting workshop", 200, 3, 0),
    ],
  },
};

/**
 * A garden with more work than the newest page holds: the list says so under its
 * rows and reads the next page on request (PRD-1086).
 */
export const WithOlderWork: Story = {
  tags: ["storybook-ci"],
  args: {
    items: PENDING_WORK,
    worksLoading: false,
    hasDataError: false,
    older: { onShowOlder: fn(), isLoading: false },
  },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Show Older Work" }));
    await expect(args.older?.onShowOlder).toHaveBeenCalledTimes(1);
  },
};

/** Nothing pending in the newest page is not "All caught up" while older work is unread. */
export const NothingPendingInRecentWork: Story = {
  args: {
    items: [],
    worksLoading: false,
    hasDataError: false,
    older: { onShowOlder: fn(), isLoading: false },
  },
};
