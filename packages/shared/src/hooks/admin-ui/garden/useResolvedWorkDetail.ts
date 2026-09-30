import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import type { Garden, Work, WorkMetadata } from "../../../types/domain";
import { compareAddresses } from "../../../utils/blockchain/address";
import { useActions, useGardens } from "../../blockchain/useBaseLists";
import { useAdminGardenContext } from "../../garden/useAdminGardenContext";
import { useGardenPermissions } from "../../garden/useGardenPermissions";
import { useWorks } from "../../work/useWorks";
import { useEffect, useMemo, useState } from "react";

export type WorkDetailResolutionStatus =
  | "loading"
  | "resolved"
  | "temporarily-absent"
  | "not-found"
  | "error";

interface ResolvedWorkSnapshot {
  workId: string;
  garden: Garden;
  work: Work;
}

export function parseWorkMetadata(metadataStr: string): Partial<WorkMetadata> | null {
  try {
    const parsed = JSON.parse(metadataStr);
    return parsed;
  } catch {
    return null;
  }
}

export function useResolvedWorkDetail(workId: string | undefined) {
  const gardenPermissions = useGardenPermissions();
  const {
    activeGarden,
    activeGardenId,
    isError: gardenContextError,
    selectGarden,
  } = useAdminGardenContext();

  const {
    data: gardens = [],
    error: gardensError,
    isError: gardensQueryError,
    isFetching: gardensFetching,
    isLoading: gardensLoading,
  } = useGardens();
  const matchedGarden = useMemo(
    () =>
      workId
        ? (gardens.find((garden) =>
            garden.works?.some((candidateWork) => candidateWork.id === workId)
          ) ?? null)
        : null,
    [gardens, workId]
  );
  const gardenId = matchedGarden?.id ?? activeGardenId;
  const liveGarden =
    gardens.find((candidateGarden) => compareAddresses(candidateGarden.id, gardenId)) ??
    matchedGarden ??
    (activeGarden && compareAddresses(activeGarden.id, gardenId) ? activeGarden : null);

  const {
    error: worksError,
    isError: worksQueryError,
    isFetching: worksFetching,
    isLoading: worksLoading,
    works,
  } = useWorks(gardenId ?? "");
  const liveWork =
    works.find((candidateWork) => candidateWork.id === workId) ??
    matchedGarden?.works?.find((candidateWork) => candidateWork.id === workId);

  const [lastResolved, setLastResolved] = useState<ResolvedWorkSnapshot | null>(null);
  useEffect(() => {
    if (!workId || !liveGarden || !liveWork) {
      setLastResolved((current) => (current?.workId === workId ? current : null));
      return;
    }

    setLastResolved((current) =>
      current?.workId === workId && current.garden === liveGarden && current.work === liveWork
        ? current
        : { workId, garden: liveGarden, work: liveWork }
    );
  }, [liveGarden, liveWork, workId]);

  const retained = lastResolved?.workId === workId ? lastResolved : null;
  const hasLiveRecord = Boolean(liveGarden && liveWork);
  const garden = hasLiveRecord ? liveGarden : (retained?.garden ?? null);
  const work = hasLiveRecord ? liveWork : retained?.work;
  const hasQueryError = gardenContextError || gardensQueryError || worksQueryError;
  const isSettling =
    gardensLoading || gardensFetching || (gardenId ? worksLoading || worksFetching : false);
  const resolutionStatus: WorkDetailResolutionStatus = hasLiveRecord
    ? "resolved"
    : retained
      ? "temporarily-absent"
      : hasQueryError
        ? "error"
        : isSettling
          ? "loading"
          : "not-found";

  const { data: actions = [] } = useActions(DEFAULT_CHAIN_ID);
  const action = useMemo(
    () => actions.find((candidateAction) => work && Number(candidateAction.id) === work.actionUID),
    [actions, work]
  );

  const canReview = garden ? gardenPermissions.canReviewGarden(garden) : false;
  const canApproveOrReject = garden
    ? gardenPermissions.isStewardOfGarden(garden) || gardenPermissions.isOwnerOfGarden(garden)
    : false;
  const isReviewed = work?.status === "approved" || work?.status === "rejected";

  useEffect(() => {
    if (matchedGarden && !compareAddresses(matchedGarden.id, activeGardenId)) {
      selectGarden(matchedGarden, { replace: true });
    }
  }, [activeGardenId, matchedGarden, selectGarden]);

  const metadata = useMemo(
    () => (work?.metadata ? parseWorkMetadata(work.metadata) : null),
    [work?.metadata]
  );

  return {
    garden,
    gardenId: garden?.id ?? gardenId,
    work,
    action,
    canReview,
    canApproveOrReject,
    isReviewed,
    metadata,
    audioNoteCids: metadata?.audioNoteCids,
    resolutionStatus,
    isLoading: resolutionStatus === "loading",
    isTemporarilyAbsent: resolutionStatus === "temporarily-absent",
    isNotFound: resolutionStatus === "not-found",
    isError: resolutionStatus === "error",
    error: gardensError ?? worksError ?? null,
  };
}
