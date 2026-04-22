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
  const permissions = useGardenPermissions();
  const canManage = garden ? permissions.canManageGarden(garden) : false;

  const handleComplete = useCallback(
    (data: HypercertCompletionData) => {
      navigate(adminRoutes.gardenHypercertDetail(data.hypercertId), {
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
    [navigate]
  );

  const handleCancel = useCallback(
    () => navigate(adminRoutes.gardenImpact({ section: "hypercerts" })),
    [navigate]
  );

  return {
    canManage,
    garden,
    handleCancel,
    handleComplete,
  };
}
