import {
  RiAddLine,
  RiCheckboxCircleLine,
  RiCheckLine,
  RiFileList3Line,
  RiMedalLine,
} from "@remixicon/react";
import {
  type AdminHubRouteContext,
  adminRoutes,
  type useGardenDerivedState,
} from "@green-goods/shared";
import type { ViewAction } from "../../../components/Canvas/viewActions.types";
import { resolveAdminWorkspaceSectionRoute } from "../navigation/workspaceNavigation";

// ============================================================================
// Types
// ============================================================================

export type HubPipelineStage = "work" | "assess" | "certify" | "history";
export type SortDirection = "newest" | "oldest";
export type ActivityEvent = ReturnType<typeof useGardenDerivedState>["activityEvents"][number];
export {
  CERTIFICATION_CONTENT_ID_PREFIX,
  HISTORY_CONTENT_ID_PREFIX,
  isRouteSheetContentId,
  parseCertificationContentId,
  parseHistoryContentId,
  parseWorkDetailContentId,
  SUBMIT_WORK_CONTENT_ID,
  toCertificationContentId,
  toHistoryContentId,
  toWorkDetailContentId,
  WORK_DETAIL_CONTENT_ID_PREFIX,
} from "../navigation/sheetRegistry";

// ============================================================================
// Constants
// ============================================================================

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

// Stage descriptions never name the garden — the AppBar's GardenChip already
// declares which garden the operator is in. Re-stating it here would double the
// chrome and steal a row of vertical space (see Rule 17).
const STAGE_DESCRIPTIONS: Record<HubPipelineStage, { id: string; defaultMessage: string }> = {
  work: {
    id: "cockpit.hub.description",
    defaultMessage: "Review and triage pending submissions.",
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
    defaultMessage: "Audit the recent work, impact, and community decisions in this pipeline.",
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

export function getStageDescription(stage: HubPipelineStage, formatMessage: FormatMessage): string {
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
  itemId?: string,
  hubContext?: AdminHubRouteContext
): string {
  return resolveAdminWorkspaceSectionRoute({
    tab,
    section,
    itemId,
    hubSort: sortDirection,
    gardenAddress: hubContext?.gardenAddress,
  });
}

// ============================================================================
// View Actions — Hub
// ============================================================================
//
// Stable trio: the same creation actions render on every stage, in the same
// order, so button positions never shift as the operator moves between tabs.
// Only the emphasis moves — the stage whose workflow an action opens renders
// it filled (Work → Submit Work, Assess → Create Assessment, Certify →
// Create Hypercert). History owns no creation flow, so all three stay
// outlined there and the mobile FAB hides (no `primary` → no FAB).

export function buildHubViewActions(
  stage: HubPipelineStage,
  canManage: boolean,
  canReview: boolean,
  navigate: (path: string) => void,
  hubContext: AdminHubRouteContext
): ViewAction[] {
  return [
    {
      id: "submit-work",
      label: "Submit Work",
      labelId: "cockpit.hub.action.submitWork",
      icon: RiAddLine,
      onClick: () => navigate(adminRoutes.hubWorkSubmit(hubContext)),
      variant: stage === "work" ? "primary" : "secondary",
      visible: canManage,
      primary: stage === "work",
    },
    {
      id: "create-assessment",
      label: "Create Assessment",
      labelId: "cockpit.hub.action.createAssessment",
      icon: RiCheckLine,
      onClick: () => navigate(adminRoutes.hubAssessCreate(hubContext)),
      variant: stage === "assess" ? "primary" : "secondary",
      visible: canReview,
      primary: stage === "assess",
    },
    {
      id: "create-hypercert",
      label: "Create Hypercert",
      labelId: "cockpit.hub.action.createHypercert",
      icon: RiMedalLine,
      onClick: () => navigate(adminRoutes.hubCertifyCreate(hubContext)),
      variant: stage === "certify" ? "primary" : "secondary",
      visible: canManage,
      primary: stage === "certify",
    },
  ];
}
