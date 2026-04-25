import { adminRoutes, useAdminStore, useGardenPermissions, useGardens } from "@green-goods/shared";
import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { HypercertCompletionData } from "@/components/Hypercerts/HypercertWizard";

export function useCreateHypercertController() {
  const navigate = useNavigate();
  const selectedGarden = useAdminStore((state) => state.selectedGarden);
  const { data: gardens = [] } = useGardens();
  const garden = useMemo(
    () => gardens.find((item) => item.id === selectedGarden?.id),
    [gardens, selectedGarden?.id]
  );
  const gardenRouteContext = useMemo(
    () => ({ gardenAddress: garden?.tokenAddress ?? garden?.id }),
    [garden?.id, garden?.tokenAddress]
  );
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
