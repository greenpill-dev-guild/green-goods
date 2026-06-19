import {
  adminRoutes,
  compareAddresses,
  useAdminStore,
  useGardenPermissions,
  useGardens,
} from "@green-goods/shared";
import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { HypercertCompletionData } from "../hypercerts/types";

export function useCreateHypercertController() {
  const navigate = useNavigate();
  const selectedGarden = useAdminStore((state) => state.selectedGarden);
  const { data: gardens = [] } = useGardens();
  const garden = useMemo(
    () => gardens.find((item) => compareAddresses(item.id, selectedGarden?.id)),
    [gardens, selectedGarden?.id]
  );
  const gardenRouteContext = useMemo(() => ({ gardenAddress: garden?.id }), [garden?.id]);
  const permissions = useGardenPermissions();
  const canManage = garden ? permissions.canManageGarden(garden) : false;

  const handleComplete = useCallback(
    (data: HypercertCompletionData) => {
      navigate(adminRoutes.gardenHypercertDetail(data.hypercertId, gardenRouteContext), {
        state: {
          optimisticData: {
            id: data.hypercertId,
            title: data.title,
            description: data.description,
            workScopes: data.workScopes,
            imageUri: data.imageUri,
            attestationCount: data.attestationCount,
            mintedAt: data.mintedAt,
            txHash: data.txHash,
          },
        },
      });
    },
    [gardenRouteContext, navigate]
  );

  const handleCancel = useCallback(
    () => navigate(adminRoutes.gardenImpact({ ...gardenRouteContext, section: "hypercerts" })),
    [gardenRouteContext, navigate]
  );

  return {
    canManage,
    garden,
    gardenRouteContext,
    handleCancel,
    handleComplete,
  };
}
