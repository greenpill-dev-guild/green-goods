import type { Domain } from "../../../types/domain";
import type { AdminSheetSide } from "../navigation/sheetRegistry";
import {
  type ReviewPipelineStage,
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
} from "./review.utils";

type WorkStatusLike = {
  status?: string;
};

export interface ReviewStageModelInput {
  requestedStage: ReviewPipelineStage;
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

export interface ReviewRouteSelectionInput {
  routeWorkId?: string;
  routeCertificationId?: string;
  activeWorkDetailId: string | null;
  activeCertificationId: string | null;
  isSubmitRoute: boolean;
  selectedWork: unknown;
  selectedCertification: unknown;
}

export interface ReviewRouteSheetInput {
  routeWorkId?: string;
  routeCertificationId?: string;
  isSubmitRoute: boolean;
}

export interface ReviewRouteStateInput {
  pathname: string;
  sortParam: string | null;
  scopeParam?: string | null;
  routedWorkIdParam?: string;
  routedAssessmentIdParam?: string;
  activeContentId: string | null;
}

export interface ReviewWorkspaceStateInput {
  stage: ReviewPipelineStage;
  sortDirection: SortDirection;
  searchTerm: string;
  persistedSelectedItem: string | null;
  hasOpenReviewInspector: boolean;
}

export type ReviewStageContentKind = "work" | "assess" | "confirm" | "certify";

export interface ReviewSheetSelectionInput {
  routeWorkId?: string;
  routeCertificationId?: string;
  activeWorkDetailId: string | null;
  hasSelectedCertification: boolean;
}

export type ReviewSheetSelection = { kind: "work"; id: string } | { kind: "certification" } | null;

type ActionTitleLike = {
  id: string | number | bigint;
  title: string;
  domain?: Domain | null;
};

export interface ReviewActionSummary {
  title: string;
  domain?: Domain;
}

/** A Review list's older records, present while the garden has more than the list holds. */
export interface ReviewOlderRecords {
  /** Reads the next page; absent offline, where the list can only say there is more. */
  onShowOlder?: () => void;
  isLoading: boolean;
}

export function normalizeReviewSearch(searchTerm: string): string {
  return searchTerm.trim().toLowerCase();
}

export function selectReviewStageContent(stage: ReviewPipelineStage): ReviewStageContentKind {
  return stage;
}

export function resolveReviewSheetSelection({
  routeWorkId,
  routeCertificationId,
}: ReviewSheetSelectionInput): ReviewSheetSelection {
  // Selection snapshots can outlive navigation; only the route owns visibility.
  if (routeWorkId) return { kind: "work", id: routeWorkId };
  if (routeCertificationId) return { kind: "certification" };
  return null;
}

export function buildActionTitleMap(actions: ActionTitleLike[]) {
  return new Map<number, ReviewActionSummary>(
    actions.map((action) => {
      const summary: ReviewActionSummary = { title: action.title };
      if (action.domain !== null && action.domain !== undefined) {
        summary.domain = action.domain;
      }
      return [Number(action.id), summary];
    })
  );
}

export function resolveReviewRouteState({
  pathname,
  sortParam,
  scopeParam,
  routedWorkIdParam,
  routedAssessmentIdParam,
  activeContentId,
}: ReviewRouteStateInput) {
  const isSubmitRoute = pathname.endsWith("/work/submit");
  const routeWorkId = routedWorkIdParam;
  const routeCertificationId = routedAssessmentIdParam;
  const activeWorkDetailId = parseWorkDetailContentId(activeContentId);
  const activeCertificationId = parseCertificationContentId(activeContentId);
  const { routeSheetContentId, routeSheetSide } = resolveReviewRouteSheet({
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

export function buildReviewWorkspaceState({
  stage,
  sortDirection,
  searchTerm,
  persistedSelectedItem,
  hasOpenReviewInspector,
}: ReviewWorkspaceStateInput) {
  return {
    activeMode: stage,
    filter: sortDirection,
    search: searchTerm,
    selectedItem: persistedSelectedItem,
    sheetOpen: hasOpenReviewInspector,
  };
}

export function buildReviewStageModel({
  requestedStage,
  canManage,
  canReview,
  canConfirm = false,
  confirmCount = 0,
  works,
}: ReviewStageModelInput) {
  // A count on the rail means "waiting on you", so only the two queues carry
  // one. Assessments and Hypercerts list records, which wait on no one.
  const stageCounts: Record<ReviewPipelineStage, number | undefined> = {
    work: works.filter((work) => work.status === "pending").length,
    assess: undefined,
    certify: undefined,
    confirm: confirmCount,
  };

  const stageVisibility: Record<ReviewPipelineStage, boolean> = {
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

export function resolveReviewRouteSelection({
  routeWorkId,
  routeCertificationId,
  activeWorkDetailId,
  activeCertificationId,
  isSubmitRoute,
  selectedWork,
  selectedCertification,
}: ReviewRouteSelectionInput) {
  const persistedSelectedItem =
    routeWorkId ?? routeCertificationId ?? activeWorkDetailId ?? activeCertificationId ?? null;

  return {
    hasOpenReviewInspector: Boolean(
      routeWorkId || routeCertificationId || isSubmitRoute || selectedWork || selectedCertification
    ),
    persistedSelectedItem,
  };
}

export function resolveReviewRouteSheet({
  isSubmitRoute,
  routeWorkId,
  routeCertificationId,
}: ReviewRouteSheetInput): {
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

export function getReviewResultCount(
  stage: ReviewPipelineStage,
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
 * empty list, so the stage says so instead of "none yet". Each stage answers
 * for its own read: a work outage must not hide assessments that loaded, nor
 * the reverse. A garden that could not be read fails every stage. The two
 * record tabs say so only while they have nothing already read to show, so a
 * refresh that fails in the background keeps the records on screen. The Work
 * tab still says so on any failed work read: whether a review queue may show
 * rows it could not refresh is a separate decision, left as it was. The
 * Confirm stage reads its own queue and reports its own failures.
 *
 * It takes each read's error as it comes, so a caller has nothing to combine.
 */
export function hasReviewStageDataError(
  stage: ReviewPipelineStage,
  read: {
    gardenError: unknown;
    worksError: unknown;
    assessmentsError: unknown;
    assessmentCount: number;
    hypercertsError: unknown;
    hypercertCount: number;
  }
): boolean {
  if (read.gardenError) return true;
  if (stage === "work") return Boolean(read.worksError);
  if (stage === "assess") return Boolean(read.assessmentsError) && read.assessmentCount === 0;
  if (stage === "certify") return Boolean(read.hypercertsError) && read.hypercertCount === 0;
  return false;
}
