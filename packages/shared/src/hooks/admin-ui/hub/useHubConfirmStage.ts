import { useCallback } from "react";
import type { NavigateFunction } from "react-router-dom";
import { type AdminHubRouteContext, adminRoutes } from "../../../utils/navigation/admin-routes";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { useCurrentChain } from "../../blockchain/useChainConfig";
import { useCommitmentsToConfirm } from "../../commitment-pooling/useCommitmentsToConfirm";

/**
 * The Hub's Confirm stage (uiux-spec §6.9): what the reader's gardens must
 * confirm, plus the fallback rows only a steward can still confirm. The queue
 * spans the reader's stewarded gardens rather than the selected one, and a row
 * opens in place (`/hub/confirm/:commitmentId`) the way the other stages
 * deep-link. Split out of `useHubWorkbenchController`, which is at its
 * source-structure cap.
 */
export function useHubConfirmStage(input: {
  navigate: NavigateFunction;
  hubContext: AdminHubRouteContext;
}) {
  const { navigate, hubContext } = input;
  const chainId = useCurrentChain();
  const viewer = usePrimaryAddress() ?? undefined;
  const toConfirm = useCommitmentsToConfirm({ chainId, viewer });

  const handleOpenCommitment = useCallback(
    (commitmentId: string) => {
      navigate(adminRoutes.hubConfirmDetail(commitmentId, hubContext));
    },
    [hubContext, navigate]
  );
  const handleCloseCommitment = useCallback(() => {
    navigate(adminRoutes.hubConfirm(hubContext));
  }, [hubContext, navigate]);

  return { chainId, viewer, toConfirm, handleOpenCommitment, handleCloseCommitment };
}
