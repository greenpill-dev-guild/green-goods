import { restoreDashboardScroll } from "@/components/Navigation/restoreDashboardScroll";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { useActions } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { usePendingProof } from "@green-goods/shared/hooks/client-ui/commitment/usePendingProof";
import { useCommitmentJobs } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentJobs";
import { useLinkedWorkUIDs } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPooling";
import { useCommitmentQueueState } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentQueueState";
import { useDrafts } from "@green-goods/shared/hooks/work/useDrafts";
import en from "@green-goods/shared/i18n/en";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import type { WorkDashboardPendingFilter } from "@green-goods/shared/stores/useUIStore";
import type { Work } from "@green-goods/shared/types/domain";
import type { TimeFilter } from "@green-goods/shared/utils/time";
import { RiCheckLine, RiTaskLine } from "@remixicon/react";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { IntlProvider, useIntl } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { expect, fn, mocked, userEvent, waitFor, within } from "storybook/test";
import {
  JOURNEY_GARDEN,
  JOURNEY_NEIGHBOUR,
  JOURNEY_VIEWER,
  todayAt,
} from "../../../../../shared/.storybook/clientJourneyFixtures";
import { withHeldToast } from "../../../../../shared/.storybook/decorators";
import { FIXTURE_WORK_MEDIA, hoursAgo } from "../../../../../shared/.storybook/fixtures";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import {
  PENDING_ACTIONS,
  type PendingWorkFixture,
  pendingWorkFixture,
} from "../../../../../shared/.storybook/pendingWorkFixtures";
import { CompletedTab } from "./CompletedTab";
import { PendingTab } from "./PendingTab";
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

type Moment = "all" | "afterCancel" | "afterDiscard" | "empty";

const EMPTY: PendingWorkFixture = {
  submissions: [],
  drafts: [],
  proofs: [],
  linkedWorkIds: new Set(),
  linkedWorkUIDs: new Set(),
  onPhone: 0,
};

const fixtureAt = (moment: Moment) => (moment === "empty" ? EMPTY : pendingWorkFixture(moment));

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
  tab: "pending" | "completed";
  /** Where the Pending list stands, as the frames draw it. */
  moment?: Moment;
  /** A steward's view: work waiting for their review, and their reviews still on this phone. */
  toReview?: Work[];
  decisions?: Work[];
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
}

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
  toReview = [],
  decisions = [],
  items = [],
  pendingFilter = "all",
  completedFilter = "all",
  timeFilter = "month",
  isFetching = false,
  isOffline = false,
  savedAt,
  uploads,
}: DashboardFrameProps) {
  const intl = useIntl();
  const fixture = fixtureAt(moment);
  const uploadAction = uploads
    ? buildUploadAction(
        { ...NO_UPLOADS, ...uploads },
        { onUpload: fn(), onPrepareNow: fn() },
        intl.formatMessage
      )
    : undefined;
  const tabs = [
    {
      id: "pending",
      icon: <RiTaskLine className="w-4 h-4" />,
      label: intl.formatMessage({ id: "app.workDashboard.tabs.pending" }),
      count: fixture.onPhone > 0 ? fixture.onPhone : undefined,
    },
    {
      id: "completed",
      icon: <RiCheckLine className="w-4 h-4" />,
      label: intl.formatMessage({ id: "app.workDashboard.tabs.completed" }),
    },
  ];

  return (
    <WorkDashboardShell
      isClosing={false}
      onRequestClose={fn()}
      tabs={tabs}
      activeTab={tab}
      onTabChange={fn()}
    >
      {tab === "pending" ? (
        <PendingTab
          submissions={fixture.submissions}
          isOnThisDevice={(work) => work.status === "offline"}
          toReview={toReview}
          decisions={decisions}
          uploads={{
            pausedForDataSaver: uploads?.pausedForDataSaver ?? false,
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
            needsReview: { isLoading: false, isError: false },
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
 * Your Work at phone width: the shared bottom sheet at the full tier with its two
 * tabs, Pending and Completed (D3). Pending is one list sorted by what needs you
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
    const fixture = fixtureAt(args.moment ?? "all");
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

/** A steward's list: work waiting for their review, and a review of theirs still on this phone. */
export const PendingSteward: Story = {
  args: {
    uploads: READY,
    toReview: [gardenWork("0xreview", "Compost Turn", { createdAt: hoursAgo(20) })],
    decisions: [gardenWork("0xdecided", "Path Edging", { status: "approved" })],
  },
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
