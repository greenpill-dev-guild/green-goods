import {
  RiAddLine,
  RiCheckboxCircleLine,
  RiCheckLine,
  RiFileList3Line,
  RiMedalLine,
} from "@remixicon/react";
import { adminRoutes, type useGardenDerivedState } from "@green-goods/shared";

// ============================================================================
// Types
// ============================================================================

export type HubPipelineStage = "work" | "assess" | "certify" | "history";
export type SortDirection = "newest" | "oldest";
export type ActivityEvent = ReturnType<typeof useGardenDerivedState>["activityEvents"][number];

// ============================================================================
// Constants
// ============================================================================

export const WORK_DETAIL_CONTENT_ID_PREFIX = "hub:work-detail:";
export const CERTIFICATION_CONTENT_ID_PREFIX = "hub:certify:";
export const HISTORY_CONTENT_ID_PREFIX = "hub:history:";
export const SUBMIT_WORK_CONTENT_ID = "hub:submit-work";
export const HUB_STAGE_RAIL_ID = "hub-stage";

export const HUB_META_PILL_CLASSNAME =
  "inline-flex items-center rounded-full bg-bg-white/80 px-2.5 py-[0.34rem] text-[0.74rem] font-semibold text-text-sub shadow-[var(--edge-rest)]";
export const HUB_CERTIFY_STATUS_CLASSNAME =
  "inline-flex items-center rounded-full bg-primary-alpha-10 px-2.5 py-1 text-[0.72rem] font-bold tracking-[0.01em] text-text-strong";
export const HUB_HISTORY_STATUS_CLASSNAME =
  "inline-flex items-center rounded-full bg-bg-white/85 px-2.5 py-1 text-[0.72rem] font-bold tracking-[0.01em] text-text-sub shadow-[var(--edge-rest)]";

// ============================================================================
// Utility Functions
// ============================================================================

export function resolvePipelineStageFromPath(pathname: string): HubPipelineStage {
  if (pathname.startsWith("/hub/assess")) return "assess";
  if (pathname.startsWith("/hub/certify")) return "certify";
  if (pathname.startsWith("/hub/history")) return "history";
  return "work";
}

export function parseSortDirection(value: string | null): SortDirection {
  return value === "oldest" ? "oldest" : "newest";
}

export function toWorkDetailContentId(workId: string) {
  return `${WORK_DETAIL_CONTENT_ID_PREFIX}${workId}`;
}

export function parseWorkDetailContentId(contentId: string | null) {
  if (!contentId?.startsWith(WORK_DETAIL_CONTENT_ID_PREFIX)) return null;
  return contentId.slice(WORK_DETAIL_CONTENT_ID_PREFIX.length) || null;
}

export function toCertificationContentId(assessmentId: string) {
  return `${CERTIFICATION_CONTENT_ID_PREFIX}${assessmentId}`;
}

export function parseCertificationContentId(contentId: string | null) {
  if (!contentId?.startsWith(CERTIFICATION_CONTENT_ID_PREFIX)) return null;
  return contentId.slice(CERTIFICATION_CONTENT_ID_PREFIX.length) || null;
}

export function toHistoryContentId(eventId: string) {
  return `${HISTORY_CONTENT_ID_PREFIX}${eventId}`;
}

export function parseHistoryContentId(contentId: string | null) {
  if (!contentId?.startsWith(HISTORY_CONTENT_ID_PREFIX)) return null;
  return contentId.slice(HISTORY_CONTENT_ID_PREFIX.length) || null;
}

export function isRouteSheetContentId(contentId: string | null) {
  return (
    contentId === SUBMIT_WORK_CONTENT_ID ||
    Boolean(parseWorkDetailContentId(contentId)) ||
    Boolean(parseCertificationContentId(contentId))
  );
}

// ============================================================================
// Stage Config
// ============================================================================

export const PIPELINE_STAGE_CONFIG = [
  {
    id: "work" as const,
    labelId: "cockpit.hub.tab.work",
    defaultMessage: "Work",
    icon: RiCheckLine,
  },
  {
    id: "assess" as const,
    labelId: "cockpit.hub.tab.assess",
    defaultMessage: "Assess",
    icon: RiFileList3Line,
  },
  {
    id: "certify" as const,
    labelId: "cockpit.hub.tab.certify",
    defaultMessage: "Certify",
    icon: RiMedalLine,
  },
  {
    id: "history" as const,
    labelId: "cockpit.hub.tab.history",
    defaultMessage: "History",
    icon: RiCheckboxCircleLine,
  },
] as const;

// ============================================================================
// Stage Label Helpers
// ============================================================================

type FormatMessage = (
  descriptor: { id: string; defaultMessage: string },
  values?: Record<string, string>
) => string;

const STAGE_LABELS: Record<HubPipelineStage, { id: string; defaultMessage: string }> = {
  work: { id: "cockpit.hub.tab.work", defaultMessage: "Work" },
  assess: { id: "cockpit.hub.tab.assess", defaultMessage: "Assess" },
  certify: { id: "cockpit.hub.tab.certify", defaultMessage: "Certify" },
  history: { id: "cockpit.hub.tab.history", defaultMessage: "History" },
};

const STAGE_DESCRIPTIONS: Record<HubPipelineStage, { id: string; defaultMessage: string }> = {
  work: {
    id: "cockpit.hub.description",
    defaultMessage: "Review, assess, and certify work flowing through {garden}.",
  },
  assess: {
    id: "cockpit.hub.assess.placeholder.description",
    defaultMessage: "Approved work appears here for assessment packaging and handoff.",
  },
  certify: {
    id: "cockpit.hub.certify.placeholder.description",
    defaultMessage: "Certification bundles stay inside Hub until they are ready for minting.",
  },
  history: {
    id: "cockpit.hub.history.description",
    defaultMessage: "Audit the recent work, impact, and community decisions tied to this garden.",
  },
};

const SEARCH_PLACEHOLDERS: Record<HubPipelineStage, { id: string; defaultMessage: string }> = {
  work: { id: "cockpit.hub.search.placeholder", defaultMessage: "Search submissions" },
  assess: { id: "cockpit.hub.search.assessPlaceholder", defaultMessage: "Search approved work" },
  certify: {
    id: "cockpit.hub.search.certifyPlaceholder",
    defaultMessage: "Search certification bundles",
  },
  history: { id: "cockpit.hub.search.historyPlaceholder", defaultMessage: "Search audit trail" },
};

export function getStageTitle(stage: HubPipelineStage, formatMessage: FormatMessage): string {
  return formatMessage(STAGE_LABELS[stage]);
}

export function getStageDescription(
  stage: HubPipelineStage,
  gardenName: string | undefined,
  formatMessage: FormatMessage
): string {
  if (stage === "work") {
    return formatMessage(STAGE_DESCRIPTIONS.work, {
      garden: gardenName ?? formatMessage({ id: "cockpit.nav.hub", defaultMessage: "Hub" }),
    });
  }
  return formatMessage(STAGE_DESCRIPTIONS[stage]);
}

export function getSearchPlaceholder(
  stage: HubPipelineStage,
  formatMessage: FormatMessage
): string {
  return formatMessage(SEARCH_PLACEHOLDERS[stage]);
}

// ============================================================================
// Route Helpers
// ============================================================================

export function resolveOpenSectionRoute(
  tab: "overview" | "impact" | "work" | "community",
  section: string,
  sortDirection: SortDirection,
  itemId?: string
): string {
  if (tab === "work") {
    return section === "decisions"
      ? adminRoutes.hubHistory({ sort: sortDirection, item: itemId })
      : adminRoutes.hubWork({ sort: sortDirection, item: itemId });
  }

  if (tab === "impact" || tab === "overview") {
    return tab === "impact"
      ? adminRoutes.gardenImpact({ item: itemId, section })
      : adminRoutes.gardenOverview({ item: itemId, section });
  }

  if (section === "members") return adminRoutes.communityMembers({ item: itemId });
  if (section === "cookie-jars" || section === "payouts")
    return adminRoutes.communityPayouts({ item: itemId });
  if (section === "pools" || section === "governance")
    return adminRoutes.communityGovernance({ item: itemId });
  return adminRoutes.communityTreasury({ item: itemId });
}

// ============================================================================
// FAB Config
// ============================================================================

export function buildHubFabConfig(
  stage: HubPipelineStage,
  canManage: boolean,
  canReview: boolean,
  navigate: (path: string) => void,
  hubContext: { sort: SortDirection; item: undefined }
) {
  if (stage === "work" && canManage) {
    return {
      icon: RiAddLine,
      label: "Submit Work",
      actions: [
        {
          id: "submit-work",
          icon: RiAddLine,
          label: "Submit Work",
          labelId: "cockpit.hub.fab.submitWork",
        },
      ],
      onAction: (actionId: string) => {
        if (actionId === "submit-work") navigate(adminRoutes.hubWorkSubmit(hubContext));
      },
    };
  }

  if (stage === "assess" && canReview) {
    return {
      icon: RiAddLine,
      label: "Create Assessment",
      actions: [
        {
          id: "create-assessment",
          icon: RiAddLine,
          label: "Create Assessment",
          labelId: "cockpit.hub.fab.createAssessment",
        },
      ],
      onAction: (actionId: string) => {
        if (actionId === "create-assessment") navigate(adminRoutes.hubAssessCreate());
      },
    };
  }

  if (stage === "certify" && canManage) {
    return {
      icon: RiAddLine,
      label: "Mint Hypercert",
      actions: [
        {
          id: "mint-hypercert",
          icon: RiAddLine,
          label: "Mint Hypercert",
          labelId: "cockpit.hub.fab.mintHypercert",
        },
      ],
      onAction: (actionId: string) => {
        if (actionId === "mint-hypercert") navigate(adminRoutes.hubCertifyCreate());
      },
    };
  }

  return null;
}
