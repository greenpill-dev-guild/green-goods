import { compareAddresses } from "../../../utils/blockchain/address";
import { adminRoutes } from "../../../utils/navigation/admin-routes";
import { useGardens } from "../../blockchain/useBaseLists";
import { useAdminGardenContext } from "../../garden/useAdminGardenContext";
import { useGardenPermissions } from "../../garden/useGardenPermissions";
import { useRouteItemClose } from "../../navigation/useCanvasSearchParams";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { HypercertCompletionData } from "../hypercerts/types";

export function useCreateHypercertController() {
  const navigate = useNavigate();
  // Mounted only while its route item is in the URL.
  const closeFlow = useRouteItemClose(true);
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

  // The first confirmed snapshot is the hypercert as it was minted; a later
  // rerun of the wizard's effect (a refetch, say) must not replace it.
  const handleComplete = useCallback(
    (data: HypercertCompletionData) => setMinted((current) => current ?? data),
    []
  );

  const openMinted = useCallback(
    (data: HypercertCompletionData) =>
      // Replaces the flow's entry, so Back from the record cannot reopen it.
      navigate(adminRoutes.gardenHypercertDetail(data.hypercertId, gardenRouteContext), {
        replace: true,
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
    // returns to the stage the flow opened over (DL-140).
    if (minted) {
      openMinted(minted);
      return;
    }
    closeFlow();
  }, [closeFlow, minted, openMinted]);

  return {
    canManage,
    garden,
    gardenRouteContext,
    handleCancel,
    handleComplete,
    // Done exists only once the mint confirmed. Its completion data lands in an
    // effect a render later; until then Done waits rather than leave for the Hub.
    handleDone: () => {
      if (minted) openMinted(minted);
    },
    /** The mint's completion data has arrived, so Done and close can open its record. */
    mintedReady: minted !== null,
  };
}
