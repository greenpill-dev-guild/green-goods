import { useCallback, useMemo } from "react";
import type { NavigateFunction } from "react-router-dom";
import { type AdminHubRouteContext, adminRoutes } from "../../../utils/navigation/admin-routes";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { useCurrentChain } from "../../blockchain/useChainConfig";
import type { Address } from "../../../types/domain";
import { useCommitmentsToConfirm } from "../../commitment-pooling/useCommitmentsToConfirm";
import { selectToConfirmForGarden } from "./hub.filters";

/**
 * The Hub's Confirm stage (uiux-spec §6.9): what the garden in the header must
 * confirm, plus the garden fallbacks only its steward can still confirm. Like
 * every other Hub stage it acts for that one garden (decision 24 in the
 * commitment-pooling QA readiness plan); a row whose commitment lives in
 * another garden's pool names that pool. The tab exists for the selected
 * garden's stewards, and a row opens in place (`/hub/confirm/:commitmentId`)
 * the way the other stages deep-link. Split out of `useHubWorkbenchController`,
 * which is at its source-structure cap.
 */
export function useHubConfirmStage(input: {
  navigate: NavigateFunction;
  hubContext: AdminHubRouteContext;
  /** The garden in the header; the stage lists nothing without one. */
  garden: Address | null;
  /** The reader stewards that garden, which is what the tab follows. */
  canManage: boolean;
}) {
  const { navigate, hubContext, garden, canManage } = input;
  const chainId = useCurrentChain();
  const viewer = usePrimaryAddress() ?? undefined;
  const everyGarden = useCommitmentsToConfirm({ chainId, viewer });
  const toConfirm = useMemo(
    () => ({ ...selectToConfirmForGarden(everyGarden, garden), isSteward: canManage }),
    [everyGarden, garden, canManage]
  );

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
