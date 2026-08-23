import { useMemo } from "react";
import {
  filterAssessmentQueue,
  filterCertificationQueue,
  filterHistoryEvents,
  filterPendingWorks,
} from "./hub.filters";

/**
 * The Hub's per-stage queues and the row a route currently selects. Pure
 * derivation over the workspace data, split out of
 * `useHubWorkbenchController` so that file stays inside its source-structure
 * cap; the controller passes what it already has and spreads the result.
 */
export function useHubStageQueues(input: {
  works: Parameters<typeof filterPendingWorks>[0];
  actionsMap: Parameters<typeof filterPendingWorks>[1];
  normalizedSearch: string;
  sortDirection: Parameters<typeof filterPendingWorks>[3];
  assessments: Parameters<typeof filterCertificationQueue>[0];
  hypercerts: Parameters<typeof filterCertificationQueue>[1];
  activityEvents: Parameters<typeof filterHistoryEvents>[0];
  routeWorkId?: string | null;
  activeWorkDetailId?: string | null;
  routeCertificationId?: string | null;
  activeCertificationId?: string | null;
  routeHistoryEventId?: string | null;
}) {
  const {
    works,
    actionsMap,
    normalizedSearch,
    sortDirection,
    assessments,
    hypercerts,
    activityEvents,
    routeWorkId,
    activeWorkDetailId,
    routeCertificationId,
    activeCertificationId,
    routeHistoryEventId,
  } = input;

  const pendingWorks = useMemo(
    () => filterPendingWorks(works, actionsMap, normalizedSearch, sortDirection),
    [actionsMap, normalizedSearch, sortDirection, works]
  );

  const assessmentQueue = useMemo(
    () => filterAssessmentQueue(works, actionsMap, normalizedSearch),
    [actionsMap, normalizedSearch, works]
  );

  const certificationQueue = useMemo(
    () => filterCertificationQueue(assessments, hypercerts, normalizedSearch),
    [assessments, hypercerts, normalizedSearch]
  );

  const historyEvents = useMemo(
    () => filterHistoryEvents(activityEvents, normalizedSearch, sortDirection),
    [activityEvents, normalizedSearch, sortDirection]
  );

  const historyEventMap = useMemo(
    () => new Map(historyEvents.map((event) => [event.id, event])),
    [historyEvents]
  );

  const selectedWork = useMemo(() => {
    const resolvedId = routeWorkId ?? activeWorkDetailId;
    return resolvedId ? works.find((work) => work.id === resolvedId) : undefined;
  }, [activeWorkDetailId, routeWorkId, works]);

  const selectedCertification = useMemo(() => {
    const resolvedId = routeCertificationId ?? activeCertificationId;
    return resolvedId
      ? certificationQueue.find((assessment) => assessment.id === resolvedId)
      : undefined;
  }, [activeCertificationId, certificationQueue, routeCertificationId]);

  const selectedHistoryEvent = useMemo(
    () => (routeHistoryEventId ? historyEventMap.get(routeHistoryEventId) : undefined),
    [historyEventMap, routeHistoryEventId]
  );

  return {
    pendingWorks,
    assessmentQueue,
    certificationQueue,
    historyEvents,
    historyEventMap,
    selectedWork,
    selectedCertification,
    selectedHistoryEvent,
  };
}
