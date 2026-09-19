import en from "@green-goods/shared/i18n/en";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import type { Address, Work } from "@green-goods/shared/types/domain";
import type { TimeFilter } from "@green-goods/shared/utils/time";
import { RiCheckLine, RiDraftLine, RiTaskLine } from "@remixicon/react";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { IntlProvider, useIntl } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { fn } from "storybook/test";
import {
  FIXTURE_IMAGE_AGROFORESTRY,
  FIXTURE_IMAGE_SOLAR,
  hoursAgo,
  STORYBOOK_NOW_SECONDS,
} from "../../../../../shared/.storybook/fixtures";
import { CompletedTab } from "./CompletedTab";
import { PendingTab } from "./PendingTab";
import { buildUploadActions, type UploadBarState } from "./uploadActions";
import { WorkDashboardShell } from "./WorkDashboardShell";

const GARDEN = "0xf401f34378384713222d1d21f63359cc4e8a858a" as Address;
const STEWARD = "0x2aa64e6d80390f5c017f0313cb908051be2fd35e" as Address;
const GARDENER = "0x1111111111111111111111111111111111111111" as Address;

const PHONE_VIEWPORT = {
  workDashboardPhone360x780: {
    name: "Phone 360 x 780",
    styles: { width: "360px", height: "780px" },
    type: "mobile",
  },
} as const;

const MESSAGES = { en, es, pt } as const;
type Locale = keyof typeof MESSAGES;

function work(id: string, overrides: Partial<Work>): Work {
  return {
    id,
    title: "Planting Event",
    actionUID: 44,
    gardenerAddress: GARDENER,
    gardenAddress: GARDEN,
    feedback: "",
    metadata: "{}",
    media: [],
    createdAt: hoursAgo(3),
    status: "pending",
    ...overrides,
  };
}

const PENDING_WORKS: Work[] = [
  work("0x01", { title: "Planting Event", media: [FIXTURE_IMAGE_AGROFORESTRY] }),
  work("0x02", { title: "Survival Check", media: [FIXTURE_IMAGE_SOLAR], createdAt: hoursAgo(20) }),
  work("0x03", { title: "Compost Turn", gardenerAddress: STEWARD, createdAt: hoursAgo(30) }),
];

/** Work saved on this device, in the state background preparation left it. */
function queued(
  id: string,
  title: string,
  submissionState: string,
  overrides: Partial<Work> = {},
  blockedReason?: string
): Work {
  return work(id, {
    title,
    gardenerAddress: STEWARD,
    status: "offline",
    metadata: JSON.stringify({ submissionState, blockedReason }),
    ...overrides,
  });
}

const READY_WORKS: Work[] = [
  queued("job-planting", "Planting Event", "ready", { media: [FIXTURE_IMAGE_AGROFORESTRY] }),
  queued("job-survival", "Survival Check", "ready", {
    media: [FIXTURE_IMAGE_SOLAR],
    createdAt: hoursAgo(4),
  }),
];

/** One work in every state Upload all reads, the longest blocked reason included. */
const UPLOAD_STATE_WORKS: Work[] = [
  queued("job-ready", "Planting Event", "ready", { media: [FIXTURE_IMAGE_AGROFORESTRY] }),
  queued("job-preparing", "Survival Check", "preparing", { createdAt: hoursAgo(4) }),
  queued("job-photo", "Compost Turn", "photo-pending", { createdAt: hoursAgo(5) }),
  queued("job-photo-failed", "Seed Library Count", "photo-needs-attention", {
    createdAt: hoursAgo(6),
  }),
  queued("job-blocked", "Swale Repair", "blocked", { createdAt: hoursAgo(7) }, "NotActiveAction"),
  queued(
    "job-domain",
    "Mulch Delivery",
    "blocked",
    { createdAt: hoursAgo(8) },
    "ActionDomainMismatch"
  ),
  queued("job-sent", "Water Point Check", "awaiting-confirmation", { createdAt: hoursAgo(9) }),
];

const PREPARING_WORKS: Work[] = [
  queued("job-preparing", "Survival Check", "preparing"),
  queued("job-photo", "Compost Turn", "photo-pending", { createdAt: hoursAgo(4) }),
];

const COMPLETED_WORKS: Work[] = [
  work("0x04", { title: "Seed Library Count", status: "approved", createdAt: hoursAgo(26) }),
  work("0x05", { title: "Swale Repair", status: "rejected", createdAt: hoursAgo(50) }),
];

interface DashboardFrameProps {
  tab: "pending" | "completed";
  items: Work[];
  pendingFilter?: "all" | "needsReview" | "mySubmissions";
  completedFilter?: "reviewedByYou" | "myWorkReviewed";
  timeFilter?: TimeFilter;
  isFetching?: boolean;
  isOffline?: boolean;
  savedAt?: number;
  /** Queued work and decisions: renders the Upload all bar when set. */
  uploads?: Partial<UploadBarState>;
  /** Works whose decision from this device still waits to upload. */
  waitingUploadIds?: string[];
}

const NO_UPLOADS: UploadBarState = {
  readyCount: 0,
  preparingCount: 0,
  pausedForDataSaver: false,
  isPreparing: false,
  isUploading: false,
};

/** The real sheet chrome and tab content, fed fixture rows instead of the data hooks. */
function DashboardFrame({
  tab,
  items,
  pendingFilter = "all",
  completedFilter = "reviewedByYou",
  timeFilter = "month",
  isFetching = false,
  isOffline = false,
  savedAt,
  uploads,
  waitingUploadIds = [],
}: DashboardFrameProps) {
  const intl = useIntl();
  const actions = uploads
    ? buildUploadActions(
        { ...NO_UPLOADS, ...uploads },
        { onUpload: fn(), onPrepareNow: fn() },
        intl.formatMessage
      )
    : undefined;
  const tabs = [
    {
      id: "drafts",
      icon: <RiDraftLine className="w-4 h-4" />,
      label: intl.formatMessage({ id: "app.workDashboard.tabs.drafts", defaultMessage: "Draft" }),
    },
    {
      id: "pending",
      icon: <RiTaskLine className="w-4 h-4" />,
      label: intl.formatMessage({
        id: "app.workDashboard.tabs.pending",
        defaultMessage: "Pending",
      }),
    },
    {
      id: "completed",
      icon: <RiCheckLine className="w-4 h-4" />,
      label: intl.formatMessage({
        id: "app.workDashboard.tabs.completed",
        defaultMessage: "Completed",
      }),
    },
  ];

  return (
    <WorkDashboardShell
      isClosing={false}
      onRequestClose={fn()}
      tabs={tabs}
      activeTab={tab}
      onTabChange={fn()}
      actions={actions}
    >
      {tab === "pending" ? (
        <PendingTab
          items={items}
          isLoading={false}
          isFetching={isFetching}
          hasError={false}
          onWorkClick={fn()}
          onRefresh={fn()}
          isOffline={isOffline}
          savedAt={savedAt}
          pendingFilter={pendingFilter}
          onPendingFilterChange={fn()}
          activeAddress={STEWARD}
          reviewerGardenIds={[GARDEN]}
          reviewedByYou={new Set()}
          isUserAddress={(address) => address?.toLowerCase() === STEWARD.toLowerCase()}
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
          timeFilter={timeFilter}
          onTimeFilterChange={fn()}
          waitingUploadIds={new Set(waitingUploadIds)}
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
 * Your Work at phone width: the shared bottom sheet at the full tier with the Pending and
 * Completed tabs rendered from fixture rows. The header row under the tabs carries the item
 * count and the filters.
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
};

export default meta;
type Story = StoryObj<typeof DashboardFrame>;

export const Pending: Story = {
  args: { tab: "pending", items: PENDING_WORKS },
};

export const PendingMySubmissions: Story = {
  args: { tab: "pending", items: PENDING_WORKS.slice(2), pendingFilter: "mySubmissions" },
};

export const PendingSpanish: Story = {
  args: { tab: "pending", items: PENDING_WORKS },
  parameters: { locale: "es" },
};

export const PendingPortuguese: Story = {
  args: { tab: "pending", items: PENDING_WORKS },
  parameters: { locale: "pt" },
};

export const Completed: Story = {
  args: { tab: "completed", items: COMPLETED_WORKS },
};

/** Two hours before the frozen Storybook clock, so the offline line shows a time from today. */
const SAVED_AT = (STORYBOOK_NOW_SECONDS - 2 * 3_600) * 1_000;

export const PendingRefreshing: Story = {
  args: { tab: "pending", items: PENDING_WORKS, isFetching: true },
};

export const PendingOffline: Story = {
  args: { tab: "pending", items: PENDING_WORKS, isOffline: true, savedAt: SAVED_AT },
};

export const PendingOfflineSpanish: Story = {
  args: { tab: "pending", items: PENDING_WORKS, isOffline: true, savedAt: SAVED_AT },
  parameters: { locale: "es" },
};

export const PendingOfflinePortuguese: Story = {
  args: { tab: "pending", items: PENDING_WORKS, isOffline: true, savedAt: SAVED_AT },
  parameters: { locale: "pt" },
};

export const PendingEmpty: Story = {
  args: { tab: "pending", items: [] },
};

export const CompletedEmpty: Story = {
  args: { tab: "completed", items: [] },
};

export const CompletedMyWorkReviewedPortuguese: Story = {
  args: { tab: "completed", items: COMPLETED_WORKS, completedFilter: "myWorkReviewed" },
  parameters: { locale: "pt" },
};

/** The widest Pending filter label in each language. */
export const PendingSpanishNeedsReview: Story = {
  args: { tab: "pending", items: PENDING_WORKS, pendingFilter: "needsReview" },
  parameters: { locale: "es" },
};

export const PendingPortugueseMySubmissions: Story = {
  args: { tab: "pending", items: PENDING_WORKS, pendingFilter: "mySubmissions" },
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
    savedAt: SAVED_AT,
  },
  parameters: { locale: "es" },
};

/** Everything queued is prepared: one tap sends it all with one signature. */
export const PendingUploadAll: Story = {
  args: { tab: "pending", items: [...READY_WORKS, PENDING_WORKS[0]], uploads: { readyCount: 2 } },
};

/**
 * Every state Upload all reads. The chip says whether a work waits to upload or needs
 * attention; the line under it says what it waits for, and why the chain would refuse it.
 */
export const PendingUploadStates: Story = {
  args: {
    tab: "pending",
    items: UPLOAD_STATE_WORKS,
    pendingFilter: "mySubmissions",
    uploads: { readyCount: 1, preparingCount: 2, isPreparing: true },
  },
};

export const PendingUploadStatesSpanish: Story = {
  args: PendingUploadStates.args,
  parameters: { locale: "es" },
};

export const PendingUploadStatesPortuguese: Story = {
  args: PendingUploadStates.args,
  parameters: { locale: "pt" },
};

/** Nothing is prepared yet and preparation is running. */
export const PendingPreparingUploads: Story = {
  args: {
    tab: "pending",
    items: PREPARING_WORKS,
    pendingFilter: "mySubmissions",
    uploads: { preparingCount: 2, isPreparing: true },
  },
};

/** Data Saver holds preparation back: the bar offers to prepare the rest beside what is ready. */
export const PendingDataSaver: Story = {
  args: {
    tab: "pending",
    items: UPLOAD_STATE_WORKS.slice(0, 3),
    pendingFilter: "mySubmissions",
    uploads: { readyCount: 1, preparingCount: 2, pausedForDataSaver: true },
  },
};

export const PendingDataSaverSpanish: Story = {
  args: PendingDataSaver.args,
  parameters: { locale: "es" },
};

export const PendingUploadingPortuguese: Story = {
  args: { tab: "pending", items: READY_WORKS, uploads: { readyCount: 2, isUploading: true } },
  parameters: { locale: "pt" },
};

/** A decision made offline files under By you at once and says it still waits to upload. */
export const CompletedWaitingToUpload: Story = {
  args: {
    tab: "completed",
    items: COMPLETED_WORKS,
    waitingUploadIds: ["0x04"],
    uploads: { readyCount: 1 },
  },
};

export const CompletedWaitingToUploadSpanish: Story = {
  args: CompletedWaitingToUpload.args,
  parameters: { locale: "es" },
};

export const CompletedWaitingToUploadPortuguese: Story = {
  args: CompletedWaitingToUpload.args,
  parameters: { locale: "pt" },
};
