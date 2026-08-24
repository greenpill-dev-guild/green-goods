import type { Domain, GardenAssessment } from "../../../types/domain";
import type { AdminSheetSide } from "../navigation/sheetRegistry";
import {
  type HubPipelineStage,
  PIPELINE_STAGE_CONFIG,
  parseCertificationContentId,
  parseSortDirection,
  parseWorkDetailContentId,
  resolvePipelineStageFromPath,
  type SortDirection,
  SUBMIT_WORK_CONTENT_ID,
  toCertificationContentId,
  toHistoryContentId,
  toWorkDetailContentId,
} from "./hub.utils";

type WorkStatusLike = {
  status?: string;
};

type HypercertLike = {
  id: string;
};

export interface HubStageModelInput {
  requestedStage: HubPipelineStage;
  canManage: boolean;
  canAssess: boolean;
  canCertify: boolean;
  canBrowseHistory: boolean;
  /** The reader stewards at least one garden: the Confirm stage exists only then. */
  canConfirm?: boolean;
  /** Ordinary plus fallback rows waiting on the reader (useCommitmentsToConfirm). */
  confirmCount?: number;
  works: WorkStatusLike[];
  assessments: Pick<GardenAssessment, "id">[];
  hypercerts: HypercertLike[];
}

export interface HubRouteSelectionInput {
  routeWorkId?: string;
  routeCertificationId?: string;
  routeHistoryEventId?: string;
  activeWorkDetailId: string | null;
  activeCertificationId: string | null;
  isSubmitRoute: boolean;
  selectedWork: unknown;
  selectedCertification: unknown;
  selectedHistoryEvent: unknown;
}

export interface HubRouteSheetInput {
  routeWorkId?: string;
  routeCertificationId?: string;
  routeHistoryEventId?: string;
  isSubmitRoute: boolean;
}

export interface HubRouteStateInput {
  pathname: string;
  sortParam: string | null;
  routedWorkIdParam?: string;
  routedAssessmentIdParam?: string;
  routedHistoryEventIdParam?: string;
  activeContentId: string | null;
}

export interface HubWorkspaceStateInput {
  stage: HubPipelineStage;
  sortDirection: SortDirection;
  searchTerm: string;
  persistedSelectedItem: string | null;
  hasOpenHubInspector: boolean;
}

export type HubStageContentKind = "work" | "assess" | "confirm" | "certify" | "history";

export interface HubSheetSelectionInput {
  routeWorkId?: string;
  routeCertificationId?: string;
  routeHistoryEventId?: string;
  activeWorkDetailId: string | null;
  hasSelectedCertification: boolean;
  hasSelectedHistoryEvent: boolean;
}

export type HubSheetSelection =
  | { kind: "work"; id: string }
  | { kind: "certification" }
  | { kind: "history" }
  | null;

type ActionTitleLike = {
  id: string | number | bigint;
  title: string;
  domain?: Domain | null;
};

export interface HubActionSummary {
  title: string;
  domain?: Domain;
}

export function normalizeHubSearch(searchTerm: string): string {
  return searchTerm.trim().toLowerCase();
}

export function selectHubStageContent(stage: HubPipelineStage): HubStageContentKind {
  return stage;
}

export function resolveHubSheetSelection({
  routeWorkId,
  routeCertificationId,
  routeHistoryEventId,
  activeWorkDetailId,
  hasSelectedCertification,
  hasSelectedHistoryEvent,
}: HubSheetSelectionInput): HubSheetSelection {
  const workId = routeWorkId ?? activeWorkDetailId;
  if (workId) return { kind: "work", id: workId };
  if (routeCertificationId || hasSelectedCertification) return { kind: "certification" };
  if (routeHistoryEventId || hasSelectedHistoryEvent) return { kind: "history" };
  return null;
}

export function buildActionTitleMap(actions: ActionTitleLike[]) {
  return new Map<number, HubActionSummary>(
    actions.map((action) => {
      const summary: HubActionSummary = { title: action.title };
      if (action.domain !== null && action.domain !== undefined) {
        summary.domain = action.domain;
      }
      return [Number(action.id), summary];
    })
  );
}

export function resolveHubRouteState({
  pathname,
  sortParam,
  routedWorkIdParam,
  routedAssessmentIdParam,
  routedHistoryEventIdParam,
  activeContentId,
}: HubRouteStateInput) {
  const isSubmitRoute = pathname.endsWith("/work/submit");
  const routeWorkId = routedWorkIdParam;
  const routeCertificationId = routedAssessmentIdParam;
  const routeHistoryEventId = routedHistoryEventIdParam;
  const activeWorkDetailId = parseWorkDetailContentId(activeContentId);
  const activeCertificationId = parseCertificationContentId(activeContentId);
  const { routeSheetContentId, routeSheetSide } = resolveHubRouteSheet({
    isSubmitRoute,
    routeWorkId,
    routeCertificationId,
    routeHistoryEventId,
  });

  return {
    activeCertificationId,
    activeWorkDetailId,
    isSubmitRoute,
    requestedStage: resolvePipelineStageFromPath(pathname),
    routeCertificationId,
    routeHistoryEventId,
    routeSheetContentId,
    routeSheetSide,
    routeWorkId,
    sortDirection: parseSortDirection(sortParam),
  };
}

export function buildHubWorkspaceState({
  stage,
  sortDirection,
  searchTerm,
  persistedSelectedItem,
  hasOpenHubInspector,
}: HubWorkspaceStateInput) {
  return {
    activeMode: stage,
    filter: sortDirection,
    search: searchTerm,
    selectedItem: persistedSelectedItem,
    sheetOpen: hasOpenHubInspector,
  };
}

export function buildHubStageModel({
  requestedStage,
  canManage,
  canAssess,
  canCertify,
  canBrowseHistory,
  canConfirm = false,
  confirmCount = 0,
  works,
  assessments,
  hypercerts,
}: HubStageModelInput) {
  const certifiedAssessmentIds = new Set(hypercerts.map((hypercert) => hypercert.id));
  const stageCounts: Record<HubPipelineStage, number | undefined> = {
    work: works.filter((work) => work.status === "pending").length,
    assess: works.filter((work) => work.status === "approved").length,
    certify: assessments.filter((assessment) => !certifiedAssessmentIds.has(assessment.id)).length,
    confirm: confirmCount,
    history: undefined,
  };

  const stageVisibility: Record<HubPipelineStage, boolean> = {
    work: canManage,
    assess: canAssess,
    certify: canCertify,
    confirm: canConfirm,
    history: canBrowseHistory,
  };

  const allStages = PIPELINE_STAGE_CONFIG.map((cfg) => ({
    ...cfg,
    count: stageCounts[cfg.id],
    visible: stageVisibility[cfg.id],
  }));
  const stages = allStages.filter((stageOption) => stageOption.visible);
  const fallbackStage = stages[0]?.id ?? "history";
  const stage = stages.some((option) => option.id === requestedStage)
    ? requestedStage
    : fallbackStage;

  return {
    allStages,
    fallbackStage,
    stage,
    stageCounts,
    stages,
    stageVisibility,
  };
}

export function resolveHubRouteSelection({
  routeWorkId,
  routeCertificationId,
  routeHistoryEventId,
  activeWorkDetailId,
  activeCertificationId,
  isSubmitRoute,
  selectedWork,
  selectedCertification,
  selectedHistoryEvent,
}: HubRouteSelectionInput) {
  const persistedSelectedItem =
    routeWorkId ??
    routeCertificationId ??
    routeHistoryEventId ??
    activeWorkDetailId ??
    activeCertificationId ??
    null;

  return {
    hasOpenHubInspector: Boolean(
      routeWorkId ||
        routeCertificationId ||
        routeHistoryEventId ||
        isSubmitRoute ||
        selectedWork ||
        selectedCertification ||
        selectedHistoryEvent
    ),
    persistedSelectedItem,
  };
}

export function resolveHubRouteSheet({
  isSubmitRoute,
  routeWorkId,
  routeCertificationId,
  routeHistoryEventId,
}: HubRouteSheetInput): {
  routeSheetContentId: string | null;
  routeSheetSide: AdminSheetSide | null;
} {
  const routeSheetSide: AdminSheetSide | null =
    isSubmitRoute || routeWorkId || routeCertificationId || routeHistoryEventId ? "left" : null;
  const routeSheetContentId = isSubmitRoute
    ? SUBMIT_WORK_CONTENT_ID
    : routeWorkId
      ? toWorkDetailContentId(routeWorkId)
      : routeCertificationId
        ? toCertificationContentId(routeCertificationId)
        : routeHistoryEventId
          ? toHistoryContentId(routeHistoryEventId)
          : null;

  return { routeSheetContentId, routeSheetSide };
}

export function getHubResultCount(
  stage: HubPipelineStage,
  counts: {
    pendingWorks: number;
    assessmentQueue: number;
    certificationQueue: number;
    confirmQueue?: number;
    historyEvents: number;
  }
): number {
  if (stage === "work") return counts.pendingWorks;
  if (stage === "assess") return counts.assessmentQueue;
  if (stage === "certify") return counts.certificationQueue;
  if (stage === "confirm") return counts.confirmQueue ?? 0;
  return counts.historyEvents;
}
