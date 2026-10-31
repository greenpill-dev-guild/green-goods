import { restoreDashboardScroll } from "@/components/Navigation/restoreDashboardScroll";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { useActions } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { usePendingProof } from "@green-goods/shared/hooks/client-ui/commitment/usePendingProof";
import { useCommitmentJobs } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentJobs";
import { useLinkedWorkUIDs } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPooling";
import { useCommitmentQueueState } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentQueueState";
import { useDrafts } from "@green-goods/shared/hooks/work/useDrafts";
import type { WorkUploads } from "@green-goods/shared/hooks/work/useWorkUploads";
import en from "@green-goods/shared/i18n/en";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import type { WorkDashboardPendingFilter } from "@green-goods/shared/stores/useUIStore";
import type { Work } from "@green-goods/shared/types/domain";
import type { TimeFilter } from "@green-goods/shared/utils/time";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { IntlProvider, useIntl } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { expect, fn, mocked, userEvent, waitFor, within } from "storybook/test";
import {
  JOURNEY_GARDEN,
  JOURNEY_GARDEN_RECORD,
  JOURNEY_NEIGHBOUR,
  JOURNEY_VIEWER,
  todayAt,
} from "../../../../../shared/.storybook/clientJourneyFixtures";
import { withHeldToast } from "../../../../../shared/.storybook/decorators";
import {
  FIXTURE_IMAGE_BANNER,
  FIXTURE_IMAGE_WASTE,
  FIXTURE_WORK_MEDIA,
  hoursAgo,
} from "../../../../../shared/.storybook/fixtures";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { DOCUMENTATION_SUBMISSION } from "../../../../../shared/.storybook/submitWorkFixtures";
import {
  PENDING_ACTIONS,
  type PendingWorkFixture,
  pendingWorkFixture,
} from "../../../../../shared/.storybook/pendingWorkFixtures";
import { CompletedTab } from "./CompletedTab";
import { PendingTab } from "./PendingTab";
import { ToReviewTab } from "./ToReviewTab";
import { buildUploadAction, type UploadBarState } from "./uploadActions";
import { WorkDashboardShell } from "./WorkDashboardShell";

const PHONE_VIEWPORT = {
  workDashboardPhone360x780: {
    name: "Phone 360 x 780",
    styles: { width: "360px", height: "780px" },
    type: "mobile",
  },
} as const;

const MESSAGES = { en, es, pt } as const;
type Locale = keyof typeof MESSAGES;

type Moment = "all" | "afterCancel" | "afterDiscard" | "empty" | "takeUp";

const EMPTY: PendingWorkFixture = {
  submissions: [],
  drafts: [],
  proofs: [],
  linkedWorkIds: new Set(),
  linkedWorkUIDs: new Set(),
  onPhone: 0,
};

/** Work queued on this phone, for a promise the same tap took up (decision 18). */
function forPromise(id: string, title: string, actionUID: number, savedAt: number): Work {
  return {
    ...gardenWork(id, title, { actionUID, gardenerAddress: JOURNEY_VIEWER, createdAt: savedAt }),
    metadata: JSON.stringify({ clientWorkId: `client-${id}`, submissionState: "ready" }),
    status: "offline",
  };
}

/**
 * The three stages of a take-up chain, as Your Work names them: a work waiting for its take-up,
 * one whose take-up gave up, and a sent work whose link to the promise gave up.
 */
const TAKE_UP_CHAIN: PendingWorkFixture = {
  submissions: [
    forPromise("job-compost", "Compost Turn", 2, hoursAgo(2)),
    forPromise("job-mulch", "Mulching", 4, hoursAgo(3)),
    gardenWork("0x5eed07", "Seedling Transplant", {
      actionUID: 5,
      gardenerAddress: JOURNEY_VIEWER,
      createdAt: hoursAgo(26),
    }),
  ],
  drafts: [],
  proofs: [],
  linkedWorkIds: new Set(["job-compost", "job-mulch"]),
  linkedWorkUIDs: new Set(),
  onPhone: 2,
};
const TAKE_UP_STATES = new Map<string, NonNullable<ReturnType<WorkUploads["statusOf"]>>>([
  ["job-compost", { state: "take-up-pending" }],
  ["job-mulch", { state: "take-up-failed" }],
]);

const fixtureAt = (moment: Moment, documentationPhoto = false) =>
  moment === "empty"
    ? EMPTY
    : moment === "takeUp"
      ? TAKE_UP_CHAIN
      : pendingWorkFixture(moment, documentationPhoto);

/** Work in a garden the steward reviews, and a review of theirs still on this phone. */
function gardenWork(id: string, title: string, overrides: Partial<Work> = {}): Work {
  return {
    id,
    title,
    actionUID: 2,
    gardenerAddress: JOURNEY_NEIGHBOUR,
    gardenAddress: JOURNEY_GARDEN,
    feedback: "",
    metadata: "",
    media: [FIXTURE_WORK_MEDIA[0]],
    createdAt: hoursAgo(5),
    status: "pending",
    ...overrides,
  };
}

const COMPLETED_WORKS: Work[] = [
  gardenWork("0x04", "Seed Library Count", { status: "approved", createdAt: hoursAgo(26) }),
  gardenWork("0x05", "Swale Repair", { status: "rejected", createdAt: hoursAgo(50) }),
];

interface DashboardFrameProps {
  tab: "pending" | "toReview" | "completed";
  /** Where the Pending list stands, as the frames draw it. */
  moment?: Moment;
  /** Opt-in sourced photograph and fictional work, promise proof and draft records; generic scenarios stay unchanged. */
  documentationPhoto?: boolean;
  /** Someone who may review the garden's work: what waits for them, which adds the To Review tab. */
  toReview?: Work[];
  /** Their reviews still on this phone, which Pending lists as their own. */
  decisions?: Work[];
  /** The review read may stop short of all there is, so the tab and its line name no count. */
  uncounted?: boolean;
  isLoading?: boolean;
  hasError?: boolean;
  /** Completed rows. */
  items?: Work[];
  pendingFilter?: WorkDashboardPendingFilter;
  completedFilter?: "all" | "reviewedByYou" | "myWorkReviewed";
  timeFilter?: TimeFilter;
  isFetching?: boolean;
  isOffline?: boolean;
  savedAt?: number;
  /** Queued work and decisions: renders the Pending header action when set. */
  uploads?: Partial<UploadBarState>;
  /** The active garden, named under the title (DL-129); unset draws a member with none. */
  gardenName?: string;
}

/** The frames hand the tab the active garden's rows already, so its own scope keeps them all. */
const IN_ACTIVE_GARDEN = () => true;

const NO_UPLOADS: UploadBarState = {
  readyCount: 0,
  preparingCount: 0,
  pausedForDataSaver: false,
  isPreparing: false,
  isUploading: false,
};

/** The real sheet chrome and tabs, fed the frames' rows instead of the data hooks. */
function DashboardFrame({
  tab,
  moment = "all",
  documentationPhoto = false,
  toReview,
  decisions = [],
  uncounted = false,
  isLoading = false,
  hasError = false,
  items = [],
  pendingFilter = "all",
  completedFilter = "all",
  timeFilter = "month",
  isFetching = false,
  isOffline = false,
  savedAt,
  uploads,
  gardenName,
}: DashboardFrameProps) {
  const intl = useIntl();
  const fixture = fixtureAt(moment, documentationPhoto);
  const uploadAction = uploads
    ? buildUploadAction(
        { ...NO_UPLOADS, ...uploads },
        { onUpload: fn(), onPrepareNow: fn() },
        intl.formatMessage
      )
    : undefined;

  return (
    <WorkDashboardShell
      isClosing={false}
      onRequestClose={fn()}
      gardenName={gardenName}
      pendingCount={fixture.onPhone}
      toReviewCount={toReview && (uncounted ? 0 : toReview.length)}
      activeTab={tab}
      onTabChange={fn()}
    >
      {tab === "pending" ? (
        <PendingTab
          inScope={IN_ACTIVE_GARDEN}
          submissions={fixture.submissions}
          isOnThisDevice={(work) => work.status === "offline"}
          decisions={decisions}
          uploads={{
            pausedForDataSaver: uploads?.pausedForDataSaver ?? false,
            statusOf: (jobId) => (moment === "takeUp" ? TAKE_UP_STATES.get(jobId) : undefined),
            decisionFor: (workId) => {
              const decided = decisions.find((work) => work.id === workId);
              return decided
                ? {
                    jobId: `approval-${workId}`,
                    status: { state: "ready" },
                    savedAt: decided.createdAt * 1000,
                  }
                : undefined;
            },
          }}
          viewer={JOURNEY_VIEWER}
          reads={{
            decisions: { isLoading: false, isError: false },
            myWork: { isLoading: false, isError: false },
          }}
          isFetching={isFetching}
          isOffline={isOffline}
          savedAt={savedAt}
          pendingFilter={pendingFilter}
          onPendingFilterChange={fn()}
          uploadAction={uploadAction}
          onRefresh={fn()}
          onOpenWork={fn()}
          onOpenPath={fn()}
        />
      ) : tab === "toReview" ? (
        <ToReviewTab
          items={toReview ?? []}
          viewer={JOURNEY_VIEWER}
          isLoading={isLoading}
          isFetching={isFetching}
          hasError={hasError}
          uncounted={uncounted}
          onWorkClick={fn()}
          onRefresh={fn()}
          isOffline={isOffline}
          savedAt={savedAt}
        />
      ) : (
        <CompletedTab
          items={items}
          isLoading={false}
          isFetching={isFetching}
          hasError={false}
          onWorkClick={fn()}
          onRefresh={fn()}
          isOffline={isOffline}
          savedAt={savedAt}
          completedFilter={completedFilter}
          onCompletedFilterChange={fn()}
          reviewedByYou={
            new Set(completedFilter === "myWorkReviewed" ? [] : items.map((item) => item.id))
          }
          timeFilter={timeFilter}
          onTimeFilterChange={fn()}
        />
      )}
    </WorkDashboardShell>
  );
}

/** Stories pick a language through `parameters.locale`; the global decorator stays English. */
const withLocale: Decorator = (Story, context) => {
  const locale = (context.parameters.locale as Locale | undefined) ?? "en";
  return (
    <IntlProvider locale={locale} messages={MESSAGES[locale]}>
      <Story />
    </IntlProvider>
  );
};

/**
 * Your Work at phone width: the shared bottom sheet at the full tier with its tabs,
 * Pending and Completed (D3), and To Review for whoever may review the garden's work
 * (DL-149). Pending is the member's own work, one list sorted by what needs them
 * (D12): blocked work, work to upload, drafts, anything being checked, then work
 * in review (O2). Its header is the count, Refresh and Upload all, then the
 * filter, which offers only the states the list holds (D17, D27).
 */
const meta: Meta<typeof DashboardFrame> = {
  title: "Client/Work/WorkDashboard",
  component: DashboardFrame,
  parameters: { layout: "fullscreen", viewport: { options: PHONE_VIEWPORT } },
  globals: { viewport: { value: "workDashboardPhone360x780" } },
  decorators: [
    withLocale,
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  args: { tab: "pending" },
  // The list reads drafts, proof and promise links itself; each story hands it the frame's.
  beforeEach: ({ args }) => {
    const fixture = fixtureAt(args.moment ?? "all", args.documentationPhoto);
    mocked(useDrafts).mockReturnValue({
      drafts: fixture.drafts,
      draftCount: fixture.drafts.length,
      deleteDraft: fn(),
      isDeleting: false,
    } as unknown as ReturnType<typeof useDrafts>);
    mocked(usePendingProof).mockReturnValue({ items: fixture.proofs, isUnavailable: false });
    // A passkey reader unless a story says otherwise: the background flush sends their proof.
    mocked(useCommitmentJobs).mockReturnValue({
      sendsFromTap: false,
    } as unknown as ReturnType<typeof useCommitmentJobs>);
    mocked(useCommitmentQueueState).mockReturnValue({
      linkedWorkIds: fixture.linkedWorkIds,
      failedLinkWorkIds: new Set(args.moment === "takeUp" ? ["0x5eed07"] : []),
    } as unknown as ReturnType<typeof useCommitmentQueueState>);
    mocked(useLinkedWorkUIDs).mockReturnValue({
      linked: fixture.linkedWorkUIDs,
    } as unknown as ReturnType<typeof useLinkedWorkUIDs>);
    mocked(useActions).mockReturnValue({
      data: PENDING_ACTIONS,
    } as unknown as ReturnType<typeof useActions>);
    return resetHookMocks(
      useDrafts,
      usePendingProof,
      useCommitmentJobs,
      useCommitmentQueueState,
      useLinkedWorkUIDs,
      useActions
    );
  },
};

export default meta;
type Story = StoryObj<typeof DashboardFrame>;

/** A mixed garden record: work, promise-linked drafts and proof waiting on this phone. */
export const PendingWithExamplePhoto: Story = {
  args: { documentationPhoto: true, uploads: { readyCount: 2 } },
};

/** Saved items that need a connection before they can reach a steward. */
export const RecoveryWithExamplePhoto: Story = {
  args: { documentationPhoto: true, pendingFilter: "upload", uploads: { readyCount: 2 } },
};

export const OfflineWithExamplePhoto: Story = {
  args: { documentationPhoto: true, isOffline: true, savedAt: hoursAgo(1) * 1000 },
};

/** The gardener's own reviewed work; no steward-only "Reviewed by you" rows. */
export const CompletedWithExamplePhoto: Story = {
  args: {
    tab: "completed",
    completedFilter: "myWorkReviewed",
    items: [
      {
        ...gardenWork("0x5eed04", "Seedling Transplant", {
          status: "approved",
          actionUID: 5,
          gardenerAddress: JOURNEY_VIEWER,
        }),
        media: [DOCUMENTATION_SUBMISSION.photo],
        feedback: DOCUMENTATION_SUBMISSION.note,
      },
      gardenWork("0x5eed05", "Compost Turn", {
        status: "approved",
        gardenerAddress: JOURNEY_VIEWER,
        actionUID: 2,
        media: [FIXTURE_IMAGE_WASTE],
      }),
      gardenWork("0x5eed06", "Path Edging", {
        status: "rejected",
        gardenerAddress: JOURNEY_VIEWER,
        actionUID: 6,
        feedback: "Add a photo showing the full repaired edge.",
        media: [FIXTURE_IMAGE_BANNER],
      }),
    ],
  },
};

const READY: Partial<UploadBarState> = { readyCount: 1, preparingCount: 1, isPreparing: true };

/** Frame `work`: ten rows, eight on this phone, sorted by need. */
export const Pending: Story = {
  args: { uploads: READY },
};

/** Frame `work-upload`: To upload, with Upload all beside it (O3). */
export const PendingToUpload: Story = {
  args: { uploads: READY, pendingFilter: "upload" },
};

/** Frame `work-review`: sent work waiting for someone else; nothing here uploads. */
export const PendingInReview: Story = {
  args: { uploads: READY, pendingFilter: "review" },
};

/** Frame `work-offline`: when the list was saved, no Refresh or Upload all, rows say what waits. */
export const PendingOffline: Story = {
  args: { uploads: READY, isOffline: true, savedAt: todayAt(10, 2) },
};

/**
 * The same list for a wallet reader. Nothing sends their queued proof for them, so its row says to
 * send it once connected, where a passkey reader's says it sends itself.
 */
export const PendingOfflineWallet: Story = {
  args: { uploads: READY, isOffline: true, savedAt: todayAt(10, 2) },
  beforeEach: () => {
    mocked(useCommitmentJobs).mockReturnValue({
      sendsFromTap: true,
    } as unknown as ReturnType<typeof useCommitmentJobs>);
  },
  play: async ({ canvasElement }) => {
    // The sheet draws in a portal, so its rows are found from the page body.
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText("Send it when you're connected")).toBeVisible();
    await expect(body.queryByText("Sends when you're connected")).toBeNull();
  },
};

/** Frame `work-empty`: the sheet tab's empty state at its fixed anchor, no filter. */
export const PendingEmpty: Story = {
  args: { moment: "empty" },
};

/** Frame `work-cancelled`: Seedling Transplant, cancelled at the signature, now waits to upload. */
export const PendingAfterCancel: Story = {
  args: { moment: "afterCancel", uploads: READY },
};

/** Frame `work-discard`: Discard asks first, and says what leaves the device. */
export const PendingDiscard: Story = {
  args: { moment: "afterCancel", uploads: READY },
  play: async ({ canvasElement }) => {
    // The sheet draws in a portal, so its rows are found from the page body.
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("button", { name: "Discard Compost Turn" }));
    await waitFor(() => expect(body.getByText("Discard this work?")).toBeVisible());
    (canvasElement.ownerDocument.activeElement as HTMLElement | null)?.blur();
  },
};

/** Frame `work-discarded`: 8 becomes 7, and the existing toast says so. */
export const PendingDiscarded: Story = {
  args: { moment: "afterDiscard", uploads: READY },
  decorators: [
    withHeldToast((formatMessage) =>
      toastService.success({
        id: "queued-work-action",
        context: "queued work",
        title: formatMessage({ id: "app.uploads.discardedTitle" }),
        message: formatMessage({ id: "app.uploads.discardedMessage" }),
      })
    ),
  ],
};

/** Frame `work-cancelled-home`: cancelled before anything went out, and where the work waits. */
export const UploadCancelledToast: Story = {
  args: { moment: "afterCancel", uploads: READY },
  decorators: [
    withHeldToast((formatMessage) =>
      toastService.info({
        id: "work-upload",
        context: "work upload",
        title: formatMessage({ id: "app.work.sendCancelled.title" }),
        message: formatMessage({ id: "app.work.sendCancelled.message" }),
      })
    ),
  ],
};

const WAITING_FOR_REVIEW: Work[] = [
  gardenWork("0xreview1", "Greenhouse Repair", { createdAt: hoursAgo(20) }),
  gardenWork("0xreview2", "Tool Shed Inventory", { actionUID: 3, createdAt: hoursAgo(44) }),
  gardenWork("0xreview3", "Swale Repair", { actionUID: 6, createdAt: hoursAgo(70) }),
];

/**
 * Pending for someone who may review (DL-149): their own work and a review of theirs still on this
 * phone, and none of the work waiting for them, which the To Review tab counts.
 */
export const PendingSteward: Story = {
  args: {
    uploads: READY,
    toReview: WAITING_FOR_REVIEW,
    decisions: [gardenWork("0xdecided", "Path Edging", { status: "approved" })],
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByTestId("tab-toReview")).toHaveTextContent("3");
    await expect(body.getByText("Your review")).toBeVisible();
    await expect(body.queryByText("Greenhouse Repair")).toBeNull();
  },
};

/** The review queue on its own tab, in the review rows, its count on the tab and the line. */
export const ToReview: Story = {
  args: { tab: "toReview", toReview: WAITING_FOR_REVIEW },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText("3 to review")).toBeVisible();
    await expect(body.getByText("Greenhouse Repair")).toBeVisible();
    await expect(body.getByTestId("tab-toReview")).toHaveTextContent("3");
  },
};

export const ToReviewSpanish: Story = {
  args: { tab: "toReview", toReview: WAITING_FOR_REVIEW },
  parameters: { locale: "es" },
};

export const ToReviewPortuguese: Story = {
  args: { tab: "toReview", toReview: WAITING_FOR_REVIEW },
  parameters: { locale: "pt" },
};

/** Someone who may review with nothing waiting: the tab stays, with no count. */
export const ToReviewEmpty: Story = {
  args: { tab: "toReview", toReview: [] },
};

/** The read may stop short of all there is, so neither the tab nor its line names a number. */
export const ToReviewUncounted: Story = {
  args: { tab: "toReview", toReview: WAITING_FOR_REVIEW, uncounted: true },
};

export const ToReviewLoading: Story = {
  args: { tab: "toReview", toReview: [], isLoading: true },
};

export const ToReviewError: Story = {
  args: { tab: "toReview", toReview: [], hasError: true },
};

/** The same list offline: when it was read, and no Refresh. */
export const ToReviewOffline: Story = {
  args: {
    tab: "toReview",
    toReview: WAITING_FOR_REVIEW,
    isOffline: true,
    savedAt: todayAt(10, 2),
  },
};

/**
 * Work for a promise taken up in the same tap (decision 18): each row names the stage that
 * stopped, the take-up first, the work's own upload after it, and the link once the work is sent.
 */
export const PendingTakeUpChain: Story = {
  args: { moment: "takeUp" },
  play: async ({ canvasElement }) => {
    // The sheet draws in a portal, so its rows are found from the page body.
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText("Takes up the promise first")).toBeVisible();
    await expect(body.getByText("Couldn't take up the promise")).toBeVisible();
    await expect(body.getByText("Couldn't link it to the promise")).toBeVisible();
  },
};

export const PendingTakeUpChainSpanish: Story = {
  args: { moment: "takeUp" },
  parameters: { locale: "es" },
};

export const PendingTakeUpChainPortuguese: Story = {
  args: { moment: "takeUp" },
  parameters: { locale: "pt" },
};

/** The same list where its words run longest. */
export const PendingSpanish: Story = {
  args: { uploads: READY },
  parameters: { locale: "es" },
};

export const PendingPortuguese: Story = {
  args: { uploads: READY },
  parameters: { locale: "pt" },
};

/**
 * In the member's active garden (DL-129): the sheet lists that garden's work
 * only, and the line under its title names the garden in the description's place.
 */
export const PendingInActiveGarden: Story = {
  args: { uploads: READY, gardenName: JOURNEY_GARDEN_RECORD.name },
  play: async ({ canvasElement }) => {
    const sheet = within(canvasElement.ownerDocument.body).getByRole("dialog", {
      name: "Your Work",
    });
    await expect(sheet).toHaveAccessibleDescription("In Riverside Commons Garden");
  },
};

export const PendingInActiveGardenSpanish: Story = {
  args: { uploads: READY, gardenName: JOURNEY_GARDEN_RECORD.name },
  parameters: { locale: "es" },
};

export const PendingInActiveGardenPortuguese: Story = {
  args: { uploads: READY, gardenName: JOURNEY_GARDEN_RECORD.name },
  parameters: { locale: "pt" },
};

export const PendingRefreshing: Story = {
  args: { uploads: READY, isFetching: true },
};

/** Nothing is prepared yet: Upload all waits with a spinner, at the width it keeps once ready. */
export const PendingPreparingUploads: Story = {
  args: { uploads: { preparingCount: 2, isPreparing: true } },
};

/** Data Saver holds preparation back: the header offers Prepare now once nothing is ready. */
export const PendingDataSaver: Story = {
  args: { uploads: { preparingCount: 2, pausedForDataSaver: true } },
  parameters: { locale: "es" },
};

export const PendingUploadingPortuguese: Story = {
  args: { uploads: { readyCount: 2, isUploading: true } },
  parameters: { locale: "pt" },
};

/** Text enlargement keeps the action and filter usable on a narrow phone. */
export const PendingEnlargedText: Story = {
  args: { uploads: READY },
  parameters: { locale: "es" },
  decorators: [
    (Story) => (
      <>
        <style>{"html { font-size: 200%; }"}</style>
        <Story />
      </>
    ),
  ],
};

export const Completed: Story = {
  args: { tab: "completed", items: COMPLETED_WORKS },
};

export const CompletedEmpty: Story = {
  args: { tab: "completed", items: [] },
};

export const CompletedMyWorkReviewedPortuguese: Story = {
  args: { tab: "completed", items: COMPLETED_WORKS, completedFilter: "myWorkReviewed" },
  parameters: { locale: "pt" },
};

/** The tightest Completed row: Spanish, "Tuyos" and "Semana", online and offline. */
export const CompletedSpanishWeek: Story = {
  args: {
    tab: "completed",
    items: COMPLETED_WORKS,
    completedFilter: "myWorkReviewed",
    timeFilter: "week",
  },
  parameters: { locale: "es" },
};

export const CompletedSpanishWeekOffline: Story = {
  args: {
    tab: "completed",
    items: COMPLETED_WORKS,
    completedFilter: "myWorkReviewed",
    timeFilter: "week",
    isOffline: true,
    savedAt: todayAt(10, 2),
  },
  parameters: { locale: "es" },
};

/** Native browser clamping must not let later row updates undo the reader's scroll. */
export const ClampedScrollReturn: Story = {
  tags: ["autodocs", "storybook-ci"],
  play: async ({ canvasElement }) => {
    const scroller = canvasElement.ownerDocument.getElementById("work-dashboard-scroll");
    if (!scroller) throw new Error("WorkDashboard scroll owner is missing");
    await waitFor(() => expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight));
    const completed = fn();
    const dispose = restoreDashboardScroll(
      scroller,
      () => scroller,
      scroller.scrollHeight + 100,
      completed
    );
    const update = canvasElement.ownerDocument.createElement("p");
    update.textContent = "An indexed row changed";
    try {
      expect(scroller.scrollTop).toBeGreaterThan(0);
      scroller.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: -100 }));
      scroller.scrollTop = 0;
      scroller.append(update);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(scroller.scrollTop).toBe(0);
      expect(completed).toHaveBeenCalledOnce();
    } finally {
      dispose();
      update.remove();
    }
  },
};
