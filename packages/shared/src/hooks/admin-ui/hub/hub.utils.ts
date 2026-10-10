import {
  RiAddLine,
  RiCheckLine,
  RiFileList3Line,
  RiMedalLine,
  RiShakeHandsLine,
} from "@remixicon/react";
import type { MetaStripItem } from "../../../components/Canvas/MetaStrip";
import type { ViewAction } from "../../../components/Canvas/viewActions.types";
import {
  type AdminHubRouteContext,
  type AdminHubWorkScope,
  adminRoutes,
} from "../../../utils/navigation/admin-routes";
import type { useGardenDerivedState } from "../../garden/useGardenDerivedState";
import { resolveAdminWorkspaceSectionRoute } from "../navigation/workspaceNavigation";

// ============================================================================
// Types
// ============================================================================

export type HubPipelineStage = "work" | "assess" | "certify" | "confirm";
export type SortDirection = "newest" | "oldest";
export type HubWorkScope = AdminHubWorkScope;
export type ActivityEvent = ReturnType<typeof useGardenDerivedState>["activityEvents"][number];
export {
  CERTIFICATION_CONTENT_ID_PREFIX,
  isRouteSheetContentId,
  parseCertificationContentId,
  parseWorkDetailContentId,
  SUBMIT_WORK_CONTENT_ID,
  toCertificationContentId,
  toWorkDetailContentId,
  WORK_DETAIL_CONTENT_ID_PREFIX,
} from "../navigation/sheetRegistry";

// ============================================================================
// Constants
// ============================================================================

export const HUB_STAGE_RAIL_ID = "hub-stage";

// ============================================================================
// Header Stats — Hub
// ============================================================================

export interface HubHeaderStatsInput {
  hasSelectedGarden: boolean;
  /** Pending work submitted a week ago or earlier, before any search narrows the queue. */
  waitingOverWeekCount: number;
  formatMessage: (
    descriptor: { id: string; defaultMessage?: string },
    values?: Record<string, string | number | boolean | Date | null | undefined>
  ) => string;
}

/**
 * Inline MetaStrip items for the Hub header. The stage tab rail already shows
 * queue depth per stage, so the header adds how long work has waited: one
 * plain-ink count of work waiting over a week. Age is metadata, never an alarm
 * (DL-044), so the count takes no critical tone. Returns [] before a garden is
 * selected so the slot stays clean on the selection gate.
 */
export function buildHubHeaderStats({
  hasSelectedGarden,
  waitingOverWeekCount,
  formatMessage,
}: HubHeaderStatsInput): MetaStripItem[] {
  if (!hasSelectedGarden) return [];

  return [
    {
      id: "waiting-over-week",
      value: String(waitingOverWeekCount),
      label: formatMessage({
        id: "cockpit.hub.stats.waitingOverWeek",
        defaultMessage: "waiting over a week",
      }),
    },
  ];
}

// ============================================================================
// Utility Functions
// ============================================================================

export function resolvePipelineStageFromPath(pathname: string): HubPipelineStage {
  if (pathname.startsWith("/hub/assess")) return "assess";
  if (pathname.startsWith("/hub/certify")) return "certify";
  if (pathname.startsWith("/hub/confirm")) return "confirm";
  return "work";
}

export function parseSortDirection(value: string | null): SortDirection {
  return value === "oldest" ? "oldest" : "newest";
}

export function parseWorkScope(value: string | null | undefined): HubWorkScope {
  return value === "approved" ? "approved" : "pending";
}

// ============================================================================
// Stage Config
// ============================================================================

// Two queues, then two kinds of record: work to review, promises to confirm,
// then the garden's assessments and its hypercerts (DL-082). The stage ids and
// their /hub routes predate the Assessments and Hypercerts labels and keep
// their names.
export const PIPELINE_STAGE_CONFIG = [
  {
    id: "work" as const,
    labelId: "cockpit.hub.tab.work",
    defaultMessage: "Work",
    icon: RiCheckLine,
  },
  {
    // Promises waiting on the steward's confirmation (uiux-spec §6.9), second
    // on the rail (PRD-1045).
    id: "confirm" as const,
    labelId: "cockpit.hub.tab.confirm",
    defaultMessage: "Confirm",
    icon: RiShakeHandsLine,
  },
  {
    id: "assess" as const,
    labelId: "cockpit.hub.tab.assess",
    defaultMessage: "Assessments",
    icon: RiFileList3Line,
  },
  {
    id: "certify" as const,
    labelId: "cockpit.hub.tab.certify",
    defaultMessage: "Hypercerts",
    icon: RiMedalLine,
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
  assess: { id: "cockpit.hub.tab.assess", defaultMessage: "Assessments" },
  certify: { id: "cockpit.hub.tab.certify", defaultMessage: "Hypercerts" },
  confirm: { id: "cockpit.hub.tab.confirm", defaultMessage: "Confirm" },
};

const SEARCH_PLACEHOLDERS: Record<HubPipelineStage, { id: string; defaultMessage: string }> = {
  work: { id: "cockpit.hub.search.placeholder", defaultMessage: "Search submissions" },
  assess: { id: "cockpit.hub.search.assessPlaceholder", defaultMessage: "Search assessments" },
  certify: {
    id: "cockpit.hub.search.certifyPlaceholder",
    defaultMessage: "Search hypercerts",
  },
  confirm: {
    id: "cockpit.hub.search.confirmPlaceholder",
    defaultMessage: "Search commitments to confirm",
  },
};

export function getStageTitle(stage: HubPipelineStage, formatMessage: FormatMessage): string {
  return formatMessage(STAGE_LABELS[stage]);
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
  itemId?: string,
  hubContext?: AdminHubRouteContext
): string {
  return resolveAdminWorkspaceSectionRoute({
    tab,
    section,
    itemId,
    hubSort: sortDirection,
    gardenId: hubContext?.gardenId,
  });
}

// ============================================================================
// View Actions — Hub
// ============================================================================
//
// Stable trio: the same creation actions render on every stage, in the same
// order, so button positions never shift as the steward moves between tabs.
// The Hub is a review surface, so all three render outlined and none
// out-shouts the queue (DL-043). Submit Work stays the declared primary on
// every stage (Create Assessment for evaluator-only viewers): it still sorts
// rightmost and fills the FAB.

export function buildHubViewActions(
  _stage: HubPipelineStage,
  canManage: boolean,
  canReview: boolean,
  navigate: (path: string) => void,
  hubContext: AdminHubRouteContext
): ViewAction[] {
  return [
    {
      id: "submit-work",
      label: "Submit work",
      labelId: "cockpit.hub.action.submitWork",
      icon: RiAddLine,
      onClick: () => navigate(adminRoutes.hubWorkSubmit(hubContext)),
      variant: "secondary",
      visible: canManage,
      primary: true,
    },
    {
      id: "create-assessment",
      label: "Create assessment",
      labelId: "cockpit.hub.action.createAssessment",
      icon: RiCheckLine,
      onClick: () => navigate(adminRoutes.hubAssessCreate(hubContext)),
      variant: "secondary",
      visible: canReview,
      primary: !canManage,
    },
    {
      id: "create-hypercert",
      label: "Create hypercert",
      labelId: "cockpit.hub.action.createHypercert",
      icon: RiMedalLine,
      onClick: () => navigate(adminRoutes.hubCertifyCreate(hubContext)),
      variant: "secondary",
      visible: canManage,
      primary: false,
    },
  ];
}
