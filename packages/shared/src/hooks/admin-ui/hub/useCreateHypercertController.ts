import { compareAddresses } from "../../../utils/blockchain/address";
import { adminRoutes } from "../../../utils/navigation/admin-routes";
import { useGardens } from "../../blockchain/useBaseLists";
import { useAdminGardenContext } from "../../garden/useAdminGardenContext";
import { useGardenPermissions } from "../../garden/useGardenPermissions";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { HypercertCompletionData } from "../hypercerts/types";

export function useCreateHypercertController() {
  const navigate = useNavigate();
  const { activeGarden, activeGardenId } = useAdminGardenContext();
  const { data: gardens = [] } = useGardens();
  const garden = useMemo(() => {
    const indexedGarden = gardens.find((item) => compareAddresses(item.id, activeGardenId));
    return indexedGarden ?? activeGarden ?? undefined;
  }, [activeGarden, activeGardenId, gardens]);
  const gardenRouteContext = useMemo(() => ({ gardenId: garden?.id }), [garden?.id]);
  const permissions = useGardenPermissions();
  const canManage = garden ? permissions.canManageGarden(garden) : false;

  // The hypercert the flow just minted. The flow stays on its Review once the
  // mint confirms (DL-080); Done, or closing, then opens the hypercert's record.
  const [minted, setMinted] = useState<HypercertCompletionData | null>(null);

  const handleComplete = useCallback((data: HypercertCompletionData) => setMinted(data), []);

  const openMinted = useCallback(
    (data: HypercertCompletionData) =>
      navigate(adminRoutes.gardenHypercertDetail(data.hypercertId, gardenRouteContext), {
        state: {
          // Shown at once while the indexer catches up with the mint.
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
      }),
    [gardenRouteContext, navigate]
  );

  const handleCancel = useCallback(() => {
    // A minted hypercert closes onto its record, as Done does. Any other close
    // returns to the Hub the flow was launched from (parity with Submit Work),
    // not the garden impact view: closing a Hub create flow must not jump tabs.
    if (minted) {
      openMinted(minted);
      return;
    }
    navigate(adminRoutes.hub(gardenRouteContext));
  }, [gardenRouteContext, minted, navigate, openMinted]);

  return {
    canManage,
    garden,
    gardenRouteContext,
    handleCancel,
    handleComplete,
    // Done exists only once the mint confirmed, so it is the minted close.
    handleDone: handleCancel,
  };
}
