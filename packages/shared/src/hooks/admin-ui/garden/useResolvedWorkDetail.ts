import {
  DEFAULT_CHAIN_ID,
  compareAddresses,
  useActions,
  useAdminGardenContext,
  useGardenPermissions,
  useGardens,
  useWorks,
  type WorkMetadata,
} from "@green-goods/shared";
import { useEffect, useMemo } from "react";

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
  const { activeGarden, activeGardenId, selectGarden } = useAdminGardenContext();

  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
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
  const garden =
    gardens.find((candidateGarden) => compareAddresses(candidateGarden.id, gardenId)) ??
    matchedGarden ??
    (activeGarden && compareAddresses(activeGarden.id, gardenId) ? activeGarden : null);

  const { works, isLoading: worksLoading } = useWorks(gardenId ?? "");
  const work =
    works.find((candidateWork) => candidateWork.id === workId) ??
    matchedGarden?.works?.find((candidateWork) => candidateWork.id === workId);

  const { data: actions = [] } = useActions(DEFAULT_CHAIN_ID);
  const action = useMemo(
    () => actions.find((candidateAction) => work && Number(candidateAction.id) === work.actionUID),
    [actions, work]
  );

  const canReview = garden ? gardenPermissions.canReviewGarden(garden) : false;
  const canApproveOrReject = garden
    ? gardenPermissions.isOperatorOfGarden(garden) || gardenPermissions.isOwnerOfGarden(garden)
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
    gardenId,
    work,
    action,
    canReview,
    canApproveOrReject,
    isReviewed,
    metadata,
    audioNoteCids: metadata?.audioNoteCids,
    isLoading: gardensLoading || (gardenId ? worksLoading : false),
  };
}
