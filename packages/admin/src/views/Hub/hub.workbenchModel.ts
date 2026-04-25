import type { GardenAssessment } from "@green-goods/shared";
import {
  type HubPipelineStage,
  PIPELINE_STAGE_CONFIG,
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

export function buildHubStageModel({
  requestedStage,
  canManage,
  canAssess,
  canCertify,
  canBrowseHistory,
  works,
  assessments,
  hypercerts,
}: HubStageModelInput) {
  const certifiedAssessmentIds = new Set(hypercerts.map((hypercert) => hypercert.id));
  const stageCounts: Record<HubPipelineStage, number | undefined> = {
    work: works.filter((work) => work.status === "pending").length,
    assess: works.filter((work) => work.status === "approved").length,
    certify: assessments.filter((assessment) => !certifiedAssessmentIds.has(assessment.id)).length,
    history: undefined,
  };

  const stageVisibility: Record<HubPipelineStage, boolean> = {
    work: canManage,
    assess: canAssess,
    certify: canCertify,
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
}: HubRouteSheetInput) {
  const routeSheetSide =
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
    historyEvents: number;
  }
): number {
  if (stage === "work") return counts.pendingWorks;
  if (stage === "assess") return counts.assessmentQueue;
  if (stage === "certify") return counts.certificationQueue;
  return counts.historyEvents;
}
