import type { Domain } from "../../../types/domain";
import type { AdminSheetSide } from "../navigation/sheetRegistry";
import {
  type HubPipelineStage,
  PIPELINE_STAGE_CONFIG,
  parseCertificationContentId,
  parseSortDirection,
  parseWorkDetailContentId,
  parseWorkScope,
  resolvePipelineStageFromPath,
  type SortDirection,
  SUBMIT_WORK_CONTENT_ID,
  toCertificationContentId,
  toWorkDetailContentId,
} from "./hub.utils";

type WorkStatusLike = {
  status?: string;
};

export interface HubStageModelInput {
  requestedStage: HubPipelineStage;
  /** Owners and stewards: the Work stage, where submissions are reviewed. */
  canManage: boolean;
  /**
   * Owners, stewards and evaluators, the people who can create an assessment:
   * the Assessments and Hypercerts stages.
   */
  canReview: boolean;
  /** The reader stewards at least one garden: the Confirm stage exists only then. */
  canConfirm?: boolean;
  /** Ordinary plus fallback rows waiting on the reader (useCommitmentsToConfirm). */
  confirmCount?: number;
  works: WorkStatusLike[];
}

export interface HubRouteSelectionInput {
  routeWorkId?: string;
  routeCertificationId?: string;
  activeWorkDetailId: string | null;
  activeCertificationId: string | null;
  isSubmitRoute: boolean;
  selectedWork: unknown;
  selectedCertification: unknown;
}

export interface HubRouteSheetInput {
  routeWorkId?: string;
  routeCertificationId?: string;
  isSubmitRoute: boolean;
}

export interface HubRouteStateInput {
  pathname: string;
  sortParam: string | null;
  scopeParam?: string | null;
  routedWorkIdParam?: string;
  routedAssessmentIdParam?: string;
  activeContentId: string | null;
}

export interface HubWorkspaceStateInput {
  stage: HubPipelineStage;
  sortDirection: SortDirection;
  searchTerm: string;
  persistedSelectedItem: string | null;
  hasOpenHubInspector: boolean;
}

export type HubStageContentKind = "work" | "assess" | "confirm" | "certify";

export interface HubSheetSelectionInput {
  routeWorkId?: string;
  routeCertificationId?: string;
  activeWorkDetailId: string | null;
  hasSelectedCertification: boolean;
}

export type HubSheetSelection = { kind: "work"; id: string } | { kind: "certification" } | null;

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
}: HubSheetSelectionInput): HubSheetSelection {
  // Selection snapshots can outlive navigation; only the route owns visibility.
  if (routeWorkId) return { kind: "work", id: routeWorkId };
  if (routeCertificationId) return { kind: "certification" };
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
  scopeParam,
  routedWorkIdParam,
  routedAssessmentIdParam,
  activeContentId,
}: HubRouteStateInput) {
  const isSubmitRoute = pathname.endsWith("/work/submit");
  const routeWorkId = routedWorkIdParam;
  const routeCertificationId = routedAssessmentIdParam;
  const activeWorkDetailId = parseWorkDetailContentId(activeContentId);
  const activeCertificationId = parseCertificationContentId(activeContentId);
  const { routeSheetContentId, routeSheetSide } = resolveHubRouteSheet({
    isSubmitRoute,
    routeWorkId,
    routeCertificationId,
  });

  return {
    activeCertificationId,
    activeWorkDetailId,
    isSubmitRoute,
    requestedStage: resolvePipelineStageFromPath(pathname),
    routeCertificationId,
    routeSheetContentId,
    routeSheetSide,
    routeWorkId,
    sortDirection: parseSortDirection(sortParam),
    workScope: parseWorkScope(scopeParam),
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
  canReview,
  canConfirm = false,
  confirmCount = 0,
  works,
}: HubStageModelInput) {
  // A count on the rail means "waiting on you", so only the two queues carry
  // one. Assessments and Hypercerts list records, which wait on no one.
  const stageCounts: Record<HubPipelineStage, number | undefined> = {
    work: works.filter((work) => work.status === "pending").length,
    assess: undefined,
    certify: undefined,
    confirm: confirmCount,
  };

  const stageVisibility: Record<HubPipelineStage, boolean> = {
    work: canManage,
    assess: canReview,
    certify: canReview,
    confirm: canConfirm,
  };

  const allStages = PIPELINE_STAGE_CONFIG.map((cfg) => ({
    ...cfg,
    count: stageCounts[cfg.id],
    visible: stageVisibility[cfg.id],
  }));
  const stages = allStages.filter((stageOption) => stageOption.visible);
  const fallbackStage = stages[0]?.id ?? "work";
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
  activeWorkDetailId,
  activeCertificationId,
  isSubmitRoute,
  selectedWork,
  selectedCertification,
}: HubRouteSelectionInput) {
  const persistedSelectedItem =
    routeWorkId ?? routeCertificationId ?? activeWorkDetailId ?? activeCertificationId ?? null;

  return {
    hasOpenHubInspector: Boolean(
      routeWorkId || routeCertificationId || isSubmitRoute || selectedWork || selectedCertification
    ),
    persistedSelectedItem,
  };
}

export function resolveHubRouteSheet({
  isSubmitRoute,
  routeWorkId,
  routeCertificationId,
}: HubRouteSheetInput): {
  routeSheetContentId: string | null;
  routeSheetSide: AdminSheetSide | null;
} {
  const routeSheetSide: AdminSheetSide | null =
    isSubmitRoute || routeWorkId || routeCertificationId ? "left" : null;
  const routeSheetContentId = isSubmitRoute
    ? SUBMIT_WORK_CONTENT_ID
    : routeWorkId
      ? toWorkDetailContentId(routeWorkId)
      : routeCertificationId
        ? toCertificationContentId(routeCertificationId)
        : null;

  return { routeSheetContentId, routeSheetSide };
}

export function getHubResultCount(
  stage: HubPipelineStage,
  counts: {
    works: number;
    assessments: number;
    hypercerts: number;
    confirmQueue?: number;
  }
): number {
  if (stage === "work") return counts.works;
  if (stage === "assess") return counts.assessments;
  if (stage === "certify") return counts.hypercerts;
  return counts.confirmQueue ?? 0;
}

/**
 * Whether the open stage's list could not be read. A failed read is not an
 * empty list, so the stage says so instead of "none yet". Hypercerts come from
 * their own source: a failure there marks only the Hypercerts tab, and only
 * while that tab has nothing already read to show.
 */
export function hasHubStageDataError(
  stage: HubPipelineStage,
  input: { hasWorkspaceError: boolean; hasHypercertsError: boolean; hypercertCount: number }
): boolean {
  if (input.hasWorkspaceError) return true;
  return stage === "certify" && input.hasHypercertsError && input.hypercertCount === 0;
}
