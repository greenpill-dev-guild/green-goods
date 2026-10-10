import { useMemo } from "react";
import { filterAssessments, filterHypercerts, filterWorksByScope } from "./hub.filters";

/**
 * The Hub's per-stage lists and the row a route currently selects. Pure
 * derivation over the workspace data, split out of
 * `useHubWorkbenchController` so that file stays inside its source-structure
 * cap; the controller passes what it already has and spreads the result.
 */
export function useHubStageQueues<
  TAssessment extends Parameters<typeof filterAssessments>[0][number] & { id: string },
  THypercert extends Parameters<typeof filterHypercerts>[0][number],
>(input: {
  works: Parameters<typeof filterWorksByScope>[0];
  workScope: Parameters<typeof filterWorksByScope>[1];
  actionsMap: Parameters<typeof filterWorksByScope>[2];
  normalizedSearch: string;
  sortDirection: Parameters<typeof filterWorksByScope>[4];
  assessments: TAssessment[];
  hypercerts: THypercert[];
  routeWorkId?: string | null;
  activeWorkDetailId?: string | null;
  routeCertificationId?: string | null;
  activeCertificationId?: string | null;
}) {
  const {
    works,
    workScope,
    actionsMap,
    normalizedSearch,
    sortDirection,
    assessments,
    hypercerts,
    routeWorkId,
    activeWorkDetailId,
    routeCertificationId,
    activeCertificationId,
  } = input;

  const scopedWorks = useMemo(
    () => filterWorksByScope(works, workScope, actionsMap, normalizedSearch, sortDirection),
    [actionsMap, normalizedSearch, sortDirection, workScope, works]
  );

  const assessmentList = useMemo(
    () => filterAssessments(assessments, normalizedSearch),
    [assessments, normalizedSearch]
  );

  const hypercertList = useMemo(
    () => filterHypercerts(hypercerts, normalizedSearch),
    [hypercerts, normalizedSearch]
  );

  const selectedWork = useMemo(() => {
    const resolvedId = routeWorkId ?? activeWorkDetailId;
    return resolvedId ? works.find((work) => work.id === resolvedId) : undefined;
  }, [activeWorkDetailId, routeWorkId, works]);

  // Read from every assessment, not the searched list: a record opened by its
  // link stays open whatever the search box holds, as a work detail does.
  const selectedCertification = useMemo(() => {
    const resolvedId = routeCertificationId ?? activeCertificationId;
    return resolvedId ? assessments.find((assessment) => assessment.id === resolvedId) : undefined;
  }, [activeCertificationId, assessments, routeCertificationId]);

  return {
    scopedWorks,
    assessmentList,
    hypercertList,
    selectedWork,
    selectedCertification,
  };
}
